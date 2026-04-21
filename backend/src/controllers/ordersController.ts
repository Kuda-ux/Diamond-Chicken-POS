import { Response } from 'express';
import { z } from 'zod';
import Decimal from 'decimal.js';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { io } from '../server';

const createOrderSchema = z.object({
  orderType: z.enum(['dine_in', 'takeaway', 'delivery']),
  tableNumber: z.string().optional(),
  items: z.array(z.object({
    menuItemId: z.string().uuid(),
    quantity: z.number().int().positive(),
    modifiers: z.record(z.any()).optional(),
  })).min(1),
  discountAmount: z.number().min(0).optional(),
  notes: z.string().optional(),
});

async function generateOrderNumber(): Promise<string> {
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const result = await sql`
    SELECT COUNT(*) as count FROM orders 
    WHERE DATE(created_at) = CURRENT_DATE
  `;
  const count = parseInt(result[0].count) + 1;
  return `DC-${today.slice(-4)}-${count.toString().padStart(4, '0')}`;
}

export async function createOrder(req: AuthRequest, res: Response) {
  try {
    const data = createOrderSchema.parse(req.body);
    const cashierId = req.user!.userId;

    let subtotal = new Decimal(0);
    const orderItems: Array<{ menuItemId: string; quantity: number; unitPrice: string; modifiers: any }> = [];

    for (const item of data.items) {
      const menuItems = await sql`
        SELECT id, name, price, is_available FROM menu_items WHERE id = ${item.menuItemId}
      `;

      if (menuItems.length === 0) {
        return errorResponse(res, `Menu item ${item.menuItemId} not found`, 404);
      }

      const menuItem = menuItems[0];

      if (!menuItem.is_available) {
        return errorResponse(res, `${menuItem.name} is not available`, 400);
      }

      const inventory = await sql`
        SELECT quantity FROM inventory WHERE menu_item_id = ${item.menuItemId}
      `;

      if (inventory.length > 0 && inventory[0].quantity < item.quantity) {
        return errorResponse(res, `Insufficient stock for ${menuItem.name}`, 400);
      }

      const unitPrice = new Decimal(menuItem.price);
      const itemSubtotal = unitPrice.times(item.quantity);
      subtotal = subtotal.plus(itemSubtotal);

      orderItems.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: unitPrice.toString(),
        modifiers: item.modifiers || {},
      });
    }

    const taxRate = new Decimal(process.env.TAX_RATE || '0.15');
    const discountAmount = new Decimal(data.discountAmount || 0);
    const taxAmount = subtotal.minus(discountAmount).times(taxRate);
    const totalAmount = subtotal.minus(discountAmount).plus(taxAmount);

    const orderNumber = await generateOrderNumber();

    const orderResult = await sql`
      INSERT INTO orders (
        order_number, cashier_id, status, order_type, table_number,
        subtotal, tax_amount, discount_amount, total_amount, notes
      )
      VALUES (
        ${orderNumber}, ${cashierId}, 'pending', ${data.orderType},
        ${data.tableNumber || null}, ${subtotal.toString()}, ${taxAmount.toString()},
        ${discountAmount.toString()}, ${totalAmount.toString()}, ${data.notes || null}
      )
      RETURNING *
    `;

    const order = orderResult[0];

    for (const item of orderItems) {
      const itemSubtotal = new Decimal(item.unitPrice).times(item.quantity);
      
      await sql`
        INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, modifiers, subtotal)
        VALUES (
          ${order.id}, ${item.menuItemId}, ${item.quantity},
          ${item.unitPrice}, ${JSON.stringify(item.modifiers)}, ${itemSubtotal.toString()}
        )
      `;

      await sql`
        UPDATE inventory
        SET quantity = quantity - ${item.quantity}, last_updated = now()
        WHERE menu_item_id = ${item.menuItemId}
      `;
    }

    const fullOrder = await sql`
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'id', oi.id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'unitPrice', oi.unit_price,
            'modifiers', oi.modifiers,
            'subtotal', oi.subtotal,
            'menuItem', json_build_object(
              'id', m.id,
              'name', m.name,
              'price', m.price
            )
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items m ON oi.menu_item_id = m.id
      WHERE o.id = ${order.id}
      GROUP BY o.id
    `;

    return successResponse(res, fullOrder[0], 'Order created', 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    console.error('Create order error:', error);
    return errorResponse(res, 'Failed to create order', 500);
  }
}

export async function getOrders(req: AuthRequest, res: Response) {
  try {
    const { date, status, cashierId, paymentMethod } = req.query;

    // Normalize filters to null so SQL COALESCE predicates work
    const dateFilter = (date as string) || null;
    const statusFilter = (status as string) || null;
    const cashierFilter = (cashierId as string) || null;
    const paymentFilter = (paymentMethod as string) || null;

    const orders = await sql`
      SELECT 
        o.id, o.order_number as "orderNumber", o.cashier_id as "cashierId",
        o.status, o.order_type as "orderType", o.table_number as "tableNumber",
        o.subtotal, o.tax_amount as "taxAmount", o.discount_amount as "discountAmount",
        o.total_amount as "totalAmount", o.payment_method as "paymentMethod",
        o.payment_status as "paymentStatus", o.payment_reference as "paymentReference",
        o.notes, o.created_at as "createdAt", o.updated_at as "updatedAt",
        u.name as "cashierName"
      FROM orders o
      LEFT JOIN users u ON o.cashier_id = u.id
      WHERE 
        (${dateFilter}::date IS NULL OR DATE(o.created_at) = ${dateFilter}::date)
        AND (${statusFilter}::text IS NULL OR o.status = ${statusFilter}::text)
        AND (${cashierFilter}::uuid IS NULL OR o.cashier_id = ${cashierFilter}::uuid)
        AND (${paymentFilter}::text IS NULL OR o.payment_method = ${paymentFilter}::text)
      ORDER BY o.created_at DESC
      LIMIT 100
    `;

    return successResponse(res, orders);
  } catch (error) {
    console.error('Get orders error:', error);
    return errorResponse(res, 'Failed to fetch orders', 500);
  }
}

export async function getOrder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const orders = await sql`
      SELECT 
        o.*,
        u.name as "cashierName",
        json_agg(
          json_build_object(
            'id', oi.id,
            'menuItemId', oi.menu_item_id,
            'quantity', oi.quantity,
            'unitPrice', oi.unit_price,
            'modifiers', oi.modifiers,
            'subtotal', oi.subtotal,
            'menuItem', json_build_object(
              'id', m.id,
              'name', m.name,
              'price', m.price
            )
          )
        ) as items
      FROM orders o
      LEFT JOIN users u ON o.cashier_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items m ON oi.menu_item_id = m.id
      WHERE o.id = ${id}
      GROUP BY o.id, u.name
    `;

    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    return successResponse(res, orders[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch order', 500);
  }
}

export async function updateOrderStatus(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, 'Invalid status', 400);
    }

    const result = await sql`
      UPDATE orders
      SET status = ${status}, updated_at = now()
      WHERE id = ${id}
      RETURNING id, order_number as "orderNumber", status, cashier_id as "cashierId"
    `;

    if (result.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const updated = result[0];

    // Broadcast status changes to relevant rooms
    io.to('kitchen').emit('order:updated', updated);
    io.to('managers').emit('order:updated', updated);
    if (status === 'ready') {
      io.to('cashiers').emit('order:ready', updated);
    }

    return successResponse(res, updated, 'Order status updated');
  } catch (error) {
    console.error('Update order status error:', error);
    return errorResponse(res, 'Failed to update order status', 500);
  }
}

export async function cancelOrder(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;

    const orders = await sql`SELECT * FROM orders WHERE id = ${id}`;
    
    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const order = orders[0];
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / 1000 / 60;

    if (req.user!.role === 'cashier' && diffMinutes > 2) {
      return errorResponse(res, 'Cannot cancel order after 2 minutes', 403);
    }

    const items = await sql`
      SELECT menu_item_id, quantity FROM order_items WHERE order_id = ${id}
    `;

    for (const item of items) {
      await sql`
        UPDATE inventory
        SET quantity = quantity + ${item.quantity}
        WHERE menu_item_id = ${item.menu_item_id}
      `;
    }

    await sql`
      UPDATE orders
      SET status = 'cancelled', updated_at = now()
      WHERE id = ${id}
    `;

    return successResponse(res, null, 'Order cancelled');
  } catch (error) {
    return errorResponse(res, 'Failed to cancel order', 500);
  }
}

export async function getTodaySummary(req: AuthRequest, res: Response) {
  try {
    const summary = await sql`
      SELECT 
        COUNT(*) as "totalOrders",
        COALESCE(SUM(total_amount), 0) as "totalRevenue",
        COALESCE(SUM(tax_amount), 0) as "totalTax",
        COALESCE(AVG(total_amount), 0) as "averageOrderValue"
      FROM orders
      WHERE DATE(created_at) = CURRENT_DATE
        AND status != 'cancelled'
    `;

    return successResponse(res, summary[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to fetch summary', 500);
  }
}
