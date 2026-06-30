import { Response } from 'express';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// Local timezone for the business (Zimbabwe is UTC+2, no DST)
const TZ = 'Africa/Harare';

// Resolve a date range from query params -> [fromUtc, toUtc] (both Date objects)
function resolveRange(req: AuthRequest): { from: Date; to: Date; label: string } {
  const range = String(req.query.range || 'today');
  const customFrom = req.query.from ? new Date(String(req.query.from)) : null;
  const customTo = req.query.to ? new Date(String(req.query.to)) : null;

  // "Now" in the business timezone (we use a Date offset trick).
  // Simpler: compute days off the JS Date in UTC and shift +2h for Harare.
  const TZ_OFFSET_MIN = 120; // Harare is UTC+02:00, no DST
  const nowUtcMs = Date.now();
  const localNow = new Date(nowUtcMs + TZ_OFFSET_MIN * 60 * 1000);
  // Local "midnight today" expressed back as UTC instant
  const localY = localNow.getUTCFullYear();
  const localM = localNow.getUTCMonth();
  const localD = localNow.getUTCDate();
  const startOfLocalDayUtc = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m, d, 0, 0, 0) - TZ_OFFSET_MIN * 60 * 1000);

  const startOfToday = startOfLocalDayUtc(localY, localM, localD);
  const startOfTomorrow = startOfLocalDayUtc(localY, localM, localD + 1);
  const startOfYesterday = startOfLocalDayUtc(localY, localM, localD - 1);
  // Week starts on Monday
  const dow = (localNow.getUTCDay() + 6) % 7; // 0=Mon
  const startOfWeek = startOfLocalDayUtc(localY, localM, localD - dow);
  const startOfMonth = startOfLocalDayUtc(localY, localM, 1);

  switch (range) {
    case 'yesterday':
      return { from: startOfYesterday, to: startOfToday, label: 'Yesterday' };
    case 'week':
      return { from: startOfWeek, to: startOfTomorrow, label: 'This week' };
    case 'month':
      return { from: startOfMonth, to: startOfTomorrow, label: 'This month' };
    case 'custom':
      if (customFrom && customTo) return { from: customFrom, to: customTo, label: 'Custom' };
      return { from: startOfToday, to: startOfTomorrow, label: 'Today' };
    case 'today':
    default:
      return { from: startOfToday, to: startOfTomorrow, label: 'Today' };
  }
}

// GET /api/stats/dashboard — aggregated stats for the owner dashboard
// Query params: range=today|yesterday|week|month|custom&from=ISO&to=ISO
export async function getDashboardStats(req: AuthRequest, res: Response) {
  try {
    const { from, to, label } = resolveRange(req);

    // ===== HEADLINE SUMMARY =====
    // Gross orders count (everything in window, not cancelled)
    // Paid revenue = the real money taken (this is what finance cares about)
    const [summaryRow] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status != 'cancelled')::int AS "totalOrders",
        COUNT(*) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid')::int AS "paidOrders",
        COUNT(*) FILTER (WHERE status != 'cancelled' AND payment_status != 'paid')::int AS "unpaidOrders",
        COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid'), 0)::float AS "totalRevenue",
        COALESCE(SUM(tax_amount)   FILTER (WHERE status != 'cancelled' AND payment_status = 'paid'), 0)::float AS "totalTax",
        COALESCE(SUM(discount_amount) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid'), 0)::float AS "totalDiscount",
        COALESCE(AVG(total_amount) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid'), 0)::float AS "averageOrderValue",
        COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled' AND payment_status != 'paid'), 0)::float AS "outstandingRevenue"
      FROM orders
      WHERE created_at >= ${from} AND created_at < ${to}
    `;

    // Items sold (paid only)
    const [itemsRow] = await sql`
      SELECT COALESCE(SUM(oi.quantity), 0)::int AS "totalItems"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ${from} AND o.created_at < ${to}
        AND o.status != 'cancelled'
        AND o.payment_status = 'paid'
    `;

    // ===== HOURLY REVENUE (local hours) =====
    const hourlyRevenue = await sql`
      SELECT
        EXTRACT(HOUR FROM (created_at AT TIME ZONE ${TZ}))::int AS hour,
        COUNT(*)::int AS orders,
        COALESCE(SUM(total_amount), 0)::float AS revenue
      FROM orders
      WHERE created_at >= ${from} AND created_at < ${to}
        AND status != 'cancelled'
        AND payment_status = 'paid'
      GROUP BY hour
      ORDER BY hour
    `;

    // ===== PAYMENT METHOD BREAKDOWN (paid only) =====
    const paymentBreakdown = await sql`
      SELECT
        COALESCE(payment_method, 'unpaid') AS method,
        COUNT(*)::int AS count,
        COALESCE(SUM(total_amount), 0)::float AS revenue
      FROM orders
      WHERE created_at >= ${from} AND created_at < ${to}
        AND status != 'cancelled'
        AND payment_status = 'paid'
      GROUP BY payment_method
      ORDER BY revenue DESC
    `;

    // ===== PER-CASHIER PERFORMANCE =====
    const cashierBreakdown = await sql`
      SELECT
        u.id,
        u.name,
        u.role,
        COUNT(o.id)::int AS "orders",
        COALESCE(SUM(o.total_amount), 0)::float AS "revenue",
        COALESCE(AVG(o.total_amount), 0)::float AS "averageOrder"
      FROM orders o
      JOIN users u ON o.cashier_id = u.id
      WHERE o.created_at >= ${from} AND o.created_at < ${to}
        AND o.status != 'cancelled'
        AND o.payment_status = 'paid'
      GROUP BY u.id, u.name, u.role
      ORDER BY revenue DESC
    `;

    // ===== TOP-SELLING ITEMS =====
    const topItems = await sql`
      SELECT
        m.id,
        m.name,
        SUM(oi.quantity)::int AS "unitsSold",
        COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float AS "revenue"
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ${from} AND o.created_at < ${to}
        AND o.status != 'cancelled'
        AND o.payment_status = 'paid'
      GROUP BY m.id, m.name
      ORDER BY "unitsSold" DESC
      LIMIT 8
    `;

    // ===== SHIFTS WITHIN THE WINDOW =====
    // Show every shift that overlaps the range, with their per-shift totals.
    const shifts = await sql`
      SELECT
        s.id,
        s.started_at AS "startedAt",
        s.ended_at AS "endedAt",
        s.opening_float::float AS "openingFloat",
        s.closing_float::float AS "closingFloat",
        u.name AS "cashierName",
        COALESCE((
          SELECT SUM(total_amount)::float FROM orders
          WHERE cashier_id = s.cashier_id
            AND created_at >= s.started_at
            AND (s.ended_at IS NULL OR created_at <= s.ended_at)
            AND status != 'cancelled'
            AND payment_status = 'paid'
        ), 0) AS "totalRevenue",
        COALESCE((
          SELECT SUM(total_amount)::float FROM orders
          WHERE cashier_id = s.cashier_id
            AND created_at >= s.started_at
            AND (s.ended_at IS NULL OR created_at <= s.ended_at)
            AND status != 'cancelled'
            AND payment_status = 'paid'
            AND payment_method = 'cash'
        ), 0) AS "cashRevenue",
        COALESCE((
          SELECT COUNT(*)::int FROM orders
          WHERE cashier_id = s.cashier_id
            AND created_at >= s.started_at
            AND (s.ended_at IS NULL OR created_at <= s.ended_at)
            AND status != 'cancelled'
            AND payment_status = 'paid'
        ), 0) AS "transactionCount"
      FROM shifts s
      JOIN users u ON s.cashier_id = u.id
      WHERE s.started_at < ${to}
        AND (s.ended_at IS NULL OR s.ended_at >= ${from})
      ORDER BY s.started_at DESC
    `;

    // ===== RECENT ORDERS =====
    const recentOrders = await sql`
      SELECT
        o.id,
        o.order_number AS "orderNumber",
        o.status,
        o.order_type AS "orderType",
        o.total_amount::float AS "totalAmount",
        o.payment_method AS "paymentMethod",
        o.payment_status AS "paymentStatus",
        o.created_at AS "createdAt",
        u.name AS "cashierName",
        (SELECT COALESCE(SUM(quantity),0)::int FROM order_items WHERE order_id = o.id) AS "itemCount"
      FROM orders o
      LEFT JOIN users u ON o.cashier_id = u.id
      WHERE o.created_at >= ${from} AND o.created_at < ${to}
      ORDER BY o.created_at DESC
      LIMIT 15
    `;

    // ===== LOW STOCK ALERTS (always current, not windowed) =====
    const lowStock = await sql`
      SELECT
        m.id,
        m.name,
        i.quantity::int AS quantity,
        i.low_stock_threshold::int AS "threshold"
      FROM inventory i
      JOIN menu_items m ON i.menu_item_id = m.id
      WHERE i.quantity <= i.low_stock_threshold
      ORDER BY i.quantity ASC
      LIMIT 20
    `;

    return successResponse(res, {
      range: { from, to, label },
      summary: { ...summaryRow, totalItems: itemsRow.totalItems },
      hourlyRevenue,
      paymentBreakdown,
      cashierBreakdown,
      topItems,
      shifts,
      recentOrders,
      lowStock,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return errorResponse(res, 'Failed to fetch stats', 500);
  }
}

// GET /api/stats/daily-report?date=YYYY-MM-DD
// GET /api/stats/daily-report?from=YYYY-MM-DD&to=YYYY-MM-DD  (inclusive range)
// Returns everything needed for a downloadable daily/range PDF report
export async function getDailyReport(req: AuthRequest, res: Response) {
  try {
    const TZ_OFFSET_MIN = 120;
    const fromParam = req.query.from as string | undefined;
    const toParam   = req.query.to   as string | undefined;
    const dateParam = String(req.query.date || new Date().toISOString().slice(0, 10));

    let from: Date, to: Date, displayDate: string;

    if (fromParam && toParam) {
      // Range mode
      const [fy, fm, fd] = fromParam.split('-').map(Number);
      const [ty, tm, td] = toParam.split('-').map(Number);
      from = new Date(Date.UTC(fy, fm - 1, fd, 0, 0, 0) - TZ_OFFSET_MIN * 60 * 1000);
      to   = new Date(Date.UTC(ty, tm - 1, td + 1, 0, 0, 0) - TZ_OFFSET_MIN * 60 * 1000);
      displayDate = `${fromParam} to ${toParam}`;
    } else {
      // Single date mode (existing behaviour)
      const [y, m, d] = dateParam.split('-').map(Number);
      from = new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - TZ_OFFSET_MIN * 60 * 1000);
      to   = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0) - TZ_OFFSET_MIN * 60 * 1000);
      displayDate = dateParam;
    }

    // Sales summary
    const [summary] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE status != 'cancelled')::int AS "totalOrders",
        COUNT(*) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid')::int AS "paidOrders",
        COALESCE(SUM(total_amount) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid'), 0)::float AS "totalRevenue",
        COALESCE(SUM(tax_amount) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid'), 0)::float AS "totalTax",
        COALESCE(SUM(discount_amount) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid'), 0)::float AS "totalDiscount",
        COALESCE(AVG(total_amount) FILTER (WHERE status != 'cancelled' AND payment_status = 'paid'), 0)::float AS "averageOrderValue"
      FROM orders
      WHERE created_at >= ${from} AND created_at < ${to}
    `;

    // Payment methods breakdown
    const paymentMethods = await sql`
      SELECT
        COALESCE(payment_method, 'unpaid') AS method,
        COUNT(*)::int AS count,
        COALESCE(SUM(total_amount), 0)::float AS revenue
      FROM orders
      WHERE created_at >= ${from} AND created_at < ${to}
        AND status != 'cancelled' AND payment_status = 'paid'
      GROUP BY payment_method
      ORDER BY revenue DESC
    `;

    // Products sold breakdown (all menu items sold that day)
    const productsSold = await sql`
      SELECT
        m.name,
        SUM(oi.quantity)::int AS "quantitySold",
        COALESCE(SUM(oi.quantity * oi.unit_price), 0)::float AS revenue
      FROM order_items oi
      JOIN menu_items m ON oi.menu_item_id = m.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at >= ${from} AND o.created_at < ${to}
        AND o.status != 'cancelled' AND o.payment_status = 'paid'
      GROUP BY m.id, m.name
      ORDER BY "quantitySold" DESC
    `;

    // Current stock levels (ingredients)
    const stockLevels = await sql`
      SELECT
        name,
        unit,
        quantity::float AS quantity,
        low_stock_threshold::float AS "lowStockThreshold",
        COALESCE(unit_cost, 0)::float AS "unitCost"
      FROM ingredients
      WHERE is_active = TRUE
      ORDER BY name
    `;

    // Waste for the period
    const wasteFrom = fromParam || dateParam;
    const wasteTo   = toParam   || dateParam;
    const waste = await sql`
      SELECT
        i.name AS "ingredientName",
        i.unit,
        SUM(w.quantity)::float AS "totalWasted",
        COALESCE(i.unit_cost, 0)::float AS "unitCost",
        (SUM(w.quantity) * COALESCE(i.unit_cost, 0))::float AS "wasteCost"
      FROM waste_records w
      JOIN ingredients i ON w.ingredient_id = i.id
      WHERE w.recorded_at >= ${wasteFrom}::date AND w.recorded_at <= ${wasteTo}::date
      GROUP BY i.id, i.name, i.unit, i.unit_cost
      ORDER BY "wasteCost" DESC
    `;

    const totalWasteCost = waste.reduce((s: number, w: any) => s + (w.wasteCost || 0), 0);

    return successResponse(res, {
      date: displayDate,
      from: fromParam || dateParam,
      to:   toParam   || dateParam,
      isRange: !!(fromParam && toParam),
      summary,
      paymentMethods,
      productsSold,
      stockLevels,
      waste: { items: waste, totalCost: totalWasteCost },
    });
  } catch (error) {
    console.error('Daily report error:', error);
    return errorResponse(res, 'Failed to generate daily report', 500);
  }
}
