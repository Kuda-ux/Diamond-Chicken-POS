import { Response } from 'express';
import { z } from 'zod';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

const openSchema = z.object({ openingFloat: z.number().min(0) });
const closeSchema = z.object({ closingFloat: z.number().min(0) });

// POST /api/shifts/open
export async function openShift(req: AuthRequest, res: Response) {
  try {
    const { openingFloat } = openSchema.parse(req.body);
    const cashierId = req.user!.userId;

    // Check for existing open shift
    const [existing] = await sql`
      SELECT id FROM shifts WHERE cashier_id = ${cashierId} AND ended_at IS NULL
    `;
    if (existing) return errorResponse(res, 'You already have an open shift', 400);

    const [row] = await sql`
      INSERT INTO shifts (cashier_id, opening_float, started_at)
      VALUES (${cashierId}, ${openingFloat}, now())
      RETURNING id, cashier_id AS "cashierId", opening_float::float AS "openingFloat",
                started_at AS "startedAt", ended_at AS "endedAt"
    `;
    return successResponse(res, row, 'Shift opened', 201);
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(res, 'Validation error', 400, error.errors);
    console.error('Open shift error:', error);
    return errorResponse(res, 'Failed to open shift', 500);
  }
}

// GET /api/shifts/current — current open shift for this cashier (if any)
export async function getCurrentShift(req: AuthRequest, res: Response) {
  try {
    const cashierId = req.user!.userId;
    const [shift] = await sql`
      SELECT id, cashier_id AS "cashierId",
             opening_float::float AS "openingFloat",
             closing_float::float AS "closingFloat",
             started_at AS "startedAt", ended_at AS "endedAt"
      FROM shifts
      WHERE cashier_id = ${cashierId} AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `;
    return successResponse(res, shift || null);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch shift', 500);
  }
}

// POST /api/shifts/close — close shift and generate Z-report
export async function closeShift(req: AuthRequest, res: Response) {
  try {
    const { closingFloat } = closeSchema.parse(req.body);
    const cashierId = req.user!.userId;

    const [shift] = await sql`
      SELECT id, opening_float::float AS "openingFloat", started_at AS "startedAt"
      FROM shifts
      WHERE cashier_id = ${cashierId} AND ended_at IS NULL
      ORDER BY started_at DESC LIMIT 1
    `;
    if (!shift) return errorResponse(res, 'No open shift found', 400);

    await sql`
      UPDATE shifts SET closing_float = ${closingFloat}, ended_at = now()
      WHERE id = ${shift.id}
    `;

    const report = await buildZReport(shift.id, cashierId, shift.startedAt, shift.openingFloat, closingFloat);
    return successResponse(res, report, 'Shift closed');
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(res, 'Validation error', 400, error.errors);
    console.error('Close shift error:', error);
    return errorResponse(res, 'Failed to close shift', 500);
  }
}

// GET /api/shifts/:id/z-report — fetch Z-report for a shift
export async function getZReport(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const [shift] = await sql`
      SELECT id, cashier_id AS "cashierId",
             opening_float::float AS "openingFloat",
             closing_float::float AS "closingFloat",
             started_at AS "startedAt", ended_at AS "endedAt"
      FROM shifts WHERE id = ${id}
    `;
    if (!shift) return errorResponse(res, 'Shift not found', 404);

    const report = await buildZReport(
      shift.id,
      shift.cashierId,
      shift.startedAt,
      shift.openingFloat,
      shift.closingFloat,
      shift.endedAt
    );
    return successResponse(res, report);
  } catch (error) {
    console.error('Z-report error:', error);
    return errorResponse(res, 'Failed to fetch Z-report', 500);
  }
}

async function buildZReport(
  shiftId: string,
  cashierId: string,
  startedAt: Date,
  openingFloat: number,
  closingFloat: number | null,
  endedAt?: Date
) {
  const endClause = endedAt ? endedAt : new Date();

  const [totals] = await sql`
    SELECT
      COUNT(*)::int AS "transactionCount",
      COALESCE(SUM(total_amount),0)::float AS "totalRevenue",
      COALESCE(SUM(tax_amount),0)::float AS "totalVat",
      COALESCE(SUM(discount_amount),0)::float AS "totalDiscount"
    FROM orders
    WHERE cashier_id = ${cashierId}
      AND created_at >= ${startedAt}
      AND created_at <= ${endClause}
      AND status != 'cancelled'
      AND payment_status = 'paid'
  `;

  const paymentBreakdown = await sql`
    SELECT
      COALESCE(payment_method,'unpaid') AS method,
      COUNT(*)::int AS count,
      COALESCE(SUM(total_amount),0)::float AS revenue
    FROM orders
    WHERE cashier_id = ${cashierId}
      AND created_at >= ${startedAt}
      AND created_at <= ${endClause}
      AND status != 'cancelled'
      AND payment_status = 'paid'
    GROUP BY payment_method
    ORDER BY revenue DESC
  `;

  const [cashier] = await sql`SELECT name FROM users WHERE id = ${cashierId}`;

  const cashTakings = paymentBreakdown.find((p: any) => p.method === 'cash')?.revenue || 0;
  const expectedCash = openingFloat + cashTakings;
  const variance = closingFloat !== null ? closingFloat - expectedCash : null;

  return {
    shiftId,
    cashierName: cashier?.name,
    startedAt,
    endedAt: endedAt || null,
    openingFloat,
    closingFloat,
    expectedCash,
    variance,
    totals,
    paymentBreakdown,
  };
}
