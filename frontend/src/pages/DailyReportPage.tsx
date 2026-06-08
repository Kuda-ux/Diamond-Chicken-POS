import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, Download, FileText, DollarSign, ShoppingBag,
  Package, AlertTriangle, Printer,
} from 'lucide-react';
import { statsApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

const money = (v: number | string | undefined) =>
  `$${(typeof v === 'string' ? parseFloat(v) : (v || 0)).toFixed(2)}`;

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash', ecocash: 'EcoCash', innbucks: 'InnBucks',
  zipit: 'ZIPIT', visa: 'Visa', mastercard: 'Mastercard', unpaid: 'Unpaid',
};

export default function DailyReportPage() {
  const { user } = useAuthStore();
  const reportRef = useRef<HTMLDivElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);

  const { data, isLoading } = useQuery({
    queryKey: ['daily-report', date],
    queryFn: async () => (await statsApi.dailyReport(date)).data.data,
  });

  const summary = data?.summary || {};
  const paymentMethods: any[] = data?.paymentMethods || [];
  const productsSold: any[] = data?.productsSold || [];
  const stockLevels: any[] = data?.stockLevels || [];
  const waste = data?.waste || { items: [], totalCost: 0 };

  const lowStockItems = stockLevels.filter((s: any) => s.quantity <= s.lowStockThreshold);

  const handlePrint = () => {
    const printContent = reportRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Daily Report - Diamond Chicken - ${date}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; padding: 24px; max-width: 800px; margin: 0 auto; }
          h1 { font-size: 22px; margin-bottom: 4px; }
          h2 { font-size: 16px; margin: 20px 0 8px; padding-bottom: 4px; border-bottom: 2px solid #f5a623; color: #333; }
          h3 { font-size: 13px; margin-bottom: 4px; color: #666; }
          .header { text-align: center; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 3px double #333; }
          .header p { color: #666; font-size: 12px; margin-top: 2px; }
          .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
          .kpi { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 12px; text-align: center; }
          .kpi .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; }
          .kpi .value { font-size: 20px; font-weight: 700; color: #1a1a1a; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
          th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #666; border-bottom: 2px solid #ddd; }
          td { padding: 6px 10px; border-bottom: 1px solid #eee; }
          .text-right { text-align: right; }
          .text-center { text-align: center; }
          .bold { font-weight: 700; }
          .danger { color: #dc2626; }
          .success { color: #16a34a; }
          .warn { color: #f59e0b; }
          .total-row { background: #f8f8f8; font-weight: 700; }
          .footer { margin-top: 32px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }
          .section { page-break-inside: avoid; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Diamond Chicken</h1>
          <p>Naiks Corner, Herbert Chitepo Street, Bulawayo</p>
          <p style="margin-top:8px; font-size:14px; font-weight:600;">Daily Report &mdash; ${formatDateDisplay(date)}</p>
        </div>

        <div class="section">
          <h2>Sales Summary</h2>
          <div class="kpi-grid">
            <div class="kpi"><div class="label">Revenue</div><div class="value">${money(summary.totalRevenue)}</div></div>
            <div class="kpi"><div class="label">Orders</div><div class="value">${summary.paidOrders || 0}</div></div>
            <div class="kpi"><div class="label">Avg Order</div><div class="value">${money(summary.averageOrderValue)}</div></div>
            <div class="kpi"><div class="label">Tax Collected</div><div class="value">${money(summary.totalTax)}</div></div>
          </div>
        </div>

        ${paymentMethods.length > 0 ? `
        <div class="section">
          <h2>Payment Methods</h2>
          <table>
            <thead><tr><th>Method</th><th class="text-center">Orders</th><th class="text-right">Revenue</th></tr></thead>
            <tbody>
              ${paymentMethods.map((p: any) => `<tr><td>${METHOD_LABELS[p.method] || p.method}</td><td class="text-center">${p.count}</td><td class="text-right bold">${money(p.revenue)}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>` : ''}

        ${productsSold.length > 0 ? `
        <div class="section">
          <h2>Products Sold</h2>
          <table>
            <thead><tr><th>Product</th><th class="text-center">Qty Sold</th><th class="text-right">Revenue</th></tr></thead>
            <tbody>
              ${productsSold.map((p: any) => `<tr><td>${p.name}</td><td class="text-center">${p.quantitySold}</td><td class="text-right bold">${money(p.revenue)}</td></tr>`).join('')}
              <tr class="total-row"><td>Total</td><td class="text-center">${productsSold.reduce((s: number, p: any) => s + p.quantitySold, 0)}</td><td class="text-right">${money(productsSold.reduce((s: number, p: any) => s + p.revenue, 0))}</td></tr>
            </tbody>
          </table>
        </div>` : ''}

        <div class="section">
          <h2>Remaining Stock (Ingredients)</h2>
          <table>
            <thead><tr><th>Ingredient</th><th class="text-center">Unit</th><th class="text-right">Qty Left</th><th class="text-right">Threshold</th><th class="text-center">Status</th></tr></thead>
            <tbody>
              ${stockLevels.map((s: any) => {
                const status = s.quantity <= 0 ? '<span class="danger bold">OUT</span>' : s.quantity <= s.lowStockThreshold ? '<span class="warn bold">LOW</span>' : '<span class="success">OK</span>';
                return `<tr><td>${s.name}</td><td class="text-center">${s.unit}</td><td class="text-right bold">${s.quantity}</td><td class="text-right">${s.lowStockThreshold}</td><td class="text-center">${status}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>

        <div class="section">
          <h2>Waste</h2>
          ${waste.items.length > 0 ? `
          <table>
            <thead><tr><th>Ingredient</th><th class="text-center">Qty Wasted</th><th class="text-right">Unit Cost</th><th class="text-right">Waste Cost</th></tr></thead>
            <tbody>
              ${waste.items.map((w: any) => `<tr><td>${w.ingredientName}</td><td class="text-center">${w.totalWasted} ${w.unit}</td><td class="text-right">${money(w.unitCost)}</td><td class="text-right danger bold">${money(w.wasteCost)}</td></tr>`).join('')}
              <tr class="total-row"><td colspan="3">Total Waste Cost</td><td class="text-right danger">${money(waste.totalCost)}</td></tr>
            </tbody>
          </table>` : '<p style="color:#666;font-size:12px;">No waste recorded for this day.</p>'}
        </div>

        <div class="footer">
          <p>Generated on ${new Date().toLocaleString('en-GB', { timeZone: 'Africa/Harare' })} by ${user?.name || 'Admin'}</p>
          <p>Diamond Chicken POS &mdash; Daily Report</p>
        </div>
      </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-panel/90 backdrop-blur-lg border-b border-border">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-panel-2 border border-border hover:bg-panel-2 flex items-center justify-center flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-background" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-text-primary leading-none truncate">Daily Report</h1>
              <p className="text-[10px] sm:text-xs text-text-muted mt-1">Sales, stock & waste summary</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={today}
              className="input text-sm"
            />
            <button onClick={handlePrint} disabled={isLoading || !data} className="btn btn-primary text-xs sm:text-sm">
              <Download className="w-4 h-4" /> <span className="hidden sm:inline">Download PDF</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto p-4 sm:p-6 space-y-5" ref={reportRef}>
        {isLoading ? (
          <div className="text-center py-20 text-text-muted">Loading report…</div>
        ) : !data ? (
          <div className="text-center py-20 text-text-muted">Select a date to view the report</div>
        ) : (
          <>
            {/* Date banner */}
            <div className="bg-panel border border-border rounded-2xl p-5 sm:p-6 text-center">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary">{formatDateDisplay(date)}</h2>
              <p className="text-sm text-text-muted mt-1">Daily Business Report</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Revenue" value={money(summary.totalRevenue)} tint="primary" />
              <KpiCard icon={<ShoppingBag className="w-5 h-5" />} label="Paid Orders" value={String(summary.paidOrders || 0)} tint="info" />
              <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Avg Order" value={money(summary.averageOrderValue)} tint="success" />
              <KpiCard icon={<DollarSign className="w-5 h-5" />} label="Tax Collected" value={money(summary.totalTax)} tint="secondary" />
            </div>

            {/* Payment Methods */}
            {paymentMethods.length > 0 && (
              <div className="bg-panel border border-border rounded-2xl p-5 sm:p-6">
                <h3 className="font-display text-base sm:text-lg font-bold text-text-primary mb-4">Payment Methods</h3>
                <div className="space-y-2">
                  {paymentMethods.map((p: any) => {
                    const total = paymentMethods.reduce((s: number, x: any) => s + (x.revenue || 0), 0) || 1;
                    const pct = ((p.revenue / total) * 100).toFixed(0);
                    return (
                      <div key={p.method} className="flex items-center gap-3">
                        <span className="w-24 text-sm font-semibold text-text-primary">{METHOD_LABELS[p.method] || p.method}</span>
                        <div className="flex-1 h-6 bg-panel-2 rounded-lg overflow-hidden">
                          <div className="h-full bg-primary rounded-lg transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="w-12 text-right text-xs text-text-muted tabular-nums">{pct}%</span>
                        <span className="w-20 text-right font-display font-bold text-text-primary tabular-nums">{money(p.revenue)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Products Sold */}
            {productsSold.length > 0 && (
              <div className="bg-panel border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-primary" />
                  <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Products Sold</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
                      <tr>
                        <th className="text-left px-5 py-2">Product</th>
                        <th className="text-center px-5 py-2">Qty Sold</th>
                        <th className="text-right px-5 py-2">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productsSold.map((p: any, i: number) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-5 py-2.5 font-semibold text-text-primary text-sm">{p.name}</td>
                          <td className="px-5 py-2.5 text-center text-text-secondary tabular-nums">{p.quantitySold}</td>
                          <td className="px-5 py-2.5 text-right font-display font-bold text-primary tabular-nums">{money(p.revenue)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-panel-2">
                        <td className="px-5 py-2.5 font-bold text-text-primary">Total</td>
                        <td className="px-5 py-2.5 text-center font-bold tabular-nums">{productsSold.reduce((s: number, p: any) => s + p.quantitySold, 0)}</td>
                        <td className="px-5 py-2.5 text-right font-display font-bold text-primary tabular-nums">{money(productsSold.reduce((s: number, p: any) => s + p.revenue, 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Remaining Stock */}
            <div className="bg-panel border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Remaining Stock</h3>
                </div>
                {lowStockItems.length > 0 && (
                  <span className="chip chip-warn"><AlertTriangle className="w-3 h-3" /> {lowStockItems.length} low</span>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="text-left px-5 py-2">Ingredient</th>
                      <th className="text-center px-5 py-2">Unit</th>
                      <th className="text-right px-5 py-2">Qty Left</th>
                      <th className="text-right px-5 py-2">Threshold</th>
                      <th className="text-center px-5 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockLevels.map((s: any, i: number) => {
                      const isOut = s.quantity <= 0;
                      const isLow = !isOut && s.quantity <= s.lowStockThreshold;
                      return (
                        <tr key={i} className={`border-t border-border ${isOut ? 'bg-danger/5' : isLow ? 'bg-secondary/5' : ''}`}>
                          <td className="px-5 py-2.5 font-semibold text-text-primary text-sm">{s.name}</td>
                          <td className="px-5 py-2.5 text-center text-text-muted text-xs">{s.unit}</td>
                          <td className="px-5 py-2.5 text-right font-display font-bold tabular-nums">{s.quantity}</td>
                          <td className="px-5 py-2.5 text-right text-text-muted tabular-nums">{s.lowStockThreshold}</td>
                          <td className="px-5 py-2.5 text-center">
                            {isOut ? (
                              <span className="chip chip-danger text-[10px]">OUT</span>
                            ) : isLow ? (
                              <span className="chip chip-warn text-[10px]">LOW</span>
                            ) : (
                              <span className="chip chip-success text-[10px]">OK</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {stockLevels.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-8 text-text-muted">No ingredients in the system yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Waste */}
            <div className="bg-panel border border-border rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-danger" />
                  <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Waste</h3>
                </div>
                {waste.totalCost > 0 && (
                  <span className="chip chip-danger">Cost: {money(waste.totalCost)}</span>
                )}
              </div>
              {waste.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
                      <tr>
                        <th className="text-left px-5 py-2">Ingredient</th>
                        <th className="text-center px-5 py-2">Qty Wasted</th>
                        <th className="text-right px-5 py-2">Unit Cost</th>
                        <th className="text-right px-5 py-2">Waste Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {waste.items.map((w: any, i: number) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-5 py-2.5 font-semibold text-text-primary text-sm">{w.ingredientName}</td>
                          <td className="px-5 py-2.5 text-center tabular-nums">{w.totalWasted} {w.unit}</td>
                          <td className="px-5 py-2.5 text-right text-text-muted tabular-nums">{money(w.unitCost)}</td>
                          <td className="px-5 py-2.5 text-right font-display font-bold text-danger tabular-nums">{money(w.wasteCost)}</td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-border bg-panel-2">
                        <td colSpan={3} className="px-5 py-2.5 font-bold text-text-primary">Total Waste Cost</td>
                        <td className="px-5 py-2.5 text-right font-display font-bold text-danger tabular-nums">{money(waste.totalCost)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-text-muted text-sm">No waste recorded for this day</div>
              )}
            </div>

            {/* Print hint */}
            <div className="text-center text-xs text-text-muted py-4">
              <Printer className="w-4 h-4 inline mr-1.5" />
              Click "Download PDF" to open the print dialog — choose "Save as PDF" to download.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: string }) {
  const tints: Record<string, string> = {
    primary: 'text-primary bg-primary/10 border-primary/25',
    info: 'text-info bg-info/10 border-info/25',
    success: 'text-success bg-success/10 border-success/25',
    secondary: 'text-secondary bg-secondary/10 border-secondary/25',
  };
  return (
    <div className="bg-panel border border-border rounded-2xl p-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${tints[tint] || tints.primary} mb-3`}>
        {icon}
      </div>
      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="font-display text-2xl font-bold text-text-primary tabular-nums">{value}</p>
    </div>
  );
}

function formatDateDisplay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
