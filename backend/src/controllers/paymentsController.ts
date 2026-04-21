import { Response } from 'express';
import { z } from 'zod';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';
import { AuthRequest } from '../middleware/auth';
import { processCashPayment } from '../services/payments/cashPayment';

const cashPaymentSchema = z.object({
  orderId: z.string().uuid(),
  amountTendered: z.number().positive(),
});

export async function processCash(req: AuthRequest, res: Response) {
  try {
    const data = cashPaymentSchema.parse(req.body);
    const result = await processCashPayment(data);
    return successResponse(res, result, 'Payment processed');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return errorResponse(res, 'Validation error', 400, error.errors);
    }
    return errorResponse(res, (error as Error).message || 'Payment failed', 500);
  }
}

export async function processEcocash(req: AuthRequest, res: Response) {
  try {
    const { orderId, phoneNumber } = req.body;
    
    const reference = `ECOCASH-${Date.now()}`;
    
    await sql`
      UPDATE orders
      SET payment_method = 'ecocash',
          payment_reference = ${reference},
          updated_at = now()
      WHERE id = ${orderId}
    `;

    return successResponse(res, {
      success: true,
      reference,
      method: 'ecocash',
      message: `EcoCash request sent to ${phoneNumber}`,
      pollUrl: `/api/payments/${orderId}/status`,
    });
  } catch (error) {
    return errorResponse(res, 'EcoCash payment failed', 500);
  }
}

export async function processInnbucks(req: AuthRequest, res: Response) {
  try {
    const { orderId } = req.body;
    
    const orders = await sql`SELECT total_amount, order_number FROM orders WHERE id = ${orderId}`;
    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const reference = `INNBUCKS-${orders[0].order_number}`;
    const qrData = `INNBUCKS:${reference}:${orders[0].total_amount}`;

    await sql`
      UPDATE orders
      SET payment_method = 'innbucks',
          payment_reference = ${reference},
          updated_at = now()
      WHERE id = ${orderId}
    `;

    return successResponse(res, {
      success: true,
      reference,
      method: 'innbucks',
      qrData,
      message: 'Scan QR code with InnBucks app',
    });
  } catch (error) {
    return errorResponse(res, 'InnBucks payment failed', 500);
  }
}

export async function processZipit(req: AuthRequest, res: Response) {
  try {
    const { orderId } = req.body;
    
    const orders = await sql`SELECT order_number FROM orders WHERE id = ${orderId}`;
    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    const reference = `DC-ZIPIT-${orders[0].order_number}`;

    await sql`
      UPDATE orders
      SET payment_method = 'zipit',
          payment_reference = ${reference},
          updated_at = now()
      WHERE id = ${orderId}
    `;

    return successResponse(res, {
      success: true,
      reference,
      method: 'zipit',
      message: 'Transfer to account using reference',
      bankDetails: {
        bank: 'CBZ Bank',
        account: '1234567890',
        reference,
      },
    });
  } catch (error) {
    return errorResponse(res, 'ZIPIT payment failed', 500);
  }
}

export async function processCard(req: AuthRequest, res: Response) {
  try {
    const { orderId } = req.body;
    
    const reference = `CARD-${Date.now()}`;

    await sql`
      UPDATE orders
      SET payment_method = 'visa',
          payment_reference = ${reference},
          updated_at = now()
      WHERE id = ${orderId}
    `;

    return successResponse(res, {
      success: true,
      reference,
      method: 'card',
      redirectUrl: `https://paynow.co.zw/payment/${reference}`,
      message: 'Redirecting to payment gateway',
    });
  } catch (error) {
    return errorResponse(res, 'Card payment failed', 500);
  }
}

export async function getPaymentStatus(req: AuthRequest, res: Response) {
  try {
    const { orderId } = req.params;

    const orders = await sql`
      SELECT payment_status, payment_method, payment_reference
      FROM orders
      WHERE id = ${orderId}
    `;

    if (orders.length === 0) {
      return errorResponse(res, 'Order not found', 404);
    }

    return successResponse(res, orders[0]);
  } catch (error) {
    return errorResponse(res, 'Failed to get payment status', 500);
  }
}

export async function confirmPayment(req: AuthRequest, res: Response) {
  try {
    const { orderId } = req.body;

    await sql`
      UPDATE orders
      SET payment_status = 'paid',
          status = 'confirmed',
          updated_at = now()
      WHERE id = ${orderId}
    `;

    // Fetch full order with items to push to kitchen
    const fullOrder = await sql`
      SELECT
        o.id, o.order_number as "orderNumber", o.status,
        o.order_type as "orderType", o.table_number as "tableNumber",
        o.total_amount as "totalAmount", o.notes,
        o.created_at as "createdAt",
        json_agg(
          json_build_object(
            'id', oi.id,
            'quantity', oi.quantity,
            'menuItem', json_build_object('name', m.name, 'price', m.price)
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN menu_items m ON oi.menu_item_id = m.id
      WHERE o.id = ${orderId}
      GROUP BY o.id
    `;

    if (fullOrder[0]) {
      io.to('kitchen').emit('order:new', fullOrder[0]);
      io.to('managers').emit('order:new', fullOrder[0]);
    }

    return successResponse(res, null, 'Payment confirmed');
  } catch (error) {
    console.error('Confirm payment error:', error);
    return errorResponse(res, 'Failed to confirm payment', 500);
  }
}
