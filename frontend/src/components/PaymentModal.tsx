import { useState } from 'react';
import {
  X, Banknote, Smartphone, QrCode, CreditCard, Building2, CheckCircle2, Loader2,
  Printer, MessageCircle, ExternalLink, Settings as SettingsIcon, ArrowRight, Home, Truck, UtensilsCrossed,
} from 'lucide-react';
import { ordersApi, paymentsApi, receiptsApi } from '../services/api';
import { useCartStore } from '../stores/cartStore';
import {
  isDesktop, getSavedPrinter, openPrintDialog, printReceipt, printKitchenTicket, whatsAppShareUrl,
} from '../services/printer';
import PrinterPickerModal from './PrinterPickerModal';

type PaymentMethod = 'cash' | 'ecocash' | 'innbucks' | 'zipit' | 'card';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (orderNumber: string, change?: number) => void;
}

const METHODS: { key: PaymentMethod; label: string; sub: string; icon: any; accent: string }[] = [
  { key: 'cash', label: 'Cash', sub: 'USD notes', icon: Banknote, accent: 'success' },
  { key: 'ecocash', label: 'EcoCash', sub: 'USSD push', icon: Smartphone, accent: 'info' },
  { key: 'innbucks', label: 'InnBucks', sub: 'QR code', icon: QrCode, accent: 'accent' },
  { key: 'zipit', label: 'ZIPIT', sub: 'Bank transfer', icon: Building2, accent: 'cyan' },
  { key: 'card', label: 'Card', sub: 'Visa / Mastercard', icon: CreditCard, accent: 'secondary' },
];

const ORDER_TYPES: { key: 'dine_in' | 'takeaway' | 'delivery'; label: string; icon: any }[] = [
  { key: 'dine_in', label: 'Dine-in', icon: UtensilsCrossed },
  { key: 'takeaway', label: 'Takeaway', icon: Home },
  { key: 'delivery', label: 'Delivery', icon: Truck },
];

export default function PaymentModal({ open, onClose, onSuccess }: PaymentModalProps) {
  const cart = useCartStore();
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [amountTendered, setAmountTendered] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<any>(null);
  const [printStatus, setPrintStatus] = useState<string>('');
  const [printerPickerOpen, setPrinterPickerOpen] = useState(false);
  const [savedPrinter, setSavedPrinterState] = useState<string>(getSavedPrinter());

  if (!open) return null;

  const total = cart.getTotal();
  const tendered = parseFloat(amountTendered) || 0;
  const change = Math.max(0, tendered - total);

  const reset = () => {
    setMethod(null); setAmountTendered(''); setPhoneNumber('');
    setError(''); setResult(null); setLoading(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const validate = (): string | null => {
    if (!method) return 'Select a payment method';
    if (method === 'cash' && tendered < total) return 'Amount tendered is less than total';
    if (method === 'ecocash' && !/^07\d{8}$/.test(phoneNumber)) return 'Enter a valid phone e.g. 0771234567';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate(); if (err) { setError(err); return; }
    setError(''); setLoading(true);
    try {
      const orderRes = await ordersApi.create({
        orderType: cart.orderType,
        tableNumber: cart.tableNumber || undefined,
        items: cart.items.map(i => ({ menuItemId: i.menuItemId, quantity: i.quantity, modifiers: i.modifiers })),
        discountAmount: cart.discountAmount || undefined,
        notes: cart.notes || undefined,
      });
      const order = orderRes.data.data;

      // Print kitchen ticket immediately — fire-and-forget, never blocks payment flow
      printKitchenTicket({
        orderNumber: order.order_number || order.orderNumber,
        orderType: cart.orderType,
        tableNumber: cart.tableNumber || null,
        notes: cart.notes || null,
        items: cart.items.map((i) => ({ name: i.name, quantity: i.quantity })),
        createdAt: new Date(),
      }).catch(() => {/* silent */});

      let paymentRes;
      switch (method) {
        case 'cash': paymentRes = await paymentsApi.processCash(order.id, tendered); break;
        case 'ecocash': paymentRes = await paymentsApi.processEcocash(order.id, phoneNumber); break;
        case 'innbucks': paymentRes = await paymentsApi.processInnbucks(order.id); break;
        case 'zipit': paymentRes = await paymentsApi.processZipit(order.id); break;
        case 'card': paymentRes = await paymentsApi.processCard(order.id); break;
      }
      await paymentsApi.confirm(order.id);

      setResult({
        orderId: order.id,
        orderNumber: order.order_number || order.orderNumber,
        change: method === 'cash' ? change : undefined,
        payment: paymentRes?.data.data,
      });

      // Auto-print on desktop app
      if (isDesktop()) {
        setTimeout(async () => {
          try {
            const receiptRes = await receiptsApi.get(order.id);
            const { receipt, restaurant } = receiptRes.data.data;
            await printReceipt({ ...receipt, restaurant, change: method === 'cash' ? change : undefined });
          } catch (e) {
            console.error('Auto-print failed:', e);
          }
        }, 500);
      }
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Payment failed');
    } finally { setLoading(false); }
  };

  const handleDone = () => {
    const orderNumber = result.orderNumber; const finalChange = result.change;
    reset(); cart.clearCart(); onSuccess(orderNumber, finalChange);
  };

  const handleThermalPrint = async () => {
    if (!result) return;
    setPrintStatus('Printing…');
    try {
      const receiptRes = await receiptsApi.get(result.orderId);
      const { receipt, restaurant } = receiptRes.data.data;
      const res = await printReceipt({ ...receipt, restaurant, change: result.change });
      if (res.ok) {
        setPrintStatus(res.fallback ? 'Sent to print dialog ✓' : 'Printed ✓');
      } else {
        setPrintStatus(res.error || 'Print failed');
      }
    } catch (e: any) {
      setPrintStatus(e?.response?.data?.message || e?.message || 'Print failed');
    }
  };
  const handleBrowserPrint = () => { if (result) openPrintDialog(receiptsApi.htmlUrl(result.orderId)); };
  const handleWhatsApp = () => {
    if (!result) return;
    const url = receiptsApi.htmlUrl(result.orderId);
    const totalStr = cart.getTotal().toFixed(2);
    window.open(whatsAppShareUrl(url, result.orderNumber, totalStr), '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-2xl glass-strong rounded-3xl shadow-2xl overflow-hidden animate-scale-in border border-white/10 max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            {result ? (
              <div className="w-10 h-10 rounded-xl bg-success-soft border border-success/30 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-success" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-background" />
              </div>
            )}
            <div>
              <h2 className="font-display text-xl font-bold text-text-primary">
                {result ? 'Payment Complete' : 'Checkout'}
              </h2>
              <p className="text-xs text-text-muted">
                {result ? `Order ${result.orderNumber}` : `${cart.items.length} items • ${cart.items.reduce((s, i) => s + i.quantity, 0)} units`}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="w-10 h-10 rounded-xl hover:bg-surface-2 flex items-center justify-center text-text-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        {result ? (
          /* ---------- SUCCESS ---------- */
          <div className="p-8 text-center overflow-y-auto">
            <div className="relative mx-auto w-24 h-24 mb-5">
              <div className="absolute inset-0 rounded-full bg-success-soft animate-ping opacity-40" />
              <div className="relative w-24 h-24 rounded-full bg-success/20 border-2 border-success flex items-center justify-center success-glow animate-bounce-in">
                <CheckCircle2 className="w-12 h-12 text-success" />
              </div>
            </div>
            <h3 className="font-display text-3xl font-bold text-text-primary mb-1">Order {result.orderNumber}</h3>
            <p className="text-text-secondary mb-6 flex items-center justify-center gap-2">
              <span className="dot dot-live" /> Sent to the kitchen
            </p>

            {result.change !== undefined && result.change > 0 && (
              <div className="glass-elevated rounded-2xl p-6 mb-5 amber-glow-soft">
                <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Change due</p>
                <p className="font-display text-5xl font-bold text-gradient">${result.change.toFixed(2)}</p>
              </div>
            )}

            {result.payment?.qrData && (
              <div className="glass rounded-2xl p-5 mb-5">
                <p className="text-xs text-text-muted mb-2 uppercase tracking-wider">InnBucks QR</p>
                <code className="text-xs break-all text-text-primary font-mono">{result.payment.qrData}</code>
              </div>
            )}

            {result.payment?.bankDetails && (
              <div className="glass rounded-2xl p-5 mb-5 text-left">
                <p className="text-xs text-text-muted mb-3 uppercase tracking-wider">ZIPIT transfer details</p>
                <div className="space-y-2 text-sm">
                  <DetailRow label="Bank" value={result.payment.bankDetails.bank} />
                  <DetailRow label="Account" value={result.payment.bankDetails.account} mono />
                  <DetailRow label="Reference" value={result.payment.bankDetails.reference} mono />
                </div>
              </div>
            )}

            {/* Receipt actions */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-text-muted uppercase tracking-wider">Receipt</p>
                <button
                  onClick={() => setPrinterPickerOpen(true)}
                  className="flex items-center gap-1 text-[10px] text-text-muted hover:text-primary transition-colors"
                >
                  <SettingsIcon className="w-3 h-3" />
                  {isDesktop() && savedPrinter ? savedPrinter : 'Printer settings'}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <ActionButton onClick={handleThermalPrint} Icon={Printer} label="Print" tint="primary" />
                <ActionButton onClick={handleBrowserPrint} Icon={ExternalLink} label="Browser" tint="info" />
                <ActionButton onClick={handleWhatsApp} Icon={MessageCircle} label="WhatsApp" tint="success" />
              </div>
              {printStatus && <div className="mt-2 text-center text-xs text-text-secondary">{printStatus}</div>}
            </div>

            {printerPickerOpen && (
              <PrinterPickerModal
                onClose={() => setPrinterPickerOpen(false)}
                onSaved={(name) => { setSavedPrinterState(name); setPrinterPickerOpen(false); }}
              />
            )}

            <button onClick={handleDone} className="btn btn-primary w-full py-4 text-base">
              New Order <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* ---------- CHECKOUT FORM ---------- */
          <>
            <div className="p-6 space-y-5 overflow-y-auto">
              {/* Order summary */}
              <div className="glass rounded-2xl p-4">
                <div className="flex justify-between text-xs text-text-muted uppercase tracking-wider mb-2">
                  <span>Order Total</span>
                  <span>{cart.items.length} items</span>
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-xs text-text-secondary flex gap-3">
                      <span>Sub ${cart.getSubtotal().toFixed(2)}</span>
                      <span>VAT ${cart.getTax().toFixed(2)}</span>
                    </div>
                  </div>
                  <p className="font-display text-4xl font-bold text-gradient tabular-nums">${total.toFixed(2)}</p>
                </div>
              </div>

              {/* Order type */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Order Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {ORDER_TYPES.map(t => {
                    const Icon = t.icon;
                    const active = cart.orderType === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => cart.setOrderType(t.key)}
                        className={`py-3 px-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                          active ? 'bg-brand text-background amber-glow' : 'glass text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        <Icon className="w-4 h-4" /> {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {cart.orderType === 'dine_in' && (
                <div className="animate-slide-up">
                  <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Table number</label>
                  <input
                    value={cart.tableNumber}
                    onChange={(e) => cart.setTableNumber(e.target.value)}
                    placeholder="e.g. 5"
                    className="input"
                  />
                </div>
              )}

              {/* Payment methods */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-5 gap-2">
                  {METHODS.map(m => {
                    const Icon = m.icon;
                    const active = method === m.key;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setMethod(m.key)}
                        className={`relative p-3 rounded-2xl border transition-all flex flex-col items-center gap-1.5 overflow-hidden ${
                          active
                            ? 'bg-primary-soft border-primary amber-glow-soft scale-[1.03]'
                            : 'glass border-border hover:border-primary/30'
                        }`}
                      >
                        {active && <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-primary/20 to-transparent" />}
                        <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center ${
                          active ? 'bg-brand text-background' : 'bg-surface-2 text-text-primary'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="relative text-center leading-tight">
                          <p className="text-[11px] font-bold text-text-primary">{m.label}</p>
                          <p className="text-[9px] text-text-muted">{m.sub}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Method-specific inputs */}
              {method === 'cash' && (
                <div className="animate-slide-up">
                  <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Amount tendered (USD)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-2xl text-text-muted">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      placeholder={total.toFixed(2)}
                      className="input pl-10 py-5 font-display text-3xl"
                    />
                  </div>
                  {tendered > 0 && (
                    <div className={`mt-3 p-4 rounded-2xl flex items-center justify-between animate-scale-in ${
                      tendered >= total ? 'bg-success-soft border border-success/30' : 'bg-danger-soft border border-danger/30'
                    }`}>
                      <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                        {tendered >= total ? 'Change due' : 'Short by'}
                      </span>
                      <span className={`font-display text-3xl font-bold ${tendered >= total ? 'text-success' : 'text-danger'}`}>
                        ${Math.abs(tendered - total).toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[total, 10, 20, 50].map((v, i) => (
                      <button
                        key={i}
                        onClick={() => setAmountTendered(v.toFixed(2))}
                        className="py-2 glass rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary"
                      >
                        {i === 0 ? 'Exact' : `$${v}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {method === 'ecocash' && (
                <div className="animate-slide-up">
                  <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Customer phone</label>
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="0771234567"
                    className="input py-4 font-mono text-lg"
                  />
                  <p className="text-[11px] text-text-muted mt-2">A USSD push will be sent to this number for confirmation.</p>
                </div>
              )}

              {method === 'innbucks' && (
                <div className="animate-slide-up p-4 rounded-2xl bg-accent/5 border border-accent/20 text-sm text-text-secondary">
                  A QR code will be generated for the customer to scan with their InnBucks app.
                </div>
              )}

              {method === 'zipit' && (
                <div className="animate-slide-up p-4 rounded-2xl bg-info/5 border border-info/20 text-sm text-text-secondary">
                  A bank reference will be generated for the customer to do an interbank transfer.
                </div>
              )}

              {method === 'card' && (
                <div className="animate-slide-up p-4 rounded-2xl bg-secondary/5 border border-secondary/20 text-sm text-text-secondary">
                  The customer will be routed to Paynow Zimbabwe card processing.
                </div>
              )}

              {error && (
                <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm flex items-center gap-2 animate-scale-in">
                  <span className="w-2 h-2 rounded-full bg-danger" /> {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
              <button onClick={handleClose} disabled={loading} className="btn btn-ghost flex-1 py-3.5">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={loading || !method} className="btn btn-primary flex-[2] py-3.5 text-base">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</> : <>Pay ${total.toFixed(2)} <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-text-muted">{label}</span>
      <span className={`font-semibold text-text-primary ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

function ActionButton({
  onClick, Icon, label, tint,
}: { onClick: () => void; Icon: any; label: string; tint: 'primary' | 'info' | 'success' | 'default' }) {
  const tints = {
    primary: 'text-primary border-primary/30 hover:bg-primary-soft',
    info: 'text-info border-info/30 hover:bg-info-soft',
    success: 'text-success border-success/30 hover:bg-success-soft',
    default: 'text-text-secondary border-border hover:bg-surface-2',
  }[tint];
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 py-3 glass rounded-xl border transition-all ${tints}`}>
      <Icon className="w-5 h-5" />
      <span className="text-xs font-semibold">{label}</span>
    </button>
  );
}
