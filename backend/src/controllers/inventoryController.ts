import { Response } from 'express';
import { z } from 'zod';
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
