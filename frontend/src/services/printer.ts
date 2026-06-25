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
  tr.unit-row td { font-size: 10px; color: #333; padding-bottom: 3px; }
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
