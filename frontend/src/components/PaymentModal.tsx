import { useState } from 'react';
import { X, Banknote, Smartphone, QrCode, CreditCard, Building2, CheckCircle2, Loader2, Printer, MessageCircle, ExternalLink, Usb } from 'lucide-react';
import { ordersApi, paymentsApi, receiptsApi } from '../services/api';
import { useCartStore } from '../stores/cartStore';
import {
  connectPrinter,
  disconnectPrinter,
  isPrinterConnected,
  openPrintDialog,
  printReceipt,
  whatsAppShareUrl,
} from '../services/printer';

type PaymentMethod = 'cash' | 'ecocash' | 'innbucks' | 'zipit' | 'card';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (orderNumber: string, change?: number) => void;
}

const METHODS: { key: PaymentMethod; label: string; icon: any; color: string }[] = [
  { key: 'cash', label: 'Cash (USD)', icon: Banknote, color: 'text-green-400' },
  { key: 'ecocash', label: 'EcoCash', icon: Smartphone, color: 'text-blue-400' },
  { key: 'innbucks', label: 'InnBucks', icon: QrCode, color: 'text-purple-400' },
  { key: 'zipit', label: 'ZIPIT', icon: Building2, color: 'text-cyan-400' },
  { key: 'card', label: 'Card / Visa', icon: CreditCard, color: 'text-orange-400' },
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
  const [printerReady, setPrinterReady] = useState(isPrinterConnected());

  if (!open) return null;

  const total = cart.getTotal();
  const tendered = parseFloat(amountTendered) || 0;
  const change = Math.max(0, tendered - total);

  const reset = () => {
    setMethod(null);
    setAmountTendered('');
    setPhoneNumber('');
    setError('');
    setResult(null);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validate = (): string | null => {
    if (!method) return 'Select a payment method';
    if (method === 'cash' && tendered < total) return 'Amount tendered is less than total';
    if (method === 'ecocash' && !/^07\d{8}$/.test(phoneNumber)) return 'Enter valid phone (e.g. 0771234567)';
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setError('');
    setLoading(true);

    try {
      // 1. Create the order
      const orderRes = await ordersApi.create({
        orderType: cart.orderType,
        tableNumber: cart.tableNumber || undefined,
        items: cart.items.map(i => ({
          menuItemId: i.menuItemId,
          quantity: i.quantity,
          modifiers: i.modifiers,
        })),
        discountAmount: cart.discountAmount || undefined,
        notes: cart.notes || undefined,
      });
      const order = orderRes.data.data;

      // 2. Process payment based on method
      let paymentRes;
      switch (method) {
        case 'cash':
          paymentRes = await paymentsApi.processCash(order.id, tendered);
          break;
        case 'ecocash':
          paymentRes = await paymentsApi.processEcocash(order.id, phoneNumber);
          break;
        case 'innbucks':
          paymentRes = await paymentsApi.processInnbucks(order.id);
          break;
        case 'zipit':
          paymentRes = await paymentsApi.processZipit(order.id);
          break;
        case 'card':
          paymentRes = await paymentsApi.processCard(order.id);
          break;
      }

      // 3. Confirm payment (marks as paid + confirmed, pushes to kitchen)
      await paymentsApi.confirm(order.id);

      setResult({
        orderId: order.id,
        orderNumber: order.order_number || order.orderNumber,
        change: method === 'cash' ? change : undefined,
        payment: paymentRes?.data.data,
      });
    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    const orderNumber = result.orderNumber;
    const finalChange = result.change;
    reset();
    cart.clearCart();
    onSuccess(orderNumber, finalChange);
  };

  const handleConnectPrinter = async () => {
    setPrintStatus('');
    try {
      await connectPrinter();
      setPrinterReady(true);
      setPrintStatus('Printer connected ✓');
    } catch (e: any) {
      setPrintStatus(e.message || 'Failed to connect');
    }
  };

  const handleThermalPrint = async () => {
    if (!result) return;
    setPrintStatus('Printing…');
    try {
      const receiptRes = await receiptsApi.get(result.orderId);
      const { receipt, restaurant } = receiptRes.data.data;
      await printReceipt({ ...receipt, restaurant, change: result.change });
      setPrintStatus('Printed ✓');
    } catch (e: any) {
      setPrintStatus(e.message || 'Print failed');
    }
  };

  const handleBrowserPrint = () => {
    if (!result) return;
    openPrintDialog(receiptsApi.htmlUrl(result.orderId));
  };

  const handleWhatsApp = () => {
    if (!result) return;
    const url = receiptsApi.htmlUrl(result.orderId);
    const total = cart.getTotal().toFixed(2);
    window.open(whatsAppShareUrl(url, result.orderNumber, total), '_blank');
  };

  const handleDisconnectPrinter = async () => {
    await disconnectPrinter();
    setPrinterReady(false);
    setPrintStatus('Printer disconnected');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-display text-2xl font-bold text-text-primary">
            {result ? 'Payment Complete' : 'Payment'}
          </h2>
          <button onClick={handleClose} className="w-9 h-9 rounded-lg hover:bg-surface-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Success screen */}
        {result ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-20 h-20 mx-auto mb-4 text-success" />
            <h3 className="font-display text-3xl font-bold text-primary mb-2">Order {result.orderNumber}</h3>
            <p className="text-text-secondary mb-6">Sent to kitchen</p>

            {result.change !== undefined && result.change > 0 && (
              <div className="glass-elevated rounded-xl p-6 mb-6">
                <p className="text-sm text-text-secondary mb-1">Change due</p>
                <p className="font-display text-5xl font-bold text-primary">${result.change.toFixed(2)}</p>
              </div>
            )}

            {result.payment?.qrData && (
              <div className="glass-elevated rounded-xl p-6 mb-6">
                <p className="text-sm text-text-secondary mb-2">InnBucks QR:</p>
                <code className="text-xs break-all text-text-primary">{result.payment.qrData}</code>
              </div>
            )}

            {result.payment?.bankDetails && (
              <div className="glass-elevated rounded-xl p-6 mb-6 text-left">
                <p className="text-sm text-text-secondary mb-3">ZIPIT transfer details:</p>
                <div className="space-y-1 text-sm">
                  <p><span className="text-text-muted">Bank:</span> <span className="font-semibold">{result.payment.bankDetails.bank}</span></p>
                  <p><span className="text-text-muted">Account:</span> <span className="font-semibold">{result.payment.bankDetails.account}</span></p>
                  <p><span className="text-text-muted">Reference:</span> <span className="font-semibold">{result.payment.bankDetails.reference}</span></p>
                </div>
              </div>
            )}

            {/* Receipt actions */}
            <div className="space-y-2 mb-4">
              <div className="grid grid-cols-3 gap-2">
                {printerReady ? (
                  <button
                    onClick={handleThermalPrint}
                    className="flex flex-col items-center gap-1 py-3 glass border border-primary/30 rounded-lg hover:bg-primary/10 transition-all"
                    title="Print to thermal printer"
                  >
                    <Printer className="w-5 h-5 text-primary" />
                    <span className="text-xs font-semibold">Print</span>
                  </button>
                ) : (
                  <button
                    onClick={handleConnectPrinter}
                    className="flex flex-col items-center gap-1 py-3 glass border border-border rounded-lg hover:bg-surface-2 transition-all"
                    title="Connect USB/Serial thermal printer"
                  >
                    <Usb className="w-5 h-5 text-text-secondary" />
                    <span className="text-xs font-semibold">Connect</span>
                  </button>
                )}
                <button
                  onClick={handleBrowserPrint}
                  className="flex flex-col items-center gap-1 py-3 glass border border-border rounded-lg hover:bg-surface-2 transition-all"
                  title="Open receipt in browser and print"
                >
                  <ExternalLink className="w-5 h-5 text-info" />
                  <span className="text-xs font-semibold">Browser</span>
                </button>
                <button
                  onClick={handleWhatsApp}
                  className="flex flex-col items-center gap-1 py-3 glass border border-border rounded-lg hover:bg-surface-2 transition-all"
                  title="Share digital receipt via WhatsApp"
                >
                  <MessageCircle className="w-5 h-5 text-green-400" />
                  <span className="text-xs font-semibold">WhatsApp</span>
                </button>
              </div>
              {printerReady && (
                <button
                  onClick={handleDisconnectPrinter}
                  className="w-full text-xs text-text-muted hover:text-text-secondary py-1"
                >
                  Disconnect printer
                </button>
              )}
              {printStatus && (
                <div className="text-center text-xs text-text-secondary">{printStatus}</div>
              )}
            </div>

            <button
              onClick={handleDone}
              className="w-full py-4 bg-primary text-background font-display font-bold text-lg rounded-xl hover:bg-primary/90 transition-all amber-glow"
            >
              New Order
            </button>
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Order summary */}
              <div className="glass rounded-xl p-4 space-y-1 text-sm">
                <div className="flex justify-between text-text-secondary">
                  <span>Subtotal</span><span>${cart.getSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span>Tax (15%)</span><span>${cart.getTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border font-display text-xl font-bold text-primary">
                  <span>Total</span><span>${total.toFixed(2)}</span>
                </div>
              </div>

              {/* Order type */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Order type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['dine_in', 'takeaway', 'delivery'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => cart.setOrderType(t)}
                      className={`py-3 rounded-lg font-medium capitalize transition-all ${
                        cart.orderType === t ? 'bg-primary text-background' : 'glass text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t.replace('_', '-')}
                    </button>
                  ))}
                </div>
              </div>

              {cart.orderType === 'dine_in' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Table number</label>
                  <input
                    value={cart.tableNumber}
                    onChange={(e) => cart.setTableNumber(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-4 py-3 bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {/* Payment methods */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">Payment method</label>
                <div className="grid grid-cols-5 gap-2">
                  {METHODS.map(m => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.key}
                        onClick={() => setMethod(m.key)}
                        className={`p-3 rounded-lg border transition-all flex flex-col items-center gap-1 ${
                          method === m.key
                            ? 'bg-primary/10 border-primary text-text-primary'
                            : 'glass border-border hover:border-primary/50'
                        }`}
                      >
                        <Icon className={`w-6 h-6 ${m.color}`} />
                        <span className="text-xs text-center leading-tight">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Method-specific inputs */}
              {method === 'cash' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Amount tendered (USD)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amountTendered}
                    onChange={(e) => setAmountTendered(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className="w-full px-4 py-4 bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-display text-2xl"
                  />
                  {tendered >= total && (
                    <p className="mt-2 text-lg font-display text-primary">Change: ${change.toFixed(2)}</p>
                  )}
                </div>
              )}

              {method === 'ecocash' && (
                <div>
                  <label className="block text-sm text-text-secondary mb-2">Customer phone</label>
                  <input
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="0771234567"
                    className="w-full px-4 py-4 bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {error && <div className="text-danger text-sm">{error}</div>}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border flex gap-3">
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 py-3 glass rounded-lg font-semibold hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !method}
                className="flex-1 py-3 bg-primary text-background font-display font-bold rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</> : `Pay $${total.toFixed(2)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
