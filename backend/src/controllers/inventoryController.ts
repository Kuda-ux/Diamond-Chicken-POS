import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// GET /api/inventory — list all inventory entries
export async function listInventory(_req: AuthRequest, res: Response) {
  try {
    const rows = await sql`
      SELECT
        i.id,
        i.menu_item_id AS "menuItemId",
        m.name,
        m.price::float AS price,
        c.name AS "categoryName",
        i.quantity::int AS quantity,
        i.low_stock_threshold::int AS "lowStockThreshold",
        i.unit,
        i.last_updated AS "lastUpdated"
      FROM inventory i
      JOIN menu_items m ON i.menu_item_id = m.id
      LEFT JOIN categories c ON m.category_id = c.id
      ORDER BY c.sort_order, m.sort_order, m.name
    `;
    return successResponse(res, rows);
  } catch (error) {
    console.error('List inventory error:', error);
    return errorResponse(res, 'Failed to list inventory', 500);
  }
}

const restockSchema = z.object({
  quantity: z.number().int(),
  mode: z.enum(['add', 'set']).optional().default('add'),
  lowStockThreshold: z.number().int().min(0).optional(),
});

// POST /api/inventory/:menuItemId/restock — add or set stock
export async function restockItem(req: AuthRequest, res: Response) {
  try {
    const { menuItemId } = req.params;
    const { quantity, mode, lowStockThreshold } = restockSchema.parse(req.body);

    const existing = await sql`
      SELECT id, quantity FROM inventory WHERE menu_item_id = ${menuItemId}
    `;

    if (existing.length === 0) {
      // Create if missing
      await sql`
        INSERT INTO inventory (menu_item_id, quantity, low_stock_threshold)
        VALUES (${menuItemId}, ${Math.max(0, quantity)}, ${lowStockThreshold ?? 10})
      `;
    } else {
      const newQty = mode === 'set' ? quantity : (existing[0].quantity + quantity);
      await sql`
        UPDATE inventory
        SET quantity = ${Math.max(0, newQty)},
            low_stock_threshold = COALESCE(${lowStockThreshold ?? null}, low_stock_threshold),
            last_updated = now()
        WHERE menu_item_id = ${menuItemId}
      `;
    }

    const [updated] = await sql`
      SELECT
        m.id AS "menuItemId",
        m.name,
        i.quantity::int AS quantity,
        i.low_stock_threshold::int AS "lowStockThreshold"
      FROM inventory i
      JOIN menu_items m ON i.menu_item_id = m.id
      WHERE i.menu_item_id = ${menuItemId}
    `;

    return successResponse(res, updated, 'Stock updated');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Restock error:', error);
    return errorResponse(res, 'Failed to restock', 500);
  }
}

/* ==========================================================================
   STOCK RECEIPTS (weekly goods-received batches)
   ========================================================================== */

const receiptItemSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative().optional(),
});

const createReceiptsSchema = z.object({
  receivedAt: z.string().optional(), // YYYY-MM-DD; defaults to today
  supplier: z.string().max(150).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(receiptItemSchema).min(1),
});

// POST /api/inventory/receipts — record a batch of stock received
export async function createStockReceipts(req: AuthRequest, res: Response) {
  try {
    const { receivedAt, supplier, notes, items } = createReceiptsSchema.parse(req.body);
    const userId = req.user?.userId || null;
    const batchId = randomUUID();
    const date = receivedAt || new Date().toISOString().slice(0, 10);

    // Verify all menu items exist + ensure inventory rows exist (no transactions in neon-http,
    // but each statement is still atomic at the row level)
    for (const it of items) {
      const exists = await sql`SELECT 1 FROM menu_items WHERE id = ${it.menuItemId}`;
      if (exists.length === 0) {
        return errorResponse(res, `Menu item not found: ${it.menuItemId}`, 400);
      }
    }

    const created: any[] = [];
    for (const it of items) {
      // Insert receipt log
      const [receipt] = await sql`
        INSERT INTO stock_receipts
          (menu_item_id, quantity, received_at, received_by_user_id, supplier, unit_cost, notes, batch_id)
        VALUES
          (${it.menuItemId}, ${it.quantity}, ${date}, ${userId}, ${supplier || null}, ${it.unitCost || null}, ${notes || null}, ${batchId})
        RETURNING id
      `;

      // Increment inventory atomically (upsert)
      await sql`
        INSERT INTO inventory (menu_item_id, quantity, low_stock_threshold)
        VALUES (${it.menuItemId}, ${it.quantity}, 10)
        ON CONFLICT (menu_item_id)
        DO UPDATE SET quantity = inventory.quantity + ${it.quantity}, last_updated = now()
      `;
      created.push({ receiptId: receipt.id, menuItemId: it.menuItemId, quantity: it.quantity });
    }

    return successResponse(res, { batchId, receivedAt: date, supplier, count: created.length, items: created }, 'Stock received');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Create stock receipts error:', error);
    return errorResponse(res, 'Failed to record stock receipt', 500);
  }
}

const listReceiptsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  menuItemId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

// GET /api/inventory/receipts — list receipts (newest first)
export async function listStockReceipts(req: AuthRequest, res: Response) {
  try {
    const { from, to, menuItemId, limit } = listReceiptsSchema.parse(req.query);

    const fromDate = from || '1970-01-01';
    const toDate = to || '9999-12-31';
    const itemFilter = menuItemId || null;

    const rows = await sql`
      SELECT
        sr.id,
        sr.menu_item_id AS "menuItemId",
        m.name AS "itemName",
        sr.quantity::int AS quantity,
        sr.received_at AS "receivedAt",
        sr.supplier,
        sr.unit_cost::float AS "unitCost",
        sr.notes,
        sr.batch_id AS "batchId",
        sr.created_at AS "createdAt",
        u.name AS "receivedByName"
      FROM stock_receipts sr
      JOIN menu_items m ON sr.menu_item_id = m.id
      LEFT JOIN users u ON sr.received_by_user_id = u.id
      WHERE sr.received_at >= ${fromDate}
        AND sr.received_at <= ${toDate}
        AND (${itemFilter}::uuid IS NULL OR sr.menu_item_id = ${itemFilter}::uuid)
      ORDER BY sr.received_at DESC, sr.created_at DESC
      LIMIT ${limit}
    `;

    return successResponse(res, rows);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('List stock receipts error:', error);
    return errorResponse(res, 'Failed to list stock receipts', 500);
  }
}

// GET /api/inventory/receipts/summary — weekly totals
export async function stockReceiptsSummary(_req: AuthRequest, res: Response) {
  try {
    const rows = await sql`
      SELECT
        date_trunc('week', received_at)::date AS "weekStart",
        COUNT(*)::int AS "receiptCount",
        SUM(quantity)::int AS "totalQuantity",
        SUM(quantity * COALESCE(unit_cost, 0))::float AS "totalValue"
      FROM stock_receipts
      WHERE received_at >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY 1
      ORDER BY 1 DESC
    `;
    return successResponse(res, rows);
  } catch (error) {
    console.error('Stock receipts summary error:', error);
    return errorResponse(res, 'Failed to load summary', 500);
  }
}

// DELETE /api/inventory/receipts/:id — reverse a receipt (admin only)
export async function deleteStockReceipt(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const [receipt] = await sql`
      SELECT menu_item_id, quantity FROM stock_receipts WHERE id = ${id}
    `;
    if (!receipt) return errorResponse(res, 'Receipt not found', 404);

    // Reverse inventory increment, never below 0
    await sql`
      UPDATE inventory
      SET quantity = GREATEST(0, quantity - ${receipt.quantity}),
          last_updated = now()
      WHERE menu_item_id = ${receipt.menu_item_id}
    `;
    await sql`DELETE FROM stock_receipts WHERE id = ${id}`;
    return successResponse(res, null, 'Receipt reversed');
  } catch (error) {
    console.error('Delete stock receipt error:', error);
    return errorResponse(res, 'Failed to reverse receipt', 500);
  }
}
