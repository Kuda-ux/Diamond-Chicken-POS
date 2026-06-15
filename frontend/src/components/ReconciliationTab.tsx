import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Save, Calendar, ArrowDown, ArrowUp, Minus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { reconciliationApi, ingredientsApi } from '../services/api';

interface ReconciliationItem {
  ingredientId: string;
  name: string;
  unit: string;
  openingStock: number;
  purchases: number;
  sales: number;
  wastage: number;
  transfers: number;
  theoreticalClosing: number;
  actualClosing: number | null;
  variance: number | null;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

export default function ReconciliationTab() {
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [counting, setCounting] = useState(false);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [countNotes, setCountNotes] = useState('');

  const { data: report, isLoading } = useQuery({
    queryKey: ['reconciliation', date],
    queryFn: async () => {
      const res = await reconciliationApi.get(date);
      return res.data.data as { date: string; items: ReconciliationItem[] };
    },
  });

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => (await ingredientsApi.list()).data.data as Ingredient[],
  });

  const saveCounts = useMutation({
    mutationFn: async () => {
      const items = Object.entries(counts)
        .filter(([, v]) => v !== '' && !isNaN(parseFloat(v)))
        .map(([ingredientId, qty]) => ({ ingredientId, quantity: parseFloat(qty) }));
      if (items.length === 0) throw new Error('No counts entered');
      return reconciliationApi.recordCount({ date, items, notes: countNotes || undefined });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation'] });
      qc.invalidateQueries({ queryKey: ['ingredients'] });
      setCounting(false);
      setCounts({});
      setCountNotes('');
    },
  });

  const items = report?.items || [];
  const totalVariance = items.reduce((s, i) => s + (i.variance ?? 0), 0);
  const hasVariance = items.some((i) => i.variance !== null && Math.abs(i.variance) > 0.01);

  const startCounting = () => {
    setCounting(true);
    const initial: Record<string, string> = {};
    (ingredients || []).forEach((i) => { initial[i.id] = ''; });
    setCounts(initial);
  };

  const fmt = (v: number | null) => {
    if (v === null) return '—';
    return v % 1 === 0 ? v.toString() : v.toFixed(2);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-text-primary flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" /> Stock Reconciliation
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Opening + Purchases - Sales - Wastage = Theoretical Closing vs Actual Count
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input pl-10 text-sm w-44"
            />
          </div>
          {!counting && (
            <button onClick={startCounting} className="btn btn-primary text-xs sm:text-sm">
              <ClipboardCheck className="w-4 h-4" /> <span className="hidden sm:inline">Physical Count</span>
            </button>
          )}
        </div>
      </div>

      {/* Physical Count Form */}
      {counting && (
        <div className="card p-4 space-y-4 border-2 border-primary/30">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-semibold text-text-primary">Record Physical Count — {date}</h3>
            <button onClick={() => setCounting(false)} className="text-text-muted hover:text-danger text-sm">Cancel</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(ingredients || []).map((ing) => (
              <div key={ing.id} className="flex items-center gap-2">
                <label className="text-sm text-text-secondary flex-1 truncate">{ing.name} ({ing.unit})</label>
                <input
                  type="number"
                  step="any"
                  min="0"
                  placeholder={fmt(ing.quantity)}
                  value={counts[ing.id] || ''}
                  onChange={(e) => setCounts({ ...counts, [ing.id]: e.target.value })}
                  className="input text-sm w-24 text-right"
                />
              </div>
            ))}
          </div>
          <div>
            <input
              placeholder="Notes (optional)"
              value={countNotes}
              onChange={(e) => setCountNotes(e.target.value)}
              className="input text-sm"
            />
          </div>
          <button
            onClick={() => saveCounts.mutate()}
            disabled={saveCounts.isPending}
            className="btn btn-primary"
          >
            <Save className="w-4 h-4" /> {saveCounts.isPending ? 'Saving...' : 'Save Count'}
          </button>
          {saveCounts.isError && (
            <p className="text-xs text-danger">{(saveCounts.error as Error).message}</p>
          )}
        </div>
      )}

      {/* Summary chips */}
      {!isLoading && items.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="card px-4 py-2 flex items-center gap-2">
            <span className="text-xs text-text-muted">Items</span>
            <span className="font-display font-bold text-text-primary">{items.length}</span>
          </div>
          <div className={`card px-4 py-2 flex items-center gap-2 ${hasVariance ? 'border-secondary' : 'border-success'}`}>
            {hasVariance
              ? <AlertTriangle className="w-4 h-4 text-secondary" />
              : <CheckCircle2 className="w-4 h-4 text-success" />}
            <span className="text-xs text-text-muted">Total Variance</span>
            <span className={`font-display font-bold ${hasVariance ? 'text-secondary' : 'text-success'}`}>
              {fmt(Math.round(totalVariance * 100) / 100)}
            </span>
          </div>
        </div>
      )}

      {/* Reconciliation Table */}
      {isLoading ? (
        <div className="text-center py-12 text-text-muted">Loading reconciliation data...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-text-muted">No ingredients found. Add ingredients first.</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-panel-2 border-b border-border text-left">
                  <th className="px-4 py-3 font-semibold text-text-secondary">Ingredient</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary text-right">Opening</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary text-right">
                    <span className="flex items-center justify-end gap-1"><ArrowUp className="w-3 h-3 text-success" /> Purchases</span>
                  </th>
                  <th className="px-3 py-3 font-semibold text-text-secondary text-right">
                    <span className="flex items-center justify-end gap-1"><ArrowDown className="w-3 h-3 text-danger" /> Sales</span>
                  </th>
                  <th className="px-3 py-3 font-semibold text-text-secondary text-right">
                    <span className="flex items-center justify-end gap-1"><ArrowDown className="w-3 h-3 text-secondary" /> Waste</span>
                  </th>
                  <th className="px-3 py-3 font-semibold text-text-secondary text-right">Theo. Closing</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary text-right">Actual</th>
                  <th className="px-3 py-3 font-semibold text-text-secondary text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const v = item.variance;
                  const hasV = v !== null && Math.abs(v) > 0.01;
                  const isShortage = v !== null && v > 0.01;
                  const isSurplus = v !== null && v < -0.01;
                  return (
                    <tr key={item.ingredientId} className="border-b border-border/50 hover:bg-panel-2/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-text-primary">{item.name}</div>
                        <div className="text-[10px] text-text-muted">{item.unit}</div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{fmt(item.openingStock)}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-success font-medium">
                        {item.purchases > 0 ? `+${fmt(item.purchases)}` : fmt(item.purchases)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-danger font-medium">
                        {item.sales > 0 ? `-${fmt(item.sales)}` : fmt(item.sales)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-secondary font-medium">
                        {item.wastage > 0 ? `-${fmt(item.wastage)}` : fmt(item.wastage)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold text-text-primary">{fmt(item.theoreticalClosing)}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-bold text-text-primary">
                        {item.actualClosing !== null ? fmt(item.actualClosing) : <span className="text-text-muted italic">No count</span>}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {v === null ? (
                          <span className="text-text-muted">—</span>
                        ) : !hasV ? (
                          <span className="inline-flex items-center gap-1 text-success font-medium">
                            <Minus className="w-3 h-3" /> 0
                          </span>
                        ) : isShortage ? (
                          <span className="inline-flex items-center gap-1 text-danger font-bold">
                            <ArrowDown className="w-3 h-3" /> {fmt(Math.abs(v))}
                          </span>
                        ) : isSurplus ? (
                          <span className="inline-flex items-center gap-1 text-success font-bold">
                            <ArrowUp className="w-3 h-3" /> {fmt(Math.abs(v))}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="px-4 py-3 bg-panel-2/30 border-t border-border flex flex-wrap gap-4 text-[10px] text-text-muted">
            <span>Formula: <strong>Opening + Purchases - Sales - Wastage = Theoretical Closing</strong></span>
            <span className="text-danger">Shortage = Theoretical &gt; Actual</span>
            <span className="text-success">Surplus = Theoretical &lt; Actual</span>
          </div>
        </div>
      )}
    </div>
  );
}
