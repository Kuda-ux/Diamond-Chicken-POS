import { Request, Response } from 'express';
import sql from '../db/client';
import { successResponse, errorResponse } from '../utils/response';

async function fetchReceiptData(orderId: string) {
  const rows = await sql`
    SELECT
      o.id, o.order_number as "orderNumber", o.status,
      o.order_type as "orderType", o.table_number as "tableNumber",
      o.subtotal, o.tax_amount as "taxAmount",
      o.discount_amount as "discountAmount",
      o.total_amount as "totalAmount",
      o.payment_method as "paymentMethod",
      o.payment_reference as "paymentReference",
      o.payment_status as "paymentStatus",
      o.notes,
      o.created_at as "createdAt",
      u.name as "cashierName",
      json_agg(
        json_build_object(
          'id', oi.id,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price,
          'subtotal', oi.subtotal,
          'menuItem', json_build_object('name', m.name, 'price', m.price)
        ) ORDER BY oi.id
      ) FILTER (WHERE oi.id IS NOT NULL) as items
    FROM orders o
    LEFT JOIN users u ON o.cashier_id = u.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN menu_items m ON oi.menu_item_id = m.id
    WHERE o.id = ${orderId}
    GROUP BY o.id, u.name
  `;
  return rows[0] || null;
}

export async function getReceiptData(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await fetchReceiptData(id);
    if (!data) return errorResponse(res, 'Receipt not found', 404);

    const restaurant = {
      name: process.env.RESTAURANT_NAME || 'Diamond Chicken',
      address: process.env.RESTAURANT_ADDRESS || 'Naiks Corner, Herbert Chitepo Street, Bulawayo',
      phone: process.env.RESTAURANT_PHONE || '+263 77 000 0000',
      vatNumber: process.env.RESTAURANT_VAT || 'VAT: 10000000',
      taxRate: parseFloat(process.env.TAX_RATE || '0.15'),
    };

    return successResponse(res, { receipt: data, restaurant });
  } catch (error) {
    console.error('Receipt data error:', error);
    return errorResponse(res, 'Failed to load receipt', 500);
  }
}

export async function getReceiptHtml(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const data = await fetchReceiptData(id);
    if (!data) {
      res.status(404).send('<h1>Receipt not found</h1>');
      return;
    }

    const restaurantName = process.env.RESTAURANT_NAME || 'Diamond Chicken';
    const restaurantAddr = process.env.RESTAURANT_ADDRESS || 'Naiks Corner, Herbert Chitepo Street, Bulawayo';
    const restaurantPhone = process.env.RESTAURANT_PHONE || '+263 77 000 0000';
    const vatNumber = process.env.RESTAURANT_VAT || 'VAT: 10000000';

    const created = new Date(data.createdAt);
    const dateStr = created.toLocaleDateString('en-ZW', { year: 'numeric', month: '2-digit', day: '2-digit' });
    const timeStr = created.toLocaleTimeString('en-ZW', { hour: '2-digit', minute: '2-digit' });

    const itemsHtml = (data.items || [])
      .map((it: any) => {
        const name = it.menuItem?.name || 'Item';
        const qty = it.quantity;
        const price = parseFloat(it.unitPrice).toFixed(2);
        const sub = parseFloat(it.subtotal).toFixed(2);
        return `
          <tr>
            <td style="padding:4px 0">
              <div style="font-weight:600">${qty}× ${name}</div>
              <div style="font-size:12px;color:#666">@ $${price}</div>
            </td>
            <td style="padding:4px 0;text-align:right;font-weight:600">$${sub}</td>
          </tr>`;
      })
      .join('');

    const methodLabels: Record<string, string> = {
      cash: 'Cash (USD)',
      ecocash: 'EcoCash',
      innbucks: 'InnBucks',
      zipit: 'ZIPIT',
      visa: 'Visa/Card',
      mastercard: 'Mastercard',
    };

    const paymentLabel = methodLabels[data.paymentMethod] || (data.paymentMethod || 'Pending');

    const orderTypeLabel =
      data.orderType === 'dine_in' ? 'Dine-in' : data.orderType === 'delivery' ? 'Delivery' : 'Takeaway';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Receipt ${data.orderNumber} — ${restaurantName}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f5f5f7;padding:20px;color:#1a1a1a}
  .receipt{max-width:420px;margin:0 auto;background:white;border-radius:16px;padding:32px;box-shadow:0 10px 40px rgba(0,0,0,0.08)}
  .header{text-align:center;border-bottom:2px dashed #ddd;padding-bottom:20px;margin-bottom:20px}
  .brand{font-size:28px;font-weight:800;color:#F59E0B;letter-spacing:-0.5px}
  .brand-diamond{margin-right:6px}
  .tagline{font-size:12px;color:#666;margin-top:4px}
  .addr{font-size:13px;color:#555;margin-top:8px;line-height:1.5}
  .meta{font-size:13px;display:flex;justify-content:space-between;margin:4px 0;color:#555}
  .meta strong{color:#1a1a1a}
  .items{width:100%;border-collapse:collapse;margin:16px 0}
  .items td{font-size:14px;border-bottom:1px solid #f0f0f0}
  .totals{margin-top:16px;padding-top:16px;border-top:2px dashed #ddd}
  .tot-row{display:flex;justify-content:space-between;padding:4px 0;font-size:14px;color:#555}
  .tot-total{font-size:22px;font-weight:800;color:#1a1a1a;padding-top:10px;border-top:1px solid #e0e0e0;margin-top:8px}
  .pay{margin-top:20px;padding:12px;background:#F0FDF4;border-radius:8px;text-align:center;color:#166534;font-weight:600}
  .pay-ref{font-size:11px;color:#666;margin-top:4px;font-weight:400;word-break:break-all}
  .notes{margin-top:16px;padding:10px;background:#FEF3C7;border-radius:8px;font-size:13px;color:#78350F}
  .thanks{margin-top:24px;padding-top:20px;border-top:2px dashed #ddd;text-align:center;color:#666;font-size:13px;line-height:1.8}
  .thanks .en{color:#1a1a1a;font-weight:700;font-size:15px}
  .thanks .sn,.thanks .nd{font-style:italic}
  .footer{margin-top:20px;text-align:center;font-size:10px;color:#999}
  .watermark{font-size:11px;color:#999;text-align:center;margin-top:16px}
  @media print { body{background:white;padding:0} .receipt{box-shadow:none;max-width:100%} .no-print{display:none} }
</style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div class="brand"><span class="brand-diamond">◆</span>${restaurantName}</div>
      <div class="tagline">Serving Quality, Every Order</div>
      <div class="addr">${restaurantAddr}<br>${restaurantPhone} • ${vatNumber}</div>
    </div>

    <div class="meta"><span>Receipt #</span><strong>${data.orderNumber}</strong></div>
    <div class="meta"><span>Date</span><strong>${dateStr} ${timeStr}</strong></div>
    <div class="meta"><span>Order Type</span><strong>${orderTypeLabel}${data.tableNumber ? ` • T${data.tableNumber}` : ''}</strong></div>
    <div class="meta"><span>Cashier</span><strong>${data.cashierName || '—'}</strong></div>

    <table class="items">${itemsHtml}</table>

    <div class="totals">
      <div class="tot-row"><span>Subtotal</span><span>$${parseFloat(data.subtotal).toFixed(2)}</span></div>
      ${parseFloat(data.discountAmount) > 0 ? `<div class="tot-row"><span>Discount</span><span>-$${parseFloat(data.discountAmount).toFixed(2)}</span></div>` : ''}
      <div class="tot-row"><span>VAT (15%)</span><span>$${parseFloat(data.taxAmount).toFixed(2)}</span></div>
      <div class="tot-row tot-total"><span>TOTAL</span><span>$${parseFloat(data.totalAmount).toFixed(2)}</span></div>
    </div>

    <div class="pay">
      ${data.paymentStatus === 'paid' ? '✓ PAID' : 'PAYMENT PENDING'} • ${paymentLabel}
      ${data.paymentReference ? `<div class="pay-ref">Ref: ${data.paymentReference}</div>` : ''}
    </div>

    ${data.notes ? `<div class="notes">📝 ${data.notes}</div>` : ''}

    <div class="thanks">
      <div class="en">Thank you — please come again!</div>
      <div class="sn">Tinokutendai — dzokaizve!</div>
      <div class="nd">Siyabonga — buyani futhi!</div>
    </div>

    <div class="watermark">ZIMRA-compliant fiscal receipt</div>
    <div class="footer">© ${new Date().getFullYear()} ${restaurantName} • Powered by Diamond POS</div>
  </div>

  <script>
    // Auto-focus print dialog if ?print=1
    if (new URLSearchParams(location.search).get('print') === '1') {
      setTimeout(() => window.print(), 300);
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.send(html);
  } catch (error) {
    console.error('Receipt HTML error:', error);
    res.status(500).send('<h1>Failed to load receipt</h1>');
  }
}
