import { Response } from 'express';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listIngredients(_req: AuthRequest, res: Response) {
  try {
    const rows = await sql`
      SELECT
        id,
        name,
        unit,
        quantity::float AS quantity,
        low_stock_threshold::float AS "lowStockThreshold",
        unit_cost::float AS "unitCost",
        notes,
        is_active AS "isActive",
        updated_at AS "updatedAt"
      FROM ingredients
      WHERE is_active = TRUE
      ORDER BY name ASC
    `;
    return successResponse(res, rows);
  } catch (error) {
    console.error('List ingredients error:', error);
    return errorResponse(res, 'Failed to list ingredients', 500);
  }
}

const createSchema = z.object({
  name: z.string().min(1).max(120),
  unit: z.string().min(1).max(20).default('pcs'),
  quantity: z.number().nonnegative().optional().default(0),
  lowStockThreshold: z.number().nonnegative().optional().default(10),
  unitCost: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

export async function createIngredient(req: AuthRequest, res: Response) {
  try {
    const data = createSchema.parse(req.body);
    const [row] = await sql`
      INSERT INTO ingredients (name, unit, quantity, low_stock_threshold, unit_cost, notes)
      VALUES (${data.name}, ${data.unit}, ${data.quantity}, ${data.lowStockThreshold}, ${data.unitCost ?? null}, ${data.notes || null})
      ON CONFLICT (name) DO UPDATE SET is_active = TRUE
      RETURNING id, name, unit, quantity::float AS quantity,
                low_stock_threshold::float AS "lowStockThreshold",
                unit_cost::float AS "unitCost", notes, is_active AS "isActive"
    `;
    return successResponse(res, row, 'Ingredient created', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Create ingredient error:', error);
    return errorResponse(res, 'Failed to create ingredient', 500);
  }
}

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  unit: z.string().min(1).max(20).optional(),
  lowStockThreshold: z.number().nonnegative().optional(),
  unitCost: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

export async function updateIngredient(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const data = updateSchema.parse(req.body);
    const [row] = await sql`
      UPDATE ingredients
      SET name = COALESCE(${data.name ?? null}, name),
          unit = COALESCE(${data.unit ?? null}, unit),
          low_stock_threshold = COALESCE(${data.lowStockThreshold ?? null}, low_stock_threshold),
          unit_cost = COALESCE(${data.unitCost ?? null}, unit_cost),
          notes = COALESCE(${data.notes ?? null}, notes),
          updated_at = now()
      WHERE id = ${id} AND is_active = TRUE
      RETURNING id, name, unit, quantity::float AS quantity,
                low_stock_threshold::float AS "lowStockThreshold",
                unit_cost::float AS "unitCost", notes
    `;
    if (!row) return errorResponse(res, 'Ingredient not found', 404);
    return successResponse(res, row, 'Ingredient updated');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Update ingredient error:', error);
    return errorResponse(res, 'Failed to update ingredient', 500);
  }
}

export async function deleteIngredient(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    // Soft-delete (preserve history). Reject if used in any active recipe.
    const usage = await sql`SELECT COUNT(*)::int AS c FROM recipes WHERE ingredient_id = ${id}`;
    if (usage[0].c > 0) {
      return errorResponse(res, `Ingredient is used in ${usage[0].c} recipe(s). Remove from recipes first.`, 400);
    }
    await sql`UPDATE ingredients SET is_active = FALSE, updated_at = now() WHERE id = ${id}`;
    return successResponse(res, null, 'Ingredient deleted');
  } catch (error) {
    console.error('Delete ingredient error:', error);
    return errorResponse(res, 'Failed to delete ingredient', 500);
  }
}

// ---------------------------------------------------------------------------
// Restock (manual adjust)
// ---------------------------------------------------------------------------

const restockSchema = z.object({
  quantity: z.number(),
  mode: z.enum(['add', 'set']).optional().default('add'),
  lowStockThreshold: z.number().nonnegative().optional(),
});

export async function restockIngredient(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { quantity, mode, lowStockThreshold } = restockSchema.parse(req.body);

    const existing = await sql`SELECT quantity FROM ingredients WHERE id = ${id} AND is_active = TRUE`;
    if (existing.length === 0) return errorResponse(res, 'Ingredient not found', 404);

    const current = parseFloat(existing[0].quantity);
    const newQty = mode === 'set' ? quantity : current + quantity;

    const [row] = await sql`
      UPDATE ingredients
      SET quantity = GREATEST(0, ${newQty}),
          low_stock_threshold = COALESCE(${lowStockThreshold ?? null}, low_stock_threshold),
          updated_at = now()
      WHERE id = ${id}
      RETURNING id, name, quantity::float AS quantity,
                low_stock_threshold::float AS "lowStockThreshold"
    `;
    return successResponse(res, row, 'Stock updated');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Restock ingredient error:', error);
    return errorResponse(res, 'Failed to restock ingredient', 500);
  }
}

// ---------------------------------------------------------------------------
// Ingredient receipts (audit-trailed deliveries)
// ---------------------------------------------------------------------------

const receiptItemSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
});

const createReceiptsSchema = z.object({
  receivedAt: z.string().optional(),
  supplier: z.string().max(150).optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(receiptItemSchema).min(1),
});

export async function createIngredientReceipts(req: AuthRequest, res: Response) {
  try {
    const { receivedAt, supplier, notes, items } = createReceiptsSchema.parse(req.body);
    const userId = req.user?.userId || null;
    const batchId = randomUUID();
    const date = receivedAt || new Date().toISOString().slice(0, 10);

    // Verify all ingredients exist
    for (const it of items) {
      const exists = await sql`SELECT 1 FROM ingredients WHERE id = ${it.ingredientId} AND is_active = TRUE`;
      if (exists.length === 0) {
        return errorResponse(res, `Ingredient not found: ${it.ingredientId}`, 400);
      }
    }

    const created: any[] = [];
    for (const it of items) {
      const [receipt] = await sql`
        INSERT INTO ingredient_receipts
          (ingredient_id, quantity, received_at, received_by_user_id, supplier, unit_cost, notes, batch_id)
        VALUES
          (${it.ingredientId}, ${it.quantity}, ${date}, ${userId}, ${supplier || null}, ${it.unitCost || null}, ${notes || null}, ${batchId})
        RETURNING id
      `;

      await sql`
        UPDATE ingredients
        SET quantity = quantity + ${it.quantity},
            unit_cost = COALESCE(${it.unitCost ?? null}, unit_cost),
            updated_at = now()
        WHERE id = ${it.ingredientId}
      `;
      created.push({ receiptId: receipt.id, ingredientId: it.ingredientId, quantity: it.quantity });
    }

    return successResponse(res, { batchId, receivedAt: date, supplier, count: created.length, items: created }, 'Ingredients received');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Create ingredient receipts error:', error);
    return errorResponse(res, 'Failed to record ingredient receipt', 500);
  }
}

const listReceiptsSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  ingredientId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

export async function listIngredientReceipts(req: AuthRequest, res: Response) {
  try {
    const { from, to, ingredientId, limit } = listReceiptsSchema.parse(req.query);
    const fromDate = from || '1970-01-01';
    const toDate = to || '9999-12-31';
    const itemFilter = ingredientId || null;

    const rows = await sql`
      SELECT
        ir.id,
        ir.ingredient_id AS "ingredientId",
        ing.name AS "ingredientName",
        ing.unit,
        ir.quantity::float AS quantity,
        ir.received_at AS "receivedAt",
        ir.supplier,
        ir.unit_cost::float AS "unitCost",
        ir.notes,
        ir.batch_id AS "batchId",
        ir.created_at AS "createdAt",
        u.name AS "receivedByName"
      FROM ingredient_receipts ir
      JOIN ingredients ing ON ir.ingredient_id = ing.id
      LEFT JOIN users u ON ir.received_by_user_id = u.id
      WHERE ir.received_at >= ${fromDate}
        AND ir.received_at <= ${toDate}
        AND (${itemFilter}::uuid IS NULL OR ir.ingredient_id = ${itemFilter}::uuid)
      ORDER BY ir.received_at DESC, ir.created_at DESC
      LIMIT ${limit}
    `;
    return successResponse(res, rows);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('List ingredient receipts error:', error);
    return errorResponse(res, 'Failed to list ingredient receipts', 500);
  }
}

export async function deleteIngredientReceipt(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const [receipt] = await sql`
      SELECT ingredient_id, quantity FROM ingredient_receipts WHERE id = ${id}
    `;
    if (!receipt) return errorResponse(res, 'Receipt not found', 404);

    await sql`
      UPDATE ingredients
      SET quantity = GREATEST(0, quantity - ${receipt.quantity}),
          updated_at = now()
      WHERE id = ${receipt.ingredient_id}
    `;
    await sql`DELETE FROM ingredient_receipts WHERE id = ${id}`;
    return successResponse(res, null, 'Receipt reversed');
  } catch (error) {
    console.error('Delete ingredient receipt error:', error);
    return errorResponse(res, 'Failed to reverse receipt', 500);
  }
}
