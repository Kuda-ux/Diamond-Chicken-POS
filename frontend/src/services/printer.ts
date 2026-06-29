/**
 * Receipt printer service.
 *
 * Strategy
 * --------
 * - **Desktop (Electron)**: print silently to a Windows printer (e.g. the
 *   "POS-80" thermal printer driver) via the `window.diamond.printers` IPC
 *   bridge defined in `desktop/preload.js`. No driver code required —
 *   whatever Windows printer driver the till has installed is used directly.
 * - **Browser**: open the print dialog with the receipt HTML pre-loaded.
 *   The cashier picks the POS-80 in the OS dialog and clicks Print. This is
 *   the universal fallback when running outside the desktop app.
 *
 * The previous Web Serial / WebUSB approach was removed: POS-80 USB thermal
 * printers register as USB **printer-class** devices (not USB-serial), so
 * `navigator.serial.requestPort()` would always show an empty picker and
 * throw "No port selected by the user".
 */

// ----------------------------------------------------------------------------
// Bridge type for the Electron preload (window.diamond)
// ----------------------------------------------------------------------------
export interface DesktopPrinter {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
}

interface DiamondBridge {
  isDesktop: true;
  platform: string;
  version: string;
  printers: {
    list: () => Promise<DesktopPrinter[]>;
    print: (
      html: string,
      opts: { deviceName?: string; copies?: number; widthMicrons?: number; heightMicrons?: number }
    ) => Promise<{ ok: boolean; error?: string }>;
  };
}

declare global {
  interface Window {
    diamond?: DiamondBridge;
  }
}

export const isDesktop = (): boolean => !!window.diamond?.isDesktop;

// ----------------------------------------------------------------------------
// Saved printer preference (per-machine, in localStorage)
// ----------------------------------------------------------------------------
const STORAGE_KEY = 'diamond.printerName';

export const getSavedPrinter = (): string =>
  (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY)) || '';

export const setSavedPrinter = (name: string): void => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, name);
};

export const listPrinters = async (): Promise<DesktopPrinter[]> => {
  if (!isDesktop()) {
    console.log('[Printer] Not running in desktop mode');
    return [];
  }
  try {
    console.log('[Printer] Fetching printer list...');
    const result = await window.diamond!.printers.list();
    console.log('[Printer] Got printers:', result);
    return result;
  } catch (err) {
    console.error('[Printer] Failed to list printers:', err);
    return [];
  }
};

/**
 * Best-guess auto-detect: looks for a printer whose name contains "POS",
 * "thermal", or "80". If none match, returns the system default.
 */
export const autoDetectPrinter = async (): Promise<string> => {
  const printers = await listPrinters();
  if (printers.length === 0) return '';
  const score = (n: string) => {
    const s = n.toLowerCase();
    let r = 0;
    if (s.includes('pos-80') || s.includes('pos 80') || s.includes('pos80')) r += 100;
    if (s.includes('xprinter')) r += 90;
    if (s.includes('pos')) r += 50;
    if (s.includes('thermal')) r += 30;
    if (s.includes('80mm') || s.includes('80 mm') || s.includes('80')) r += 10;
    if (s.includes('receipt')) r += 20;
    return r;
  };
  const sorted = [...printers].sort((a, b) => score(b.name) - score(a.name));
  if (score(sorted[0].name) > 0) return sorted[0].name;
  const def = printers.find((p) => p.isDefault);
  return (def || printers[0]).name;
};

// ----------------------------------------------------------------------------
// Receipt rendering — produces an 80mm-wide HTML document optimised for
// thermal printers. We do not depend on the backend HTML renderer because
// thermal printers need a much narrower / monochrome layout.
// ----------------------------------------------------------------------------
export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
}

export interface ReceiptPayload {
  orderNumber: string;
  createdAt: string | Date;
  cashierName?: string;
  orderType?: 'dine_in' | 'takeaway' | 'delivery' | string;
  tableNumber?: number | null;
  items: ReceiptItem[];
  subtotal: number | string;
  taxAmount: number | string;
  discountAmount?: number | string;
  totalAmount: number | string;
  paymentMethod?: string;
  paymentStatus?: string;
  paymentReference?: string | null;
  notes?: string | null;
  change?: number;
  restaurant: {
    name: string;
    address: string;
    phone: string;
    vatNumber?: string;
    taxRate?: number;
  };
}

const num = (v: number | string | undefined | null): number =>
  typeof v === 'number' ? v : parseFloat(String(v || 0)) || 0;

const fmt = (v: number | string | undefined | null): string => num(v).toFixed(2);

const escapeHtml = (s: string | undefined | null): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

const orderTypeLabel = (t?: string): string =>
  t === 'dine_in' ? 'DINE-IN' : t === 'delivery' ? 'DELIVERY' : 'TAKEAWAY';

const paymentLabel = (m?: string): string => {
  switch ((m || '').toLowerCase()) {
    case 'cash': return 'CASH (USD)';
    case 'ecocash': return 'ECOCASH';
    case 'innbucks': return 'INNBUCKS';
    case 'zipit': return 'ZIPIT';
    case 'visa':
    case 'mastercard':
    case 'card': return 'CARD';
    default: return (m || 'PENDING').toUpperCase();
  }
};

/**
 * Renders an 80mm thermal-friendly HTML receipt.
 * Width: 72mm content area inside 80mm paper (4mm margin each side).
 */
export const renderThermalReceipt = (r: ReceiptPayload): string => {
  // Defensive defaults in case the API response is missing fields
  const restaurant = r.restaurant || ({} as ReceiptPayload['restaurant']);
  const items = Array.isArray(r.items) ? r.items : [];
  const created = new Date(r.createdAt || Date.now());
  const dateStr = created.toLocaleDateString('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Africa/Harare',
  });
  const timeStr = created.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare',
  });

  const itemsHtml = items.map((it) => {
    // Backend returns items with name nested as menuItem.name;
    // the ReceiptItem interface also allows a flat name field for direct use.
    const itemAny = it as any;
    const itemName = it?.name || itemAny?.menuItem?.name || 'Item';
    return `
    <tr>
      <td class="qty">${num(it?.quantity)}×</td>
      <td class="name">${escapeHtml(itemName)}</td>
      <td class="amt">$${fmt(it?.subtotal)}</td>
    </tr>
    <tr class="unit-row"><td></td><td colspan="2">@ $${fmt(it?.unitPrice)} each</td></tr>
  `;
  }).join('');

  const tableInfo = r.tableNumber ? ` • TABLE ${r.tableNumber}` : '';
  const discount = num(r.discountAmount);
  const change = num(r.change);

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Receipt ${escapeHtml(r.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 80mm; background: white; color: black; }
  body {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 12px;
    line-height: 1.35;
    padding: 4mm 8mm 4mm 4mm;
  }
  .center { text-align: center; }
  .right  { text-align: right; }
  .bold   { font-weight: 700; }
  .big    { font-size: 16px; font-weight: 800; letter-spacing: 0.5px; }
  .xs     { font-size: 10px; }
  .row    { display: flex; justify-content: space-between; gap: 6px; }
  .hr     { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .double { border: 0; border-top: 2px solid #000; margin: 6px 0; }
  table   { width: 100%; border-collapse: collapse; }
  td      { vertical-align: top; padding: 1px 0; }
  td.qty  { width: 10mm; font-weight: 700; }
  td.amt  { white-space: nowrap; text-align: right; font-weight: 700; }
  td.name { word-break: break-all; font-weight: 700; }
  tr.unit-row td { font-size: 11px; color: #000; padding-bottom: 3px; }
  .total-row { font-size: 15px; font-weight: 800; }
  .pay { border: 1px solid #000; padding: 4px 6px; margin-top: 6px; text-align: center; font-weight: 700; }
  .footer { margin-top: 6mm; text-align: center; font-size: 10px; line-height: 1.4; }
</style>
</head><body>
  <div class="center">
    <div class="big">${escapeHtml(restaurant.name || 'Diamond Chicken')}</div>
    <div class="xs">${escapeHtml(restaurant.address)}</div>
    <div class="xs">Tel: ${escapeHtml(restaurant.phone)}</div>
    ${restaurant.vatNumber ? `<div class="xs">${escapeHtml(restaurant.vatNumber)}</div>` : ''}
  </div>

  <hr class="hr">

  <div class="row"><span>Receipt #</span><span class="bold">${escapeHtml(r.orderNumber)}</span></div>
  <div class="row"><span>Date</span><span>${dateStr} ${timeStr}</span></div>
  <div class="row"><span>Order</span><span class="bold">${orderTypeLabel(r.orderType)}${tableInfo}</span></div>
  ${r.cashierName ? `<div class="row"><span>Cashier</span><span>${escapeHtml(r.cashierName)}</span></div>` : ''}

  <hr class="hr">

  <table>${itemsHtml}</table>

  <hr class="hr">

  <div class="row"><span>Subtotal</span><span>$${fmt(r.subtotal)}</span></div>
  ${discount > 0 ? `<div class="row"><span>Discount</span><span>-$${fmt(discount)}</span></div>` : ''}
  <div class="row"><span>VAT (included ${(((restaurant.taxRate ?? 0.15) * 100) | 0)}%)</span><span>$${fmt(r.taxAmount)}</span></div>

  <hr class="double">

  <div class="row total-row"><span>TOTAL</span><span>$${fmt(r.totalAmount)}</span></div>

  ${change > 0 ? `<div class="row" style="margin-top:4px"><span>Change</span><span class="bold">$${fmt(change)}</span></div>` : ''}

  <div class="pay">
    ${(r.paymentStatus || '').toLowerCase() === 'paid' ? '✓ PAID' : 'PAYMENT PENDING'}<br>
    ${paymentLabel(r.paymentMethod)}
    ${r.paymentReference ? `<div class="xs" style="font-weight:400;margin-top:2px">Ref: ${escapeHtml(r.paymentReference)}</div>` : ''}
  </div>

  ${r.notes ? `<div class="xs" style="margin-top:6px;border:1px dashed #000;padding:4px">${escapeHtml(r.notes)}</div>` : ''}

  <div class="footer">
    <div class="bold">Thank you — please come again!</div>
    <div>Tinokutendai &mdash; dzokaizve!</div>
    <div>Siyabonga &mdash; buyani futhi!</div>
    <div class="xs" style="margin-top:6mm">ZIMRA-compliant fiscal receipt</div>
  </div>
</body></html>`;
};

// ----------------------------------------------------------------------------
// Kitchen ticket — items only, no prices, large font for kitchen readability
// ----------------------------------------------------------------------------

export interface KitchenTicketPayload {
  orderNumber: string;
  orderType?: string;
  tableNumber?: string | number | null;
  notes?: string | null;
  items: { name: string; quantity: number }[];
  createdAt?: string | Date;
}

export const renderKitchenTicket = (t: KitchenTicketPayload): string => {
  const created = new Date(t.createdAt || Date.now());
  const timeStr = created.toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare',
  });
  const dateStr = created.toLocaleDateString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Africa/Harare',
  });

  const typeLabel = t.orderType === 'dine_in'
    ? 'DINE-IN'
    : t.orderType === 'delivery'
    ? 'DELIVERY'
    : 'TAKEAWAY';

  const tableRow = t.tableNumber
    ? `<div class="meta">TABLE <span class="tbl">${escapeHtml(String(t.tableNumber))}</span></div>`
    : '';

  const itemsHtml = (t.items || []).map((it) => `
    <tr>
      <td class="qty">${it.quantity}×</td>
      <td class="name">${escapeHtml(it.name)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Kitchen ${escapeHtml(t.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 80mm; background: white; color: black; }
  body {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.4;
    padding: 4mm 4mm 8mm 4mm;
  }
  .center { text-align: center; }
  .bold   { font-weight: 800; }
  .hr     { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  .double { border: 0; border-top: 3px solid #000; margin: 5px 0; }
  .tag    { font-size: 11px; border: 1px solid #000; display: inline-block; padding: 1px 5px; letter-spacing: 1px; }
  .order  { font-size: 28px; font-weight: 900; letter-spacing: 2px; }
  .meta   { font-size: 13px; margin-top: 3px; }
  .tbl    { font-size: 20px; font-weight: 900; }
  table   { width: 100%; border-collapse: collapse; margin-top: 4px; }
  td      { vertical-align: top; padding: 3px 0; }
  td.qty  { width: 12mm; font-size: 18px; font-weight: 900; }
  td.name { font-size: 16px; font-weight: 800; word-break: break-word; }
  .notes  { margin-top: 6px; border: 2px dashed #000; padding: 4px 6px; font-size: 13px; font-weight: 700; }
  .foot   { margin-top: 5mm; text-align: center; font-size: 11px; }
</style>
</head><body>
  <div class="center">
    <div class="tag">★ KITCHEN ORDER ★</div>
    <div class="order">${escapeHtml(t.orderNumber)}</div>
    <div class="meta bold">${typeLabel}</div>
    ${tableRow}
    <div class="meta">${dateStr} &nbsp; ${timeStr}</div>
  </div>

  <hr class="double">

  <table>${itemsHtml}</table>

  <hr class="double">

  ${t.notes ? `<div class="notes">NOTE: ${escapeHtml(t.notes)}</div>` : ''}

  <div class="foot">— END OF ORDER —</div>
</body></html>`;
};

/**
 * Print a kitchen ticket silently on desktop (same printer as customer receipt).
 * On browser it is silently skipped — the kitchen display board handles that.
 */
export const printKitchenTicket = async (payload: KitchenTicketPayload): Promise<void> => {
  if (!isDesktop()) return; // kitchen screen handles browser environment
  const html = renderKitchenTicket(payload);
  try {
    const deviceName = getSavedPrinter() || (await autoDetectPrinter());
    await window.diamond!.printers.print(html, { deviceName, copies: 1 });
  } catch (err) {
    console.error('[KitchenTicket] Print failed:', err);
  }
};

// ----------------------------------------------------------------------------
// Print API
// ----------------------------------------------------------------------------

export interface PrintResult {
  ok: boolean;
  error?: string;
  /** True when the system print dialog was shown (browser fallback). */
  fallback?: boolean;
}

/**
 * Print a receipt. Auto-detects the right method:
 *  - Desktop with a saved printer → silent print to that printer
 *  - Desktop without a saved printer → opens the OS print dialog (so the
 *    cashier can pick the POS-80 once; we save it for next time)
 *  - Browser → opens a new tab with the receipt HTML and triggers print()
 */
export const printReceipt = async (payload: ReceiptPayload): Promise<PrintResult> => {
  const html = renderThermalReceipt(payload);

  if (isDesktop()) {
    try {
      const deviceName = getSavedPrinter() || (await autoDetectPrinter());
      if (deviceName && getSavedPrinter() !== deviceName) {
        // Persist the auto-detected printer so the next print is silent.
        setSavedPrinter(deviceName);
      }
      const result = await window.diamond!.printers.print(html, { deviceName, copies: 1 });
      if (result.ok) {
        return { ok: true };
      } else {
        console.error('[Printer] Desktop print failed, falling back to browser:', result.error);
        // Fall back to browser print if desktop print fails
        return printViaSystemDialog(html);
      }
    } catch (err) {
      console.error('[Printer] Desktop bridge error, falling back to browser:', err);
      // Fall back to browser print if bridge fails
      return printViaSystemDialog(html);
    }
  }

  // Browser fallback: open new tab, auto-trigger print, close after.
  return printViaSystemDialog(html);
};

/**
 * Test print to verify a printer is configured correctly. Sends a small
 * "test page" through the same pipeline as a real receipt.
 */
export const testPrint = async (deviceName: string, restaurantName = 'Diamond Chicken'): Promise<PrintResult> => {
  const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
  @page { size: 80mm auto; margin: 0; }
  body { width: 80mm; padding: 4mm; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.4; text-align: center; }
  .big { font-size: 18px; font-weight: 800; }
  .hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
</style></head><body>
  <div class="big">${escapeHtml(restaurantName)}</div>
  <div>PRINTER TEST</div>
  <hr class="hr">
  <div>If you can read this, your</div>
  <div>POS-80 thermal printer is</div>
  <div><b>working correctly.</b></div>
  <hr class="hr">
  <div>${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Harare' })}</div>
  <div style="margin-top:8mm">— END OF TEST —</div>
</body></html>`;

  if (isDesktop()) {
    const result = await window.diamond!.printers.print(html, { deviceName, copies: 1 });
    return result.ok ? { ok: true } : { ok: false, error: result.error };
  }
  return printViaSystemDialog(html);
};

/**
 * Browser fallback: opens an invisible iframe with the HTML and triggers
 * window.print(). The cashier picks the POS-80 in the OS print dialog.
 */
const printViaSystemDialog = async (html: string): Promise<PrintResult> => {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) {
          resolve({ ok: false, error: 'Could not access print frame' });
          return;
        }
        win.focus();
        win.print();
        // Give the OS a moment, then clean up.
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch { /* noop */ }
          resolve({ ok: true, fallback: true });
        }, 1000);
      } catch (err: any) {
        resolve({ ok: false, error: err?.message || 'Print failed' });
      }
    };

    document.body.appendChild(iframe);
    iframe.srcdoc = html;
  });
};

/**
 * Open a receipt URL in a new tab/window with `?print=1` so it triggers
 * print() automatically (used by the WhatsApp share + manual print buttons).
 */
export const openPrintDialog = (url: string): void => {
  const sep = url.includes('?') ? '&' : '?';
  window.open(`${url}${sep}print=1`, '_blank', 'noopener');
};

// ----------------------------------------------------------------------------
// Daily sales-mix report — thermal 80mm printout for management
// ----------------------------------------------------------------------------

export interface DailySalesReportPayload {
  date: string;
  summary: {
    totalRevenue?: number | string;
    paidOrders?: number;
    averageOrderValue?: number | string;
    totalTax?: number | string;
    unpaidOrders?: number;
  };
  paymentMethods: { method: string; count: number; revenue: number | string }[];
  productsSold: { name: string; quantitySold: number; revenue: number | string }[];
  waste?: { totalCost?: number | string };
  restaurant: { name: string; address: string; phone: string };
  generatedBy?: string;
}

const METHOD_ABBR: Record<string, string> = {
  cash: 'CASH', ecocash: 'ECOCASH', innbucks: 'INNBUCKS',
  zipit: 'ZIPIT', visa: 'VISA', mastercard: 'MASTERCARD', unpaid: 'UNPAID',
};

export const renderDailySalesReport = (r: DailySalesReportPayload): string => {
  const restaurant = r.restaurant || ({} as DailySalesReportPayload['restaurant']);
  const s = r.summary || {};
  const payments = r.paymentMethods || [];
  const products = r.productsSold || [];

  const fmtDate = (() => {
    const d = new Date(r.date + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  })();

  const nowStr = new Date().toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare',
  });

  const row = (label: string, value: string, bold = false) =>
    `<div class="row${bold ? ' bold' : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;

  const payRows = payments.map((p) =>
    row(`  ${METHOD_ABBR[p.method] || p.method.toUpperCase()} ×${p.count}`, `$${num(p.revenue).toFixed(2)}`)
  ).join('');

  const productRows = products.map((p) =>
    `<div class="prow"><span class="pname">${escapeHtml(p.name)}</span><span class="pqty">×${p.quantitySold}</span><span class="prev">$${num(p.revenue).toFixed(2)}</span></div>`
  ).join('');

  const wasteCost = num(r.waste?.totalCost);

  return `<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Sales Report ${escapeHtml(r.date)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 80mm; background: white; color: black; }
  body {
    font-family: 'Courier New', 'Consolas', monospace;
    font-size: 11px;
    line-height: 1.45;
    padding: 4mm 8mm 8mm 4mm;
  }
  .center { text-align: center; }
  .bold   { font-weight: 800; }
  .big    { font-size: 14px; font-weight: 900; }
  .med    { font-size: 12px; font-weight: 800; }
  .xs     { font-size: 9px; }
  .hr     { border: 0; border-top: 1px dashed #000; margin: 4px 0; }
  .double { border: 0; border-top: 2px solid #000; margin: 4px 0; }
  .section { font-size: 9px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; margin: 5px 0 2px; }
  .row    { display: flex; justify-content: space-between; gap: 4px; padding: 1px 0; font-size: 11px; }
  .row.bold { font-weight: 800; font-size: 12px; }
  .prow   { display: flex; align-items: baseline; gap: 3px; padding: 1px 0; font-size: 11px; }
  .pname  { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pqty   { width: 30px; text-align: right; font-weight: 700; flex-shrink: 0; }
  .prev   { width: 52px; text-align: right; font-weight: 700; flex-shrink: 0; }
  .foot   { margin-top: 6mm; text-align: center; font-size: 9px; line-height: 1.5; }
</style>
</head><body>

  <div class="center">
    <div class="big">${escapeHtml(restaurant.name || 'Diamond Chicken')}</div>
    <div class="xs">${escapeHtml(restaurant.address)}</div>
    <div style="margin-top:4px;font-size:12px;font-weight:800;">DAILY SALES REPORT</div>
    <div class="med">${escapeHtml(fmtDate)}</div>
  </div>

  <hr class="double">

  <div class="section">Sales Summary</div>
  ${row('Revenue', `$${num(s.totalRevenue).toFixed(2)}`, true)}
  ${row('Paid Orders', String(s.paidOrders || 0))}
  ${s.unpaidOrders ? row('Unpaid Orders', String(s.unpaidOrders)) : ''}
  ${row('Avg Order Value', `$${num(s.averageOrderValue).toFixed(2)}`)}
  ${row('VAT Collected', `$${num(s.totalTax).toFixed(2)}`)}

  ${payments.length > 0 ? `
  <hr class="hr">
  <div class="section">Payment Mix</div>
  ${payRows}
  ` : ''}

  ${products.length > 0 ? `
  <hr class="hr">
  <div class="section">Products Sold</div>
  <div class="prow xs bold"><span class="pname">Item</span><span class="pqty">Qty</span><span class="prev">Rev</span></div>
  ${productRows}
  ${row('  Total units', String(products.reduce((s, p) => s + p.quantitySold, 0)))}
  ` : ''}

  ${wasteCost > 0 ? `
  <hr class="hr">
  <div class="section">Waste</div>
  ${row('Total waste cost', `$${wasteCost.toFixed(2)}`)}
  ` : ''}

  <hr class="double">

  <div class="foot">
    <div>Printed: ${escapeHtml(nowStr)}</div>
    ${r.generatedBy ? `<div>By: ${escapeHtml(r.generatedBy)}</div>` : ''}
    <div style="margin-top:4mm">— END OF REPORT —</div>
  </div>

</body></html>`;
};

/**
 * Print the daily sales report to the thermal printer.
 * Desktop: silent print to saved/auto-detected printer.
 * Browser: opens the system print dialog (same fallback as receipts).
 */
export const printDailySalesReport = async (payload: DailySalesReportPayload): Promise<PrintResult> => {
  const html = renderDailySalesReport(payload);

  if (isDesktop()) {
    try {
      const deviceName = getSavedPrinter() || (await autoDetectPrinter());
      const result = await window.diamond!.printers.print(html, { deviceName, copies: 1 });
      if (result.ok) return { ok: true };
      return printViaSystemDialog(html);
    } catch {
      return printViaSystemDialog(html);
    }
  }

  return printViaSystemDialog(html);
};

// ----------------------------------------------------------------------------
// WhatsApp share helper (unchanged)
// ----------------------------------------------------------------------------
export const whatsAppShareUrl = (
  receiptUrl: string,
  orderNumber: string,
  total: string,
): string => {
  const message = `Your Diamond Chicken receipt ${orderNumber} — Total: $${total}\n${receiptUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
};
