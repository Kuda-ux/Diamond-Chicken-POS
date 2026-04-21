import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Search, Plus, Save, X } from 'lucide-react';
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
      inventoryApi.restock(vars.id, {
        quantity: vars.quantity,
        mode: 'add',
        lowStockThreshold: vars.threshold,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      setEditing(null);
      setAddAmount('');
      setNewThreshold('');
    },
  });

  const filtered = (items || []).filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    (r.categoryName || '').toLowerCase().includes(query.toLowerCase())
  );

  const summary = {
    total: items?.length || 0,
    low: items?.filter((i) => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length || 0,
    out: items?.filter((i) => i.quantity <= 0).length || 0,
  };

  const handleSave = () => {
    if (!editing) return;
    const qty = parseInt(addAmount);
    const thr = newThreshold ? parseInt(newThreshold) : undefined;
    if ((!qty || isNaN(qty)) && thr === undefined) return;
    restock.mutate({
      id: editing.menuItemId,
      quantity: isNaN(qty) ? 0 : qty,
      threshold: thr,
    });
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-xl glass hover:bg-surface-2 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-3xl font-bold text-gradient">Inventory</h1>
            <p className="text-text-secondary text-sm">
              {summary.total} items • <span className="text-secondary">{summary.low} low</span> •{' '}
              <span className="text-danger">{summary.out} out</span>
            </p>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search item or category..."
            className="pl-10 pr-4 py-2.5 w-80 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-2 text-text-secondary text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-3">Item</th>
              <th className="text-left px-5 py-3">Category</th>
              <th className="text-right px-5 py-3">Price</th>
              <th className="text-right px-5 py-3">Stock</th>
              <th className="text-right px-5 py-3">Threshold</th>
              <th className="text-center px-5 py-3">Status</th>
              <th className="text-right px-5 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted">Loading inventory…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-text-muted">No items match</td></tr>
            ) : (
              filtered.map((row) => {
                const isOut = row.quantity <= 0;
                const isLow = !isOut && row.quantity <= row.lowStockThreshold;
                return (
                  <tr key={row.id} className="border-t border-border hover:bg-surface-2/50">
                    <td className="px-5 py-3 font-semibold text-text-primary">{row.name}</td>
                    <td className="px-5 py-3 text-text-secondary text-sm">{row.categoryName || '—'}</td>
                    <td className="px-5 py-3 text-right text-text-secondary">${row.price.toFixed(2)}</td>
                    <td className={`px-5 py-3 text-right font-display font-bold text-lg ${
                      isOut ? 'text-danger' : isLow ? 'text-secondary' : 'text-success'
                    }`}>{row.quantity}</td>
                    <td className="px-5 py-3 text-right text-text-muted">{row.lowStockThreshold}</td>
                    <td className="px-5 py-3 text-center">
                      {isOut ? (
                        <span className="px-2 py-0.5 rounded-full bg-danger/20 border border-danger text-danger text-[10px] font-bold uppercase">Out</span>
                      ) : isLow ? (
                        <span className="px-2 py-0.5 rounded-full bg-secondary/20 border border-secondary text-secondary text-[10px] font-bold uppercase">Low</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-success/20 border border-success text-success text-[10px] font-bold uppercase">Ok</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => { setEditing(row); setAddAmount(''); setNewThreshold(String(row.lowStockThreshold)); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary/10 border border-primary/30 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 ml-auto"
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

      {/* Restock modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="font-display text-xl font-bold">Restock: {editing.name}</h2>
              <button onClick={() => setEditing(null)} className="w-9 h-9 rounded-lg hover:bg-surface-2 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="glass rounded-xl p-4 flex items-center justify-between">
                <span className="text-text-secondary text-sm">Current stock</span>
                <span className="font-display text-2xl font-bold text-primary">{editing.quantity}</span>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Add quantity</label>
                <input
                  type="number"
                  value={addAmount}
                  onChange={(e) => setAddAmount(e.target.value)}
                  placeholder="e.g. 50"
                  className="w-full px-4 py-3 bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-display text-xl"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Low-stock threshold</label>
                <input
                  type="number"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  placeholder="e.g. 10"
                  className="w-full px-4 py-3 bg-surface-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {restock.isError && <div className="text-danger text-sm">Failed to save — try again.</div>}
            </div>
            <div className="px-5 py-4 border-t border-border flex gap-3">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 py-3 glass rounded-lg font-semibold hover:bg-surface-2"
              >Cancel</button>
              <button
                onClick={handleSave}
                disabled={restock.isPending}
                className="flex-1 py-3 bg-primary text-background font-display font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" /> {restock.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
