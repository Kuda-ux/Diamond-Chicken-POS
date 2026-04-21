import { useState } from 'react';
import { X, Printer, Lock, Diamond, Calculator } from 'lucide-react';
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
    if (isNaN(val) || val < 0) { setError('Enter a valid closing cash amount'); return; }
    setLoading(true);
    try {
      const res = await shiftsApi.close(val);
      setReport(res.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to close shift');
    } finally { setLoading(false); }
  };

  const handlePrint = () => window.print();
  const handleDone = () => { setReport(null); setClosingFloat(''); onClosed(); };

  const totals = report?.totals || {};
  const cashTakings = report?.paymentBreakdown?.find((p: any) => p.method === 'cash')?.revenue || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in print:static print:bg-transparent print:p-0">
      <div className="w-full max-w-lg glass-strong rounded-3xl shadow-2xl overflow-hidden border border-white/10 animate-scale-in max-h-[95vh] flex flex-col print:shadow-none print:border-none print:rounded-none print:max-h-none">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-soft border border-secondary/30 flex items-center justify-center">
              {report ? <Printer className="w-5 h-5 text-secondary" /> : <Lock className="w-5 h-5 text-secondary" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">
                {report ? 'Z-Report' : 'Close Shift'}
              </h2>
              <p className="text-xs text-text-muted">{report ? 'End of shift fiscal summary' : 'Count your drawer & close out'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-surface-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!report ? (
          <>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="glass rounded-2xl p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-info-soft border border-info/30 flex items-center justify-center flex-shrink-0">
                  <Calculator className="w-4 h-4 text-info" />
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  Count all cash in your drawer and enter the closing amount to generate a <strong className="text-text-primary">ZIMRA-compliant Z-Report</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Closing cash float (USD)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-display text-2xl text-text-muted">$</span>
                  <input
                    type="number" step="0.01" autoFocus value={closingFloat}
                    onChange={(e) => setClosingFloat(e.target.value)}
                    placeholder="0.00"
                    className="input pl-10 py-5 font-display text-3xl"
                    onKeyDown={(e) => e.key === 'Enter' && handleClose()}
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-danger-soft border border-danger/30 text-danger text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-danger" /> {error}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3 flex-shrink-0 no-print">
              <button onClick={onClose} disabled={loading} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleClose} disabled={loading} className="btn btn-primary flex-[2]">
                <Lock className="w-4 h-4" /> {loading ? 'Closing…' : 'Close & Generate Z-Report'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="p-6 overflow-y-auto text-text-primary print:text-black">
              {/* Receipt header */}
              <div className="text-center border-b border-dashed border-border pb-4 mb-4 print:border-black/20">
                <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-brand flex items-center justify-center print:bg-black">
                  <Diamond className="w-6 h-6 text-background" fill="currentColor" />
                </div>
                <p className="font-display text-2xl font-bold text-gradient print:text-black">Diamond Chicken</p>
                <p className="text-xs text-text-secondary mt-1 print:text-black">Z-REPORT • End of Shift</p>
                <div className="mt-3 text-[11px] text-text-muted space-y-0.5 print:text-black">
                  <p><strong className="text-text-primary print:text-black">Cashier:</strong> {report.cashierName}</p>
                  <p><strong className="text-text-primary print:text-black">Shift ID:</strong> {String(report.shiftId).slice(0, 8).toUpperCase()}</p>
                  <p>{new Date(report.startedAt).toLocaleString()}</p>
                  <p>→ {new Date(report.endedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2 mb-4">
                <Row label="Transactions" value={`${totals.transactionCount || 0}`} />
                <Row label="Total Revenue" value={`$${(totals.totalRevenue || 0).toFixed(2)}`} strong />
                <Row label="VAT Collected (15%)" value={`$${(totals.totalVat || 0).toFixed(2)}`} small />
                <Row label="Discounts Given" value={`$${(totals.totalDiscount || 0).toFixed(2)}`} small />
              </div>

              {/* Payment breakdown */}
              <div className="border-t border-dashed border-border pt-4 mb-4 print:border-black/20">
                <p className="font-semibold text-xs uppercase tracking-wider text-text-muted mb-2 print:text-black">Payment Breakdown</p>
                {report.paymentBreakdown?.length === 0 ? (
                  <p className="text-text-muted text-sm">No paid transactions</p>
                ) : (
                  <div className="space-y-1">
                    {report.paymentBreakdown?.map((p: any) => (
                      <Row key={p.method} label={`${p.method.toUpperCase()} (×${p.count})`} value={`$${p.revenue.toFixed(2)}`} small />
                    ))}
                  </div>
                )}
              </div>

              {/* Cash reconciliation */}
              <div className="border-t border-dashed border-border pt-4 space-y-1 print:border-black/20">
                <p className="font-semibold text-xs uppercase tracking-wider text-text-muted mb-2 print:text-black">Cash Reconciliation</p>
                <Row label="Opening Float" value={`$${(report.openingFloat || 0).toFixed(2)}`} small />
                <Row label="+ Cash Takings" value={`$${cashTakings.toFixed(2)}`} small />
                <Row label="= Expected Cash" value={`$${(report.expectedCash || 0).toFixed(2)}`} small />
                <Row label="Counted Closing Float" value={`$${(report.closingFloat || 0).toFixed(2)}`} small />
                <div className="mt-2 pt-2 border-t border-border print:border-black/20">
                  <Row
                    label="Variance"
                    value={`${(report.variance || 0) >= 0 ? '+' : ''}$${(report.variance || 0).toFixed(2)}`}
                    strong
                    danger={(report.variance || 0) < 0}
                  />
                </div>
              </div>

              <div className="text-center text-[10px] text-text-muted pt-4 mt-4 border-t border-dashed border-border print:border-black/20 print:text-black">
                ZIMRA Fiscal Summary • End of Shift Report<br />
                Generated {new Date().toLocaleString()}
              </div>
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3 no-print flex-shrink-0">
              <button onClick={handlePrint} className="btn btn-ghost flex-1">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={handleDone} className="btn btn-primary flex-1">Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({
  label, value, strong, small, danger,
}: { label: string; value: string; strong?: boolean; small?: boolean; danger?: boolean }) {
  return (
    <div className={`flex justify-between items-center ${small ? 'text-sm' : ''}`}>
      <span className={`${strong ? 'font-display font-bold text-text-primary print:text-black' : 'text-text-secondary print:text-black'}`}>{label}</span>
      <span className={`${strong ? `font-display text-xl font-bold tabular-nums ${danger ? 'text-danger print:text-black' : 'text-gradient print:text-black'}` : 'font-semibold text-text-primary tabular-nums print:text-black'}`}>
        {value}
      </span>
    </div>
  );
}
