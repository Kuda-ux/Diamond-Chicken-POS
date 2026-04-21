import { Response } from 'express';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';

// GET /api/stats/dashboard — aggregated stats for manager dashboard
export async function getDashboardStats(_req: AuthRequest, res: Response) {
  try {
    // Overall today summary
    const [summaryRow] = await sql`
      SELECT
        COUNT(*)::int AS "totalOrders",
        COALESCE(SUM(total_amount), 0)::float AS "totalRevenue",
        COALESCE(SUM(tax_amount), 0)::float AS "totalTax",
        COALESCE(AVG(total_amount), 0)::float AS "averageOrderValue"
      FROM orders
      WHERE DATE(created_at) = CURRENT_DATE
        AND status != 'cancelled'
    `;

    // Items sold today
    const [itemsRow] = await sql`
      SELECT COALESCE(SUM(oi.quantity), 0)::int AS "totalItems"
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = CURRENT_DATE
        AND o.status != 'cancelled'
    `;

    // Hourly revenue (last 24h)
    const hourlyRevenue = await sql`
      SELECT
        EXTRACT(HOUR FROM created_at)::int AS hour,
        COUNT(*)::int AS orders,
        COALESCE(SUM(total_amount), 0)::float AS revenue
      FROM orders
      WHERE DATE(created_at) = CURRENT_DATE
        AND status != 'cancelled'
      GROUP BY hour
      ORDER BY hour
    `;

    // Payment method breakdown (today)
    const paymentBreakdown = await sql`
      SELECT
        COALESCE(payment_method, 'unpaid') AS method,
        COUNT(*)::int AS count,
        COALESCE(SUM(total_amount), 0)::float AS revenue
      FROM orders
      WHERE DATE(created_at) = CURRENT_DATE
        AND status != 'cancelled'
      GROUP BY payment_method
      ORDER BY revenue DESC
    `;

    // Recent orders (last 10) w/ cashier name + item count
    const recentOrders = await sql`
      SELECT
        o.id,
        o.order_number AS "orderNumber",
        o.status,
        o.order_type AS "orderType",
        o.total_amount::float AS "totalAmount",
        o.payment_method AS "paymentMethod",
        o.created_at AS "createdAt",
        u.name AS "cashierName",
        (SELECT COALESCE(SUM(quantity),0)::int FROM order_items WHERE order_id = o.id) AS "itemCount"
      FROM orders o
      LEFT JOIN users u ON o.cashier_id = u.id
      ORDER BY o.created_at DESC
      LIMIT 10
    `;

    // Low stock alerts
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
      summary: { ...summaryRow, totalItems: itemsRow.totalItems },
      hourlyRevenue,
      paymentBreakdown,
      recentOrders,
      lowStock,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return errorResponse(res, 'Failed to fetch stats', 500);
  }
}
