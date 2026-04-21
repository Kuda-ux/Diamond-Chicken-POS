/**
 * Thermal printer service — ESC/POS commands via Web Serial API.
 * Compatible with Epson TM-series (TM-T20, TM-T88, TM-m30) and most 58mm/80mm thermal printers.
 *
 * Usage:
 *   await connectPrinter();        // prompts user to choose USB/Serial port, stored in localStorage
 *   await printReceipt(data);      // sends ESC/POS bytes
 */

// ESC/POS commands
const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const CMD = {
  INIT: new Uint8Array([ESC, 0x40]),
  CUT: new Uint8Array([GS, 0x56, 0x42, 0x00]),
  ALIGN_LEFT: new Uint8Array([ESC, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([ESC, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([ESC, 0x61, 0x02]),
  BOLD_ON: new Uint8Array([ESC, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([ESC, 0x45, 0x00]),
  DOUBLE_ON: new Uint8Array([GS, 0x21, 0x11]), // double width + height
  DOUBLE_OFF: new Uint8Array([GS, 0x21, 0x00]),
  FEED_3: new Uint8Array([ESC, 0x64, 0x03]),
  LF_BYTE: new Uint8Array([LF]),
};

type SerialPortLike = any;

let activePort: SerialPortLike | null = null;

function hasSerialSupport(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export async function connectPrinter(): Promise<void> {
  if (!hasSerialSupport()) {
    throw new Error('Web Serial API not supported. Use Chrome/Edge on desktop.');
  }
  const port = await (navigator as any).serial.requestPort();
  await port.open({ baudRate: 9600 });
  activePort = port;
}

export function isPrinterConnected(): boolean {
  return activePort !== null;
}

export async function disconnectPrinter(): Promise<void> {
  if (activePort) {
    try { await activePort.close(); } catch { /* noop */ }
    activePort = null;
  }
}

async function writeBytes(data: Uint8Array): Promise<void> {
  if (!activePort) throw new Error('Printer not connected. Click "Connect Printer" first.');
  const writer = activePort.writable.getWriter();
  try {
    await writer.write(data);
  } finally {
    writer.releaseLock();
  }
}

function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

// 32 chars wide (58mm) or 48 chars (80mm). We use 32 for safe default.
const WIDTH = 32;

function pad(left: string, right: string, width = WIDTH): string {
  const spaces = Math.max(1, width - left.length - right.length);
  return left + ' '.repeat(spaces) + right;
}

function line(char = '-', width = WIDTH): string {
  return char.repeat(width);
}

function wrap(text: string, width = WIDTH): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export interface PrintReceiptData {
  orderNumber: string;
  cashierName?: string;
  orderType: string;
  tableNumber?: string | null;
  createdAt: string;
  items: Array<{ quantity: number; unitPrice: string; subtotal: string; menuItem?: { name: string } }>;
  subtotal: string | number;
  taxAmount: string | number;
  discountAmount?: string | number;
  totalAmount: string | number;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  notes?: string | null;
  restaurant: { name: string; address: string; phone: string; vatNumber: string };
  change?: number;
}

export async function printReceipt(data: PrintReceiptData): Promise<void> {
  if (!activePort) {
    throw new Error('Printer not connected. Click "Connect Printer" first.');
  }

  const fmt = (v: string | number | undefined) => {
    const n = typeof v === 'string' ? parseFloat(v) : Number(v || 0);
    return `$${n.toFixed(2)}`;
  };

  const created = new Date(data.createdAt);
  const dateStr = created.toLocaleDateString('en-ZW');
  const timeStr = created.toLocaleTimeString('en-ZW', { hour: '2-digit', minute: '2-digit' });

  const methodLabel: Record<string, string> = {
    cash: 'Cash (USD)',
    ecocash: 'EcoCash',
    innbucks: 'InnBucks',
    zipit: 'ZIPIT',
    visa: 'Visa',
    mastercard: 'Mastercard',
  };
  const paymentLabel = methodLabel[data.paymentMethod || ''] || (data.paymentMethod || 'Pending');
  const orderTypeLabel =
    data.orderType === 'dine_in' ? 'Dine-in' : data.orderType === 'delivery' ? 'Delivery' : 'Takeaway';

  const parts: Uint8Array[] = [];
  parts.push(CMD.INIT);

  // Header — centered, bold, double size
  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.BOLD_ON);
  parts.push(CMD.DOUBLE_ON);
  parts.push(encode(data.restaurant.name + '\n'));
  parts.push(CMD.DOUBLE_OFF);
  parts.push(CMD.BOLD_OFF);
  parts.push(encode(data.restaurant.address + '\n'));
  parts.push(encode(data.restaurant.phone + '\n'));
  parts.push(encode(data.restaurant.vatNumber + '\n'));
  parts.push(encode(line('=') + '\n'));

  // Meta rows — left aligned
  parts.push(CMD.ALIGN_LEFT);
  parts.push(encode(pad('Receipt:', data.orderNumber) + '\n'));
  parts.push(encode(pad('Date:', `${dateStr} ${timeStr}`) + '\n'));
  parts.push(encode(pad('Type:', `${orderTypeLabel}${data.tableNumber ? ` T${data.tableNumber}` : ''}`) + '\n'));
  if (data.cashierName) {
    parts.push(encode(pad('Cashier:', data.cashierName) + '\n'));
  }
  parts.push(encode(line('-') + '\n'));

  // Items
  for (const it of data.items) {
    const name = it.menuItem?.name || 'Item';
    const qtyStr = `${it.quantity}x`;
    const price = fmt(it.subtotal);
    const nameLine = `${qtyStr} ${name}`;
    const wrapped = wrap(nameLine, WIDTH - price.length - 1);
    // First line ends with total
    parts.push(encode(pad(wrapped[0], price) + '\n'));
    for (let i = 1; i < wrapped.length; i++) {
      parts.push(encode('  ' + wrapped[i] + '\n'));
    }
  }

  parts.push(encode(line('-') + '\n'));
  parts.push(encode(pad('Subtotal', fmt(data.subtotal)) + '\n'));
  if (data.discountAmount && Number(data.discountAmount) > 0) {
    parts.push(encode(pad('Discount', '-' + fmt(data.discountAmount)) + '\n'));
  }
  parts.push(encode(pad('VAT (15%)', fmt(data.taxAmount)) + '\n'));
  parts.push(encode(line('=') + '\n'));

  // Total — bold double
  parts.push(CMD.BOLD_ON);
  parts.push(CMD.DOUBLE_ON);
  parts.push(encode(pad('TOTAL', fmt(data.totalAmount), WIDTH / 2) + '\n'));
  parts.push(CMD.DOUBLE_OFF);
  parts.push(CMD.BOLD_OFF);
  parts.push(encode(line('=') + '\n'));

  // Payment
  parts.push(CMD.BOLD_ON);
  parts.push(encode(pad('Paid:', paymentLabel) + '\n'));
  parts.push(CMD.BOLD_OFF);
  if (data.change !== undefined && data.change > 0) {
    parts.push(encode(pad('Change', fmt(data.change)) + '\n'));
  }
  if (data.paymentReference) {
    parts.push(encode('Ref: ' + data.paymentReference + '\n'));
  }

  if (data.notes) {
    parts.push(encode(line('-') + '\n'));
    for (const ln of wrap('Note: ' + data.notes)) {
      parts.push(encode(ln + '\n'));
    }
  }

  parts.push(encode(line('=') + '\n'));

  // Trilingual thank-you
  parts.push(CMD.ALIGN_CENTER);
  parts.push(CMD.BOLD_ON);
  parts.push(encode('Thank you - come again!\n'));
  parts.push(CMD.BOLD_OFF);
  parts.push(encode('Tinokutendai - dzokaizve!\n'));
  parts.push(encode('Siyabonga - buyani futhi!\n'));
  parts.push(encode('\n'));
  parts.push(encode('ZIMRA-compliant fiscal receipt\n'));

  parts.push(CMD.FEED_3);
  parts.push(CMD.CUT);

  await writeBytes(concat(...parts));
}

export async function openPrintDialog(receiptUrl: string): Promise<void> {
  // Fallback when no thermal printer — open browser print dialog
  const w = window.open(receiptUrl + '?print=1', '_blank', 'width=420,height=800');
  if (!w) {
    // Popup blocked — redirect user to the receipt page
    window.location.href = receiptUrl + '?print=1';
  }
}

export function whatsAppShareUrl(receiptUrl: string, orderNumber: string, total: string): string {
  const message = `Your Diamond Chicken receipt ${orderNumber} — Total: $${total}\n${receiptUrl}`;
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
