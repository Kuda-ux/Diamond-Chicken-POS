import { Response } from 'express';
import { z } from 'zod';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// ---------------------------------------------------------------------------
// GET /api/reconciliation?date=YYYY-MM-DD
// Returns the stock reconciliation report for a given date.
// Formula: Opening Stock + Purchases - Sales - Wastages - Transfers = Theoretical Closing
// Variance = Theoretical Closing - Actual Closing (from physical count)
// ---------------------------------------------------------------------------

const reconciliationQuerySchema = z.object({
  date: z.string().optional(), // defaults to today
});

export async function getReconciliation(req: AuthRequest, res: Response) {
  try {
    const { date } = reconciliationQuerySchema.parse(req.query);
    const reportDate = date || new Date().toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);

    const prevDay = new Date(reportDate);
    prevDay.setDate(prevDay.getDate() - 1);
    const prevDateStr = prevDay.toISOString().slice(0, 10);

    // Single batch CTE query — replaces the old N×5 per-ingredient query loop.
    // For N ingredients this used to fire N*5 separate HTTP requests to Neon;
    // now it's one round-trip regardless of ingredient count.
    const rows = await sql`
      WITH
      purchases_agg AS (
        SELECT ingredient_id, SUM(quantity)::float AS total
        FROM ingredient_receipts
        WHERE received_at = ${reportDate}::date
        GROUP BY ingredient_id
      ),
      sales_agg AS (
        SELECT r.ingredient_id, SUM(oi.quantity * r.quantity_per_unit)::float AS total
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN recipes r ON r.menu_item_id = oi.menu_item_id
        WHERE DATE(o.created_at AT TIME ZONE 'Africa/Harare') = ${reportDate}::date
          AND o.status != 'cancelled'
        GROUP BY r.ingredient_id
      ),
      wastage_agg AS (
        SELECT ingredient_id, SUM(quantity)::float AS total
        FROM waste_records
        WHERE recorded_at = ${reportDate}::date
        GROUP BY ingredient_id
      ),
      opening_counts AS (
        SELECT ingredient_id, quantity::float AS qty
        FROM stock_counts
        WHERE count_date = ${prevDateStr}::date
      ),
      actual_counts AS (
        SELECT ingredient_id, quantity::float AS qty
        FROM stock_counts
        WHERE count_date = ${reportDate}::date
      )
      SELECT
        i.id                                      AS "ingredientId",
        i.name,
        i.unit,
        COALESCE(i.department, 'Kitchen')         AS department,
        i.quantity::float                         AS "currentStock",
        oc.qty                                    AS "openingCountQty",
        COALESCE(p.total, 0)                      AS purchases,
        COALESCE(s.total, 0)                      AS sales,
        COALESCE(w.total, 0)                      AS wastage,
        ac.qty                                    AS "actualClosing"
      FROM ingredients i
      LEFT JOIN opening_counts oc ON oc.ingredient_id = i.id
      LEFT JOIN purchases_agg  p  ON p.ingredient_id  = i.id
      LEFT JOIN sales_agg      s  ON s.ingredient_id  = i.id
      LEFT JOIN wastage_agg    w  ON w.ingredient_id  = i.id
      LEFT JOIN actual_counts  ac ON ac.ingredient_id = i.id
      WHERE i.is_active = TRUE
      ORDER BY COALESCE(i.department, 'Kitchen'), i.name
    `;

    const results = rows.map((row: any) => {
      const purchases  = parseFloat(String(row.purchases  ?? 0));
      const sales      = parseFloat(String(row.sales      ?? 0));
      const wastage    = parseFloat(String(row.wastage    ?? 0));
      const transfers  = 0;
      const currentStock = parseFloat(String(row.currentStock ?? 0));

      let openingStock: number;
      if (row.openingCountQty != null) {
        openingStock = parseFloat(String(row.openingCountQty));
      } else if (reportDate === today) {
        openingStock = currentStock + sales + wastage + transfers - purchases;
      } else {
        openingStock = 0;
      }

      const theoreticalClosing = openingStock + purchases - sales - wastage - transfers;

      let actualClosing: number | null = null;
      if (row.actualClosing != null) {
        actualClosing = parseFloat(String(row.actualClosing));
      } else if (reportDate === today) {
        actualClosing = currentStock;
      }

      const variance = actualClosing !== null ? theoreticalClosing - actualClosing : null;

      return {
        ingredientId: row.ingredientId,
        name: row.name,
        unit: row.unit,
        department: row.department,
        openingStock:         Math.round(openingStock         * 1000) / 1000,
        purchases:            Math.round(purchases            * 1000) / 1000,
        sales:                Math.round(sales                * 1000) / 1000,
        wastage:              Math.round(wastage              * 1000) / 1000,
        transfers,
        theoreticalClosing:   Math.round(theoreticalClosing   * 1000) / 1000,
        actualClosing:        actualClosing  !== null ? Math.round(actualClosing  * 1000) / 1000 : null,
        variance:             variance       !== null ? Math.round(variance       * 1000) / 1000 : null,
      };
    });

    return successResponse(res, { date: reportDate, items: results });
  } catch (error) {
    console.error('Reconciliation error:', error);
    return errorResponse(res, 'Failed to generate reconciliation report', 500);
  }
}

// ---------------------------------------------------------------------------
// POST /api/reconciliation/count — Record a physical stock count
// ---------------------------------------------------------------------------

const countItemSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().min(0),
});

const recordCountSchema = z.object({
  date: z.string().optional(),
  items: z.array(countItemSchema).min(1),
  notes: z.string().max(500).optional(),
});

export async function recordStockCount(req: AuthRequest, res: Response) {
  try {
    const { date, items, notes } = recordCountSchema.parse(req.body);
    const userId = req.user?.userId || null;
    const countDate = date || new Date().toISOString().slice(0, 10);

    const results: any[] = [];

    for (const item of items) {
      // Verify ingredient exists
      const exists = await sql`SELECT 1 FROM ingredients WHERE id = ${item.ingredientId} AND is_active = TRUE`;
      if (exists.length === 0) continue;

      // Upsert stock count
      const [row] = await sql`
        INSERT INTO stock_counts (ingredient_id, count_date, quantity, counted_by_user_id, notes)
        VALUES (${item.ingredientId}, ${countDate}, ${item.quantity}, ${userId}, ${notes || null})
        ON CONFLICT (ingredient_id, count_date)
        DO UPDATE SET quantity = ${item.quantity}, counted_by_user_id = ${userId}, notes = COALESCE(${notes || null}, stock_counts.notes)
        RETURNING id, ingredient_id AS "ingredientId", count_date AS "countDate", quantity::float AS quantity
      `;

      // Also update the ingredients table to reflect the actual count
      await sql`
        UPDATE ingredients
        SET quantity = ${item.quantity}, updated_at = now()
        WHERE id = ${item.ingredientId}
      `;

      results.push(row);
    }

    return successResponse(res, { date: countDate, count: results.length, items: results }, 'Stock count recorded');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Record stock count error:', error);
    return errorResponse(res, 'Failed to record stock count', 500);
  }
}

// ---------------------------------------------------------------------------
// GET /api/reconciliation/counts?date=YYYY-MM-DD — Get counts for a date
// ---------------------------------------------------------------------------

export async function getStockCounts(req: AuthRequest, res: Response) {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const rows = await sql`
      SELECT
        sc.id,
        sc.ingredient_id AS "ingredientId",
        i.name AS "ingredientName",
        i.unit,
        sc.quantity::float AS quantity,
        sc.count_date AS "countDate",
        sc.notes,
        u.name AS "countedByName",
        sc.created_at AS "createdAt"
      FROM stock_counts sc
      JOIN ingredients i ON sc.ingredient_id = i.id
      LEFT JOIN users u ON sc.counted_by_user_id = u.id
      WHERE sc.count_date = ${date}
      ORDER BY i.name
    `;

    return successResponse(res, rows);
  } catch (error) {
    console.error('Get stock counts error:', error);
    return errorResponse(res, 'Failed to get stock counts', 500);
  }
}
