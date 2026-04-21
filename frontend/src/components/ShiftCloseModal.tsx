import { useState } from 'react';
import { X, Printer, Lock } from 'lucide-react';
import { shiftsApi } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onClosed: () => void;
}

export default function ShiftCloseModal({ open, onClose, onClosed }: Props) {
  const [closingFloat, setClosingFloat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<any>(null);

  if (!open) return null;

  const handleClose = async () => {
    setError('');
    const val = parseFloat(closingFloat);
    if (isNaN(val) || val < 0) {
      setError('Enter a valid closing cash amount');
      return;
    }
    setLoading(true);
    try {
      const res = await shiftsApi.close(val);
      setReport(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to close shift');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDone = () => {
    setReport(null);
    setClosingFloat('');
    onClosed();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 print:static print:bg-transparent">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden print:shadow-none print:border-none print:rounded-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border print:hidden">
          <h2 className="font-display text-xl font-bold">
            {report ? 'Z-Report' : 'Close Shift'}
          </h2>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-surface-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!report ? (
          <>
            <div className="p-6 space-y-4">
              <p className="text-text-secondary text-sm">
                Count the cash in your drawer and enter the closing amount to generate the ZIMRA-compliant Z-Report.
              </p>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Closing cash float (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  autoFocus
                  value={closingFloat}
                  onChange={(e) => setClosingFloat(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-4 py-4 bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-display text-2xl"
                />
              </div>
              {error && <div className="text-danger text-sm">{error}</div>}
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button onClick={onClose} disabled={loading} className="flex-1 py-3 glass rounded-lg font-semibold hover:bg-surface-2">
                Cancel
              </button>
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 py-3 bg-primary text-background font-display font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" /> {loading ? 'Closing…' : 'Close & Generate Z-Report'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 space-y-4 text-text-primary print:text-black">
              <div className="text-center border-b border-dashed border-border pb-3">
                <p className="font-display text-2xl font-bold">Diamond Chicken</p>
                <p className="text-sm text-text-secondary">Z-REPORT / End of Shift</p>
                <p className="text-xs text-text-muted mt-1">
                  Cashier: {report.cashierName} • Shift ID: {String(report.shiftId).slice(0, 8)}
                </p>
                <p className="text-xs text-text-muted">
                  {new Date(report.startedAt).toLocaleString()} → {new Date(report.endedAt).toLocaleString()}
                </p>
              </div>

              <Row label="Transactions" value={`${report.totals?.transactionCount || 0}`} />
              <Row label="Total Revenue" value={`$${(report.totals?.totalRevenue || 0).toFixed(2)}`} strong />
              <Row label="VAT Collected (15%)" value={`$${(report.totals?.totalVat || 0).toFixed(2)}`} />
              <Row label="Discounts Given" value={`$${(report.totals?.totalDiscount || 0).toFixed(2)}`} />

              <div className="border-t border-dashed border-border pt-3">
                <p className="font-semibold text-sm mb-2">Payment Breakdown</p>
                {report.paymentBreakdown?.length === 0 ? (
                  <p className="text-text-muted text-sm">No paid transactions</p>
                ) : (
                  report.paymentBreakdown?.map((p: any) => (
                    <Row
                      key={p.method}
                      label={`${p.method.toUpperCase()} (×${p.count})`}
                      value={`$${p.revenue.toFixed(2)}`}
                      small
                    />
                  ))
                )}
              </div>

              <div className="border-t border-dashed border-border pt-3 space-y-1">
                <Row label="Opening Float" value={`$${(report.openingFloat || 0).toFixed(2)}`} small />
                <Row label="+ Cash Takings" value={`$${((report.paymentBreakdown?.find((p: any) => p.method === 'cash')?.revenue) || 0).toFixed(2)}`} small />
                <Row label="= Expected Cash" value={`$${(report.expectedCash || 0).toFixed(2)}`} small />
                <Row label="Closing Float (counted)" value={`$${(report.closingFloat || 0).toFixed(2)}`} small />
                <Row
                  label="Variance"
                  value={`${(report.variance || 0) >= 0 ? '+' : ''}$${(report.variance || 0).toFixed(2)}`}
                  strong
                />
              </div>

              <div className="text-center text-xs text-text-muted pt-3 border-t border-dashed border-border">
                ZIMRA Fiscal Summary • End of Shift Report
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3 print:hidden">
              <button
                onClick={handlePrint}
                className="flex-1 py-3 glass rounded-lg font-semibold hover:bg-surface-2 flex items-center justify-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print
              </button>
              <button
                onClick={handleDone}
                className="flex-1 py-3 bg-primary text-background font-display font-bold rounded-lg hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, strong, small }: { label: string; value: string; strong?: boolean; small?: boolean }) {
  return (
    <div className={`flex justify-between ${small ? 'text-sm' : ''} ${strong ? 'font-display font-bold text-lg text-primary' : ''}`}>
      <span className={strong ? '' : 'text-text-secondary'}>{label}</span>
      <span className={strong ? '' : 'text-text-primary'}>{value}</span>
    </div>
  );
}
