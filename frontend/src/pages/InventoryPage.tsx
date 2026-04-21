import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, Plus, Save, X, Package, AlertTriangle, CheckCircle2, Boxes } from 'lucide-react';
import { inventoryApi } from '../services/api';

interface InventoryRow {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  categoryName?: string;
  quantity: number;
  lowStockThreshold: number;
  unit: string;
  lastUpdated: string;
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [newThreshold, setNewThreshold] = useState('');

  const { data: items, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => (await inventoryApi.list()).data.data as InventoryRow[],
    refetchInterval: 30000,
  });

  const restock = useMutation({
    mutationFn: async (vars: { id: string; quantity: number; threshold?: number }) =>
      inventoryApi.restock(vars.id, { quantity: vars.quantity, mode: 'add', lowStockThreshold: vars.threshold }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setEditing(null); setAddAmount(''); setNewThreshold('');
    },
  });

  const filtered = (items || []).filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(query.toLowerCase())
      || (r.categoryName || '').toLowerCase().includes(query.toLowerCase());
    const isOut = r.quantity <= 0;
    const isLow = !isOut && r.quantity <= r.lowStockThreshold;
    if (filter === 'low' && !isLow) return false;
    if (filter === 'out' && !isOut) return false;
    return matchSearch;
  });

  const summary = {
    total: items?.length || 0,
    low: items?.filter((i) => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length || 0,
    out: items?.filter((i) => i.quantity <= 0).length || 0,
    ok: items?.filter((i) => i.quantity > i.lowStockThreshold).length || 0,
  };

  const handleSave = () => {
    if (!editing) return;
    const qty = parseInt(addAmount);
    const thr = newThreshold ? parseInt(newThreshold) : undefined;
    if ((!qty || isNaN(qty)) && thr === undefined) return;
    restock.mutate({ id: editing.menuItemId, quantity: isNaN(qty) ? 0 : qty, threshold: thr });
  };

  return (
    <div className="min-h-screen">
      {/* Top bar */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="w-10 h-10 rounded-xl glass hover:bg-surface-2 flex items-center justify-center">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center amber-glow-soft">
              <Boxes className="w-5 h-5 text-background" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-text-primary leading-none">Inventory</h1>
              <p className="text-xs text-text-muted mt-1">Manage stock levels across the menu</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search item or category..."
              className="input pl-10 w-80 h-10"
            />
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-in">
          <SummaryCard label="Total items" value={summary.total} Icon={Package} tint="default" active={filter === 'all'} onClick={() => setFilter('all')} />
          <SummaryCard label="Well-stocked" value={summary.ok} Icon={CheckCircle2} tint="success" />
          <SummaryCard label="Low stock" value={summary.low} Icon={AlertTriangle} tint="secondary" active={filter === 'low'} onClick={() => setFilter('low')} />
          <SummaryCard label="Out of stock" value={summary.out} Icon={Package} tint="danger" active={filter === 'out'} onClick={() => setFilter('out')} />
        </div>

        {/* Table */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead className="bg-surface-2/60 text-text-muted text-[10px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="text-left px-5 py-3">Item</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Category</th>
                  <th className="text-right px-5 py-3 hidden sm:table-cell">Price</th>
                  <th className="text-left px-5 py-3 w-48">Stock level</th>
                  <th className="text-right px-5 py-3 hidden md:table-cell">Threshold</th>
                  <th className="text-right px-5 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-16 text-text-muted">Loading inventory…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center">
                      <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center text-text-muted mb-3">
                        <Search className="w-6 h-6" />
                      </div>
                      <p className="text-text-secondary font-semibold">No items match your filters</p>
                    </div>
                  </td></tr>
                ) : (
                  filtered.map((row) => {
                    const isOut = row.quantity <= 0;
                    const isLow = !isOut && row.quantity <= row.lowStockThreshold;
                    const pct = Math.min(100, Math.max(4, (row.quantity / Math.max(row.lowStockThreshold * 3, 1)) * 100));
                    return (
                      <tr key={row.id} className="border-t border-border hover:bg-surface-2/40 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-text-primary">{row.name}</p>
                          <p className="text-xs text-text-muted md:hidden">{row.categoryName || '—'}</p>
                        </td>
                        <td className="px-5 py-4 text-text-secondary text-sm hidden md:table-cell">{row.categoryName || '—'}</td>
                        <td className="px-5 py-4 text-right text-text-secondary hidden sm:table-cell tabular-nums">${row.price.toFixed(2)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isOut ? 'bg-danger' : isLow ? 'bg-secondary' : 'bg-success'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className={`font-display font-bold text-lg tabular-nums min-w-[3rem] text-right ${
                              isOut ? 'text-danger' : isLow ? 'text-secondary' : 'text-success'
                            }`}>{row.quantity}</span>
                          </div>
                          <div className="mt-1 flex items-center gap-2">
                            {isOut ? <span className="chip chip-danger">Out</span>
                              : isLow ? <span className="chip chip-warn">Low</span>
                              : <span className="chip chip-success">Ok</span>}
                            <span className="text-[10px] text-text-muted md:hidden">Threshold {row.lowStockThreshold}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right text-text-muted hidden md:table-cell tabular-nums">{row.lowStockThreshold}</td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => { setEditing(row); setAddAmount(''); setNewThreshold(String(row.lowStockThreshold)); }}
                            className="btn btn-ghost text-xs px-3 py-2 border-primary/30 text-primary hover:bg-primary-soft"
                            style={{ borderColor: 'rgba(245,166,35,0.3)' }}
                          >
                            <Plus className="w-3.5 h-3.5" /> Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Restock modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md glass-strong rounded-3xl shadow-2xl overflow-hidden border border-white/10 animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary/30 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-text-primary">Restock</h2>
                  <p className="text-xs text-text-muted">{editing.name}</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-lg hover:bg-surface-2 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Current</p>
                  <p className="text-text-secondary text-xs">Stock level</p>
                </div>
                <p className="font-display text-3xl font-bold text-gradient">{editing.quantity}</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Add quantity</label>
                <input
                  type="number" autoFocus value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="input py-4 font-display text-2xl"
                />
                <div className="mt-2 grid grid-cols-4 gap-2">
                  {[10, 25, 50, 100].map((n) => (
                    <button key={n} onClick={() => setAddAmount(String(n))} className="py-2 glass rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary">
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Low-stock threshold</label>
                <input type="number" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} placeholder="e.g. 10" className="input" />
              </div>
              {restock.isError && (
                <div className="text-danger text-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-danger" /> Failed to save — try again.
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button onClick={() => setEditing(null)} className="btn btn-ghost flex-1">Cancel</button>
              <button onClick={handleSave} disabled={restock.isPending} className="btn btn-primary flex-[2]">
                <Save className="w-4 h-4" /> {restock.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label, value, Icon, tint, active, onClick,
}: { label: string; value: number; Icon: any; tint: 'default' | 'success' | 'secondary' | 'danger'; active?: boolean; onClick?: () => void }) {
  const tints = {
    default: 'text-text-primary border-border',
    success: 'text-success border-success/30',
    secondary: 'text-secondary border-secondary/30',
    danger: 'text-danger border-danger/30',
  }[tint];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass rounded-2xl p-4 text-left transition-all ${active ? 'ring-2 ring-primary/50 amber-glow-soft' : ''} ${onClick ? 'hover-lift cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
          <p className="font-display text-3xl font-bold text-text-primary tabular-nums">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg glass flex items-center justify-center ${tints}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
