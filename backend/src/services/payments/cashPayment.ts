import Decimal from 'decimal.js';
import sql from '../../db/client';

export interface CashPaymentRequest {
  orderId: string;
  amountTendered: number;
}

export async function processCashPayment(data: CashPaymentRequest) {
  const orders = await sql`SELECT total_amount FROM orders WHERE id = ${data.orderId}`;
  
  if (orders.length === 0) {
    throw new Error('Order not found');
  }

  const totalAmount = new Decimal(orders[0].total_amount);
  const tendered = new Decimal(data.amountTendered);

  if (tendered.lessThan(totalAmount)) {
    throw new Error('Insufficient amount tendered');
  }

  const change = tendered.minus(totalAmount);
  const reference = `CASH-${Date.now()}`;

  await sql`
    UPDATE orders
    SET payment_method = 'cash',
        payment_status = 'paid',
        payment_reference = ${reference},
        status = 'confirmed',
        updated_at = now()
    WHERE id = ${data.orderId}
  `;

  return {
    success: true,
    reference,
    method: 'cash' as const,
    amount: totalAmount.toNumber(),
    change: change.toNumber(),
    message: 'Cash payment processed successfully',
  };
}
