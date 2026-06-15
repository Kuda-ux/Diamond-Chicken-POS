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

    // Get all active ingredients
    const ingredients = await sql`
      SELECT id, name, unit, quantity::float AS "currentStock"
      FROM ingredients
      WHERE is_active = TRUE
      ORDER BY name
    `;

    const results: any[] = [];

    for (const ing of ingredients) {
      // Opening stock: from the stock_counts table for the previous day,
      // or fall back to current stock + sales + waste - purchases for that day
      const prevDay = new Date(reportDate);
      prevDay.setDate(prevDay.getDate() - 1);
      const prevDateStr = prevDay.toISOString().slice(0, 10);

      const openingCount = await sql`
        SELECT quantity::float AS quantity
        FROM stock_counts
        WHERE ingredient_id = ${ing.id} AND count_date = ${prevDateStr}
        LIMIT 1
      `;

      // Purchases for the date (from ingredient_receipts)
      const purchasesResult = await sql`
        SELECT COALESCE(SUM(quantity), 0)::float AS total
        FROM ingredient_receipts
        WHERE ingredient_id = ${ing.id} AND received_at = ${reportDate}
      `;
      const purchases = purchasesResult[0].total;

      // Sales deductions for the date (from orders + recipes)
      const salesResult = await sql`
        SELECT COALESCE(SUM(oi.quantity * r.quantity_per_unit), 0)::float AS total
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN recipes r ON r.menu_item_id = oi.menu_item_id AND r.ingredient_id = ${ing.id}
        WHERE DATE(o.created_at) = ${reportDate}::date
          AND o.status != 'cancelled'
      `;
      const sales = salesResult[0].total;

      // Wastages for the date
      const wastageResult = await sql`
        SELECT COALESCE(SUM(quantity), 0)::float AS total
        FROM waste_records
        WHERE ingredient_id = ${ing.id} AND recorded_at = ${reportDate}
      `;
      const wastage = wastageResult[0].total;

      // Transfers (not implemented yet — placeholder)
      const transfers = 0;

      // Opening stock: if we have a physical count for previous day, use it.
      // Otherwise derive: current stock is the result of all movements up to now,
      // so opening = current + sales + waste + transfers - purchases (for today only if report is today)
      let openingStock: number;
      if (openingCount.length > 0) {
        openingStock = openingCount[0].quantity;
      } else {
        // If reporting on today: opening = current + today's sales + waste - purchases
        const today = new Date().toISOString().slice(0, 10);
        if (reportDate === today) {
          openingStock = ing.currentStock + sales + wastage + transfers - purchases;
        } else {
          // For past dates without a count, we can't reliably determine opening
          // Use 0 as fallback (user should do physical counts)
          openingStock = 0;
        }
      }

      // Theoretical closing stock
      const theoreticalClosing = openingStock + purchases - sales - wastage - transfers;

      // Actual closing: from stock_counts for this date, or current stock if today
      const actualCountResult = await sql`
        SELECT quantity::float AS quantity
        FROM stock_counts
        WHERE ingredient_id = ${ing.id} AND count_date = ${reportDate}
        LIMIT 1
      `;

      const today = new Date().toISOString().slice(0, 10);
      let actualClosing: number | null = null;
      if (actualCountResult.length > 0) {
        actualClosing = actualCountResult[0].quantity;
      } else if (reportDate === today) {
        actualClosing = ing.currentStock;
      }

      // Variance = Theoretical - Actual (positive = shortage, negative = surplus)
      const variance = actualClosing !== null ? theoreticalClosing - actualClosing : null;

      results.push({
        ingredientId: ing.id,
        name: ing.name,
        unit: ing.unit,
        openingStock: Math.round(openingStock * 1000) / 1000,
        purchases: Math.round(purchases * 1000) / 1000,
        sales: Math.round(sales * 1000) / 1000,
        wastage: Math.round(wastage * 1000) / 1000,
        transfers,
        theoreticalClosing: Math.round(theoreticalClosing * 1000) / 1000,
        actualClosing: actualClosing !== null ? Math.round(actualClosing * 1000) / 1000 : null,
        variance: variance !== null ? Math.round(variance * 1000) / 1000 : null,
      });
    }

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
