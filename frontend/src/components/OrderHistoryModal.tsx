import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  X, ChevronLeft, ChevronRight, UtensilsCrossed, Home, Truck,
  Loader2, ShoppingBag, Receipt, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { ordersApi } from '../services/api';

interface Props { open: boolean; onClose: () => void; }

const STATUS: Record<string, { label: string; cls: string }> = {
  pending:   { label: 'Pending',   cls: 'text-yellow-400' },
  confirmed: { label: 'Confirmed', cls: 'text-blue-400' },
  preparing: { label: 'Preparing', cls: 'text-blue-400' },
  ready:     { label: 'Ready',     cls: 'text-emerald-400' },
  completed: { label: 'Completed', cls: 'text-emerald-400' },
  cancelled: { label: 'Cancelled', cls: 'text-red-400' },
};
const TYPE_ICON: Record<string, any> = { dine_in: UtensilsCrossed, takeaway: Home, delivery: Truck };
const PAY_LABEL: Record<string, string> = {
  cash: 'Cash', ecocash: 'EcoCash', innbucks: 'InnBucks',
  zipit: 'ZIPIT', visa: 'Visa', mastercard: 'Mastercard', card: 'Card',
};

const n  = (v: any) => parseFloat(String(v || 0)) || 0;
const $$ = (v: any) => `$${n(v).toFixed(2)}`;
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' });
const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare',
  });

export default function OrderHistoryModal({ open, onClose }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: orders, isLoading: listLoading } = useQuery({
    queryKey: ['order-history', date],
    queryFn: async () => (await ordersApi.getAll({ date })).data.data,
    enabled: open,
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ['order-detail', selectedId],
    queryFn: async () => (await ordersApi.getById(selectedId!)).data.data,
    enabled: !!selectedId,
  });

  if (!open) return null;

  const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-6">
      <div className="w-full max-w-2xl glass-strong rounded-3xl shadow-2xl border border-white/10 flex flex-col max-h-[92vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
          {selectedId ? (
            <button onClick={() => setSelectedId(null)}
              className="w-9 h-9 rounded-xl hover:bg-panel-2 flex items-center justify-center text-text-muted transition-colors flex-shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary flex-shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-lg font-bold text-text-primary leading-none truncate">
              {selectedId && detail ? (detail.orderNumber || detail.order_number) : 'Order History'}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {selectedId && detail
                ? fmtDT(detail.createdAt || detail.created_at)
                : `${(orders || []).length} order${(orders || []).length !== 1 ? 's' : ''} · ${dateLabel}`}
            </p>
          </div>
          {!selectedId && (
            <input type="date" value={date} max={today}
              onChange={e => { setDate(e.target.value); setSelectedId(null); }}
              className="input text-sm w-36 flex-shrink-0" />
          )}
          <button onClick={() => { setSelectedId(null); onClose(); }}
            className="w-9 h-9 rounded-xl hover:bg-panel-2 flex items-center justify-center text-text-muted flex-shrink-0 ml-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* LIST */}
          {!selectedId && (
            <div className="p-4 space-y-1.5">
              {listLoading ? (
                <div className="flex items-center justify-center py-20 text-text-muted gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading orders…
                </div>
              ) : !orders || orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
                  <div className="w-16 h-16 rounded-full bg-panel flex items-center justify-center text-3xl">📋</div>
                  <p className="font-display font-semibold text-text-primary">No orders on this day</p>
                  <p className="text-sm text-text-muted">Try a different date</p>
                </div>
              ) : orders.map((o: any) => {
                const st = STATUS[o.status] || { label: o.status, cls: 'text-text-muted' };
                const TypeIcon = TYPE_ICON[o.orderType || o.order_type] || ShoppingBag;
                const tableNum = o.tableNumber || o.table_number;
                const payMethod = o.paymentMethod || o.payment_method;
                return (
                  <button key={o.id} onClick={() => setSelectedId(o.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-panel-2 border border-transparent hover:border-border transition-all text-left group">
                    <div className="w-11 h-11 rounded-xl bg-panel-2 border border-border flex flex-col items-center justify-center flex-shrink-0 gap-0.5">
                      <span className="text-[9px] text-text-muted tabular-nums leading-none">
                        {fmtTime(o.createdAt || o.created_at)}
                      </span>
                      <TypeIcon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-text-primary text-sm">
                        {o.orderNumber || o.order_number}
                        {tableNum && <span className="text-text-muted font-normal"> · T{tableNum}</span>}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {o.cashierName || 'Staff'}
                        {payMethod && ` · ${PAY_LABEL[payMethod] || payMethod}`}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-display font-bold text-sm text-text-primary tabular-nums">
                        {$$(o.totalAmount || o.total_amount)}
                      </p>
                      <p className={`text-[10px] font-bold uppercase tracking-wider ${st.cls}`}>{st.label}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          )}

          {/* DETAIL */}
          {selectedId && (
            <div className="p-5">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20 text-text-muted gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading order…
                </div>
              ) : !detail ? (
                <p className="text-center py-10 text-text-muted">Order not found</p>
              ) : <OrderDetail order={detail} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderDetail({ order: o }: { order: any }) {
  const st       = STATUS[o.status] || { label: o.status, cls: 'text-text-muted' };
  const items    = (Array.isArray(o.items) ? o.items : []).filter(Boolean);
  const subtotal = n(o.subtotal);
  const tax      = n(o.taxAmount || o.tax_amount);
  const discount = n(o.discountAmount || o.discount_amount);
  const total    = n(o.totalAmount || o.total_amount);
  const typeRaw  = o.orderType || o.order_type || '';
  const typeLabel = typeRaw === 'dine_in' ? 'Dine-In' : typeRaw === 'delivery' ? 'Delivery' : 'Takeaway';
  const tableNum  = o.tableNumber || o.table_number;
  const payMethod = o.paymentMethod || o.payment_method;
  const payStatus = o.paymentStatus || o.payment_status;
  const payRef    = o.paymentReference || o.payment_reference;

  const StatusIcon = o.status === 'completed' ? CheckCircle2
    : o.status === 'cancelled' ? XCircle : Clock;

  return (
    <div className="space-y-4">

      {/* Meta */}
      <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
        {[
          ['Order Type', typeLabel + (tableNum ? ` · Table ${tableNum}` : '')],
          ['Cashier', o.cashierName || '—'],
          ['Date / Time', fmtDT(o.createdAt || o.created_at)],
        ].map(([label, val]) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5 gap-4">
            <span className="text-xs text-text-muted uppercase tracking-wider flex-shrink-0">{label}</span>
            <span className="text-sm font-semibold text-text-primary text-right">{val}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2.5 gap-4">
          <span className="text-xs text-text-muted uppercase tracking-wider">Status</span>
          <span className={`flex items-center gap-1 text-sm font-bold uppercase tracking-wider ${st.cls}`}>
            <StatusIcon className="w-3.5 h-3.5" />{st.label}
          </span>
        </div>
      </div>

      {/* Items */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Items Ordered</span>
          <span className="text-xs text-text-muted">{items.length} line{items.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-border">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-text-muted italic">No items recorded</p>
          ) : items.map((item: any, idx: number) => {
            const mi       = item.menuItem || item.menu_item || {};
            const name     = mi.name || item.name || 'Item';
            const qty      = item.quantity;
            const unitPrice = n(item.unitPrice || item.unit_price);
            const lineTotal = n(item.subtotal) || unitPrice * qty;
            return (
              <div key={item.id || idx} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                  {qty}
                </div>
                <span className="flex-1 text-sm text-text-primary">{name}</span>
                <span className="text-xs text-text-muted tabular-nums">{$$(unitPrice)} ea</span>
                <span className="font-semibold text-sm text-text-primary tabular-nums w-16 text-right">{$$(lineTotal)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-sm text-text-muted">Subtotal</span>
          <span className="text-sm tabular-nums text-text-primary">{$$(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between px-4 py-2.5">
            <span className="text-sm text-text-muted">Discount</span>
            <span className="text-sm tabular-nums text-emerald-400">-{$$(discount)}</span>
          </div>
        )}
        <div className="flex justify-between px-4 py-2.5">
          <span className="text-sm text-text-muted">VAT</span>
          <span className="text-sm tabular-nums text-text-primary">{$$(tax)}</span>
        </div>
        <div className="flex justify-between items-center px-4 py-3 bg-primary/5">
          <span className="font-display font-bold text-text-primary">TOTAL</span>
          <span className="font-display font-bold text-lg tabular-nums text-primary">{$$(total)}</span>
        </div>
      </div>

      {/* Payment */}
      {payMethod && (
        <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
          <div className="flex justify-between items-center px-4 py-2.5">
            <span className="text-xs text-text-muted uppercase tracking-wider">Payment Method</span>
            <span className="text-sm font-semibold text-text-primary">{PAY_LABEL[payMethod] || payMethod}</span>
          </div>
          <div className="flex justify-between items-center px-4 py-2.5">
            <span className="text-xs text-text-muted uppercase tracking-wider">Payment Status</span>
            <span className={`text-sm font-bold uppercase tracking-wider ${payStatus === 'paid' ? 'text-emerald-400' : 'text-yellow-400'}`}>
              {payStatus || '—'}
            </span>
          </div>
          {payRef && (
            <div className="flex justify-between items-center px-4 py-2.5">
              <span className="text-xs text-text-muted uppercase tracking-wider">Reference</span>
              <span className="text-sm font-mono text-text-primary">{payRef}</span>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {o.notes && (
        <div className="glass rounded-2xl px-4 py-3">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-text-primary">{o.notes}</p>
        </div>
      )}
    </div>
  );
}
