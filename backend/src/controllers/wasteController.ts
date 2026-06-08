import { Response } from 'express';
import { z } from 'zod';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// ---------------------------------------------------------------------------
// Record waste
// ---------------------------------------------------------------------------

const recordWasteSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive(),
  reason: z.string().max(500).optional(),
  recordedAt: z.string().optional(),
});

export async function recordWaste(req: AuthRequest, res: Response) {
  try {
    const data = recordWasteSchema.parse(req.body);
    const userId = req.user?.userId || null;
    const date = data.recordedAt || new Date().toISOString().slice(0, 10);

    // Verify ingredient exists
    const ing = await sql`SELECT id, name, quantity::float AS stock FROM ingredients WHERE id = ${data.ingredientId} AND is_active = TRUE`;
    if (ing.length === 0) return errorResponse(res, 'Ingredient not found', 404);

    // Record the waste
    const [record] = await sql`
      INSERT INTO waste_records (ingredient_id, quantity, reason, recorded_by_user_id, recorded_at)
      VALUES (${data.ingredientId}, ${data.quantity}, ${data.reason || null}, ${userId}, ${date})
      RETURNING id, ingredient_id AS "ingredientId", quantity::float AS quantity, reason, recorded_at AS "recordedAt"
    `;

    // Deduct from ingredient stock
    await sql`
      UPDATE ingredients
      SET quantity = GREATEST(0, quantity - ${data.quantity}),
          updated_at = now()
      WHERE id = ${data.ingredientId}
    `;

    return successResponse(res, record, 'Waste recorded');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Record waste error:', error);
    return errorResponse(res, 'Failed to record waste', 500);
  }
}

// ---------------------------------------------------------------------------
// List waste records
// ---------------------------------------------------------------------------

const listWasteSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  ingredientId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

export async function listWaste(req: AuthRequest, res: Response) {
  try {
    const { from, to, ingredientId, limit } = listWasteSchema.parse(req.query);
    const fromDate = from || '1970-01-01';
    const toDate = to || '9999-12-31';
    const itemFilter = ingredientId || null;

    const rows = await sql`
      SELECT
        w.id,
        w.ingredient_id AS "ingredientId",
        i.name AS "ingredientName",
        i.unit,
        w.quantity::float AS quantity,
        w.reason,
        w.recorded_at AS "recordedAt",
        w.created_at AS "createdAt",
        u.name AS "recordedByName"
      FROM waste_records w
      JOIN ingredients i ON w.ingredient_id = i.id
      LEFT JOIN users u ON w.recorded_by_user_id = u.id
      WHERE w.recorded_at >= ${fromDate}
        AND w.recorded_at <= ${toDate}
        AND (${itemFilter}::uuid IS NULL OR w.ingredient_id = ${itemFilter}::uuid)
      ORDER BY w.recorded_at DESC, w.created_at DESC
      LIMIT ${limit}
    `;
    return successResponse(res, rows);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('List waste error:', error);
    return errorResponse(res, 'Failed to list waste records', 500);
  }
}

// ---------------------------------------------------------------------------
// Delete waste record (admin only — reverses stock deduction)
// ---------------------------------------------------------------------------

export async function deleteWaste(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const [record] = await sql`SELECT ingredient_id, quantity FROM waste_records WHERE id = ${id}`;
    if (!record) return errorResponse(res, 'Waste record not found', 404);

    // Reverse the stock deduction
    await sql`
      UPDATE ingredients
      SET quantity = quantity + ${record.quantity},
          updated_at = now()
      WHERE id = ${record.ingredient_id}
    `;
    await sql`DELETE FROM waste_records WHERE id = ${id}`;
    return successResponse(res, null, 'Waste record reversed');
  } catch (error) {
    console.error('Delete waste error:', error);
    return errorResponse(res, 'Failed to reverse waste record', 500);
  }
}

// ---------------------------------------------------------------------------
// Daily waste summary (for reports)
// ---------------------------------------------------------------------------

export async function dailyWasteSummary(req: AuthRequest, res: Response) {
  try {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

    const rows = await sql`
      SELECT
        i.name AS "ingredientName",
        i.unit,
        SUM(w.quantity)::float AS "totalWasted",
        COALESCE(i.unit_cost, 0)::float AS "unitCost",
        (SUM(w.quantity) * COALESCE(i.unit_cost, 0))::float AS "wasteCost"
      FROM waste_records w
      JOIN ingredients i ON w.ingredient_id = i.id
      WHERE w.recorded_at = ${date}
      GROUP BY i.id, i.name, i.unit, i.unit_cost
      ORDER BY "wasteCost" DESC
    `;

    const totalCost = rows.reduce((s: number, r: any) => s + (r.wasteCost || 0), 0);
    return successResponse(res, { date, items: rows, totalCost });
  } catch (error) {
    console.error('Daily waste summary error:', error);
    return errorResponse(res, 'Failed to get waste summary', 500);
  }
}
