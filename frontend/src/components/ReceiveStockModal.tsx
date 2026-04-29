import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Truck, Save, Search, Calendar, Package } from 'lucide-react';
import { inventoryApi, menuApi } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

interface DraftItem {
  menuItemId: string;
  name: string;
  quantity: string;
  unitCost: string;
}

export default function ReceiveStockModal({ open, onClose, onSaved }: Props) {
  const queryClient = useQueryClient();
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const { data: menu } = useQuery({
    queryKey: ['menu'],
    queryFn: async () => (await menuApi.getAll()).data.data,
    enabled: open,
  });

  const filteredMenu = useMemo(() => {
    if (!menu) return [];
    const inDraft = new Set(items.map((i) => i.menuItemId));
    const q = search.toLowerCase();
    return menu
      .filter((m: any) => !inDraft.has(m.id) && (q === '' || m.name.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [menu, items, search]);

  const totalUnits = items.reduce((s, it) => s + (parseInt(it.quantity) || 0), 0);
  const totalCost = items.reduce((s, it) => s + (parseInt(it.quantity) || 0) * (parseFloat(it.unitCost) || 0), 0);

  const create = useMutation({
    mutationFn: async () => {
      const cleaned = items
        .map((it) => ({
          menuItemId: it.menuItemId,
          quantity: parseInt(it.quantity) || 0,
          unitCost: it.unitCost ? parseFloat(it.unitCost) : undefined,
        }))
        .filter((it) => it.quantity > 0);
      if (cleaned.length === 0) throw new Error('Add at least one item with a quantity');
      return inventoryApi.createReceipts({
        receivedAt,
        supplier: supplier || undefined,
        notes: notes || undefined,
        items: cleaned,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['stock-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] });
      handleClose();
      onSaved?.();
    },
    onError: (e: any) => {
      setError(e.response?.data?.message || e.message || 'Failed to save');
    },
  });

  if (!open) return null;

  const addItem = (m: any) => {
    setItems((prev) => [...prev, { menuItemId: m.id, name: m.name, quantity: '', unitCost: '' }]);
    setSearch('');
  };
  const updateItem = (id: string, key: 'quantity' | 'unitCost', value: string) => {
    setItems((prev) => prev.map((it) => (it.menuItemId === id ? { ...it, [key]: value } : it)));
  };
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.menuItemId !== id));

  const handleClose = () => {
    setItems([]); setSupplier(''); setNotes(''); setSearch(''); setError('');
    setReceivedAt(new Date().toISOString().slice(0, 10));
    onClose();
  };

  const handleSubmit = () => {
    setError('');
    create.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">Receive Stock</h2>
              <p className="text-xs text-text-muted">Log a delivery — quantities are added to current inventory</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Batch metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Received on" icon={<Calendar className="w-4 h-4" />}>
              <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="input pl-11" />
            </Field>
            <Field label="Supplier (optional)" icon={<Truck className="w-4 h-4" />}>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Irvine's Chicken" className="input pl-11" />
            </Field>
          </div>

          {/* Item search */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Add items</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search menu items to add..."
                className="input pl-11"
              />
            </div>
            {search && (
              <div className="mt-2 max-h-48 overflow-y-auto bg-panel-2 border border-border rounded-xl divide-y divide-border">
                {filteredMenu.length === 0 ? (
                  <p className="p-3 text-sm text-text-muted text-center">No matches</p>
                ) : (
                  filteredMenu.map((m: any) => (
                    <button
                      key={m.id}
                      onClick={() => addItem(m)}
                      className="w-full px-3 py-2.5 hover:bg-panel flex items-center justify-between text-left"
                    >
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{m.name}</p>
                        <p className="text-xs text-text-muted">${parseFloat(m.price).toFixed(2)}</p>
                      </div>
                      <Plus className="w-4 h-4 text-primary" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Draft items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Receipt lines</label>
              <span className="text-xs text-text-muted">{items.length} item{items.length !== 1 ? 's' : ''}</span>
            </div>
            {items.length === 0 ? (
              <div className="bg-panel-2 border border-dashed border-border rounded-xl p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-panel flex items-center justify-center mx-auto mb-3 border border-border">
                  <Package className="w-5 h-5 text-text-muted" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">No items yet</p>
                <p className="text-xs text-text-muted mt-1">Search above to add items received this week.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((it) => (
                  <div key={it.menuItemId} className="bg-panel-2 border border-border rounded-xl p-3 flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[150px]">
                      <p className="text-sm font-semibold text-text-primary">{it.name}</p>
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Qty received</label>
                      <input
                        type="number" min="1" inputMode="numeric"
                        value={it.quantity}
                        onChange={(e) => updateItem(it.menuItemId, 'quantity', e.target.value)}
                        placeholder="0"
                        className="input w-24 py-1.5 text-center font-mono"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Unit cost (opt.)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted z-10">$</span>
                        <input
                          type="number" step="0.01" min="0"
                          value={it.unitCost}
                          onChange={(e) => updateItem(it.menuItemId, 'unitCost', e.target.value)}
                          placeholder="0.00"
                          className="input w-24 pl-6 py-1.5 font-mono"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(it.menuItemId)}
                      className="w-8 h-8 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted ml-auto"
                    ><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Invoice number, condition of goods, etc."
              className="input resize-none"
            />
          </div>

          {/* Totals */}
          {items.length > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Total units</p>
                <p className="font-display text-2xl font-bold text-primary tabular-nums">{totalUnits}</p>
              </div>
              {totalCost > 0 && (
                <div className="text-right">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">Estimated cost</p>
                  <p className="font-display text-2xl font-bold text-text-primary tabular-nums">${totalCost.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-danger" /> {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button onClick={handleClose} disabled={create.isPending} className="btn btn-ghost flex-1">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={create.isPending || items.length === 0}
            className="btn btn-primary flex-[2]"
          >
            <Save className="w-4 h-4" /> {create.isPending ? 'Saving…' : `Save Receipt${items.length > 0 ? ` (${items.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10">{icon}</span>
        {children}
      </div>
    </label>
  );
}
