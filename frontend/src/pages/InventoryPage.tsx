import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Search, Plus, Save, X, Package, AlertTriangle, CheckCircle2,
  Boxes, Truck, History, Trash2, Calendar, Users, Beaker, ChefHat,
} from 'lucide-react';
import { inventoryApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import ReceiveStockModal from '../components/ReceiveStockModal';
import IngredientsTab from '../components/IngredientsTab';
import RecipesTab from '../components/RecipesTab';

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

interface ReceiptRow {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  receivedAt: string;
  supplier?: string;
  unitCost?: number;
  notes?: string;
  batchId?: string;
  receivedByName?: string;
}

type Tab = 'ingredients' | 'recipes' | 'stock' | 'receipts';

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('ingredients');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [editing, setEditing] = useState<InventoryRow | null>(null);
  const [addAmount, setAddAmount] = useState('');
  const [newThreshold, setNewThreshold] = useState('');
  const [receiveOpen, setReceiveOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

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
      <header className="sticky top-0 z-30 bg-panel/90 backdrop-blur-lg border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-panel-2 border border-border hover:bg-panel-2 flex items-center justify-center flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Boxes className="w-5 h-5 text-background" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-text-primary leading-none truncate">Inventory</h1>
              <p className="text-[10px] sm:text-xs text-text-muted mt-1">Manage stock + log weekly deliveries</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {isAdmin && (
              <Link to="/users" className="btn btn-ghost text-xs sm:text-sm">
                <Users className="w-4 h-4" /> <span className="hidden sm:inline">Users</span>
              </Link>
            )}
            <button onClick={() => setReceiveOpen(true)} className="btn btn-primary text-xs sm:text-sm">
              <Truck className="w-4 h-4" /> <span className="hidden sm:inline">Receive Stock</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <div className="flex gap-1 -mb-px overflow-x-auto">
            <TabBtn active={tab === 'ingredients'} onClick={() => setTab('ingredients')}><Beaker className="w-4 h-4" /> Ingredients</TabBtn>
            <TabBtn active={tab === 'recipes'} onClick={() => setTab('recipes')}><ChefHat className="w-4 h-4" /> Recipes</TabBtn>
            <TabBtn active={tab === 'stock'} onClick={() => setTab('stock')}><Package className="w-4 h-4" /> Menu Stock</TabBtn>
            <TabBtn active={tab === 'receipts'} onClick={() => setTab('receipts')}><History className="w-4 h-4" /> Deliveries</TabBtn>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-5">
        {tab === 'stock' && (
          <>
            {/* Search + summary cards */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search item or category..."
                className="input pl-11"
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-in">
              <SummaryCard label="Total items" value={summary.total} Icon={Package} tint="default" active={filter === 'all'} onClick={() => setFilter('all')} />
              <SummaryCard label="Well-stocked" value={summary.ok} Icon={CheckCircle2} tint="success" />
              <SummaryCard label="Low stock" value={summary.low} Icon={AlertTriangle} tint="secondary" active={filter === 'low'} onClick={() => setFilter('low')} />
              <SummaryCard label="Out of stock" value={summary.out} Icon={Package} tint="danger" active={filter === 'out'} onClick={() => setFilter('out')} />
            </div>

            <div className="bg-panel border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
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
                          <div className="w-14 h-14 rounded-full bg-panel-2 flex items-center justify-center text-text-muted mb-3 border border-border">
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
                          <tr key={row.id} className="border-t border-border hover:bg-panel-2 transition-colors">
                            <td className="px-5 py-4">
                              <p className="font-semibold text-text-primary">{row.name}</p>
                              <p className="text-xs text-text-muted md:hidden">{row.categoryName || '—'}</p>
                            </td>
                            <td className="px-5 py-4 text-text-secondary text-sm hidden md:table-cell">{row.categoryName || '—'}</td>
                            <td className="px-5 py-4 text-right text-text-secondary hidden sm:table-cell tabular-nums">${row.price.toFixed(2)}</td>
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-2 rounded-full bg-panel-2 overflow-hidden">
                                  <div className={`h-full rounded-full transition-all ${isOut ? 'bg-danger' : isLow ? 'bg-secondary' : 'bg-success'}`} style={{ width: `${pct}%` }} />
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
                                className="btn btn-ghost text-xs px-3 py-2"
                                style={{ borderColor: 'rgba(245,166,35,0.4)', color: '#F5A623' }}
                              >
                                <Plus className="w-3.5 h-3.5" /> Adjust
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

            <p className="text-xs text-text-muted text-center pt-2">
              💡 For weekly deliveries, use <button onClick={() => setReceiveOpen(true)} className="text-primary font-semibold underline-offset-4 hover:underline">Receive Stock</button> instead of Adjust — it logs an audit trail.
            </p>
          </>
        )}

        {tab === 'ingredients' && <IngredientsTab isAdmin={isAdmin} />}

        {tab === 'recipes' && <RecipesTab />}

        {tab === 'receipts' && <ReceiptsHistory isAdmin={isAdmin} />}
      </div>

      <ReceiveStockModal open={receiveOpen} onClose={() => setReceiveOpen(false)} onSaved={() => setTab('receipts')} />

      {/* Restock modal (manual adjust) */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-md bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-text-primary">Adjust Stock</h2>
                  <p className="text-xs text-text-muted">{editing.name}</p>
                </div>
              </div>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-panel-2 border border-border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Current</p>
                  <p className="text-text-secondary text-xs">Stock level</p>
                </div>
                <p className="font-display text-3xl font-bold text-primary tabular-nums">{editing.quantity}</p>
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
                    <button key={n} onClick={() => setAddAmount(String(n))} className="py-2 bg-panel-2 border border-border rounded-lg text-xs font-semibold text-text-secondary hover:text-text-primary">
                      +{n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Low-stock threshold</label>
                <input type="number" value={newThreshold} onChange={(e) => setNewThreshold(e.target.value)} placeholder="e.g. 10" className="input" />
              </div>
              <p className="text-[11px] text-text-muted">⚠️ This adjusts inventory directly without logging a receipt. For weekly deliveries, use <strong>Receive Stock</strong>.</p>
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

function ReceiptsHistory({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const { data: receipts, isLoading } = useQuery({
    queryKey: ['stock-receipts', from, to],
    queryFn: async () => (await inventoryApi.listReceipts({
      from: from || undefined,
      to: to || undefined,
    })).data.data as ReceiptRow[],
  });

  const remove = useMutation({
    mutationFn: (id: string) => inventoryApi.deleteReceipt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  // Group by batch / date
  const grouped = (receipts || []).reduce<Record<string, ReceiptRow[]>>((acc, r) => {
    const key = `${r.receivedAt}|${r.batchId || r.id}|${r.supplier || ''}`;
    (acc[key] ||= []).push(r);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-panel border border-border rounded-2xl p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">From</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input pl-10" />
          </div>
        </div>
        <div className="flex-1 min-w-[150px]">
          <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">To</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input pl-10" />
          </div>
        </div>
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); }} className="btn btn-ghost">
            <X className="w-4 h-4" /> Clear
          </button>
        )}
      </div>

      {/* Receipts list */}
      {isLoading ? (
        <div className="bg-panel border border-border rounded-2xl p-12 text-center text-text-muted">Loading receipts…</div>
      ) : groupKeys.length === 0 ? (
        <div className="bg-panel border border-border rounded-2xl p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-panel-2 flex items-center justify-center text-text-muted mb-3 mx-auto border border-border">
            <Truck className="w-6 h-6" />
          </div>
          <p className="font-display text-lg font-bold text-text-primary mb-1">No receipts logged</p>
          <p className="text-sm text-text-muted">Click <strong>Receive Stock</strong> when goods arrive to start the audit trail.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groupKeys.map((key) => {
            const rows = grouped[key];
            const date = rows[0].receivedAt;
            const supplier = rows[0].supplier;
            const totalUnits = rows.reduce((s, r) => s + r.quantity, 0);
            const totalCost = rows.reduce((s, r) => s + r.quantity * (r.unitCost || 0), 0);
            return (
              <div key={key} className="bg-panel border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-3 bg-panel-2 border-b border-border flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-display text-sm font-bold text-text-primary">
                        {new Date(date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-text-muted">
                        {supplier ? `Supplier: ${supplier}` : 'No supplier'}{rows[0].receivedByName ? ` • by ${rows[0].receivedByName}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-right">
                      <p className="text-[10px] text-text-muted uppercase tracking-wider">Units</p>
                      <p className="font-display font-bold text-primary tabular-nums">{totalUnits}</p>
                    </div>
                    {totalCost > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-text-muted uppercase tracking-wider">Cost</p>
                        <p className="font-display font-bold text-text-primary tabular-nums">${totalCost.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
                <ul className="divide-y divide-border">
                  {rows.map((r) => (
                    <li key={r.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-panel-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-text-primary truncate">{r.itemName}</p>
                        {r.notes && <p className="text-xs text-text-muted truncate">{r.notes}</p>}
                      </div>
                      <div className="flex items-center gap-4 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-text-muted">Quantity</p>
                          <p className="font-display font-bold text-text-primary tabular-nums">+{r.quantity}</p>
                        </div>
                        {r.unitCost && (
                          <div className="text-right hidden sm:block">
                            <p className="text-xs text-text-muted">Unit cost</p>
                            <p className="text-text-secondary tabular-nums">${r.unitCost.toFixed(2)}</p>
                          </div>
                        )}
                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (window.confirm(`Reverse this receipt? ${r.quantity} of ${r.itemName} will be deducted from current stock.`)) {
                                remove.mutate(r.id);
                              }
                            }}
                            disabled={remove.isPending}
                            className="w-8 h-8 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted"
                            title="Reverse this receipt (admin only)"
                          ><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${
        active ? 'text-primary border-primary' : 'text-text-secondary border-transparent hover:text-text-primary'
      }`}
    >{children}</button>
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
      className={`bg-panel border border-border rounded-2xl p-4 text-left transition-all ${active ? 'ring-2 ring-primary/50 amber-glow-soft' : ''} ${onClick ? 'hover-lift cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
          <p className="font-display text-2xl sm:text-3xl font-bold text-text-primary tabular-nums">{value}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg bg-panel-2 border flex items-center justify-center ${tints}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}
