import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Truck, Save, Search, Calendar } from 'lucide-react';
import { ingredientsApi } from '../services/api';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DraftItem {
  ingredientId: string;
  name: string;
  unit: string;
  quantity: string;
  unitCost: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
}

export default function ReceiveIngredientsModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const [receivedAt, setReceivedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => (await ingredientsApi.list()).data.data as Ingredient[],
    enabled: open,
  });

  const filtered = useMemo(() => {
    if (!ingredients) return [];
    const used = new Set(items.map((i) => i.ingredientId));
    const q = search.toLowerCase();
    return ingredients
      .filter((m) => !used.has(m.id) && (q === '' || m.name.toLowerCase().includes(q)))
      .slice(0, 30);
  }, [ingredients, items, search]);

  const totalCost = items.reduce(
    (s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitCost) || 0),
    0
  );

  const create = useMutation({
    mutationFn: async () => {
      const cleaned = items
        .map((it) => ({
          ingredientId: it.ingredientId,
          quantity: parseFloat(it.quantity) || 0,
          unitCost: it.unitCost ? parseFloat(it.unitCost) : undefined,
        }))
        .filter((it) => it.quantity > 0);
      if (cleaned.length === 0) throw new Error('Add at least one ingredient with a quantity');
      return ingredientsApi.createReceipts({
        receivedAt,
        supplier: supplier || undefined,
        notes: notes || undefined,
        items: cleaned,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ingredients'] });
      qc.invalidateQueries({ queryKey: ['ingredient-receipts'] });
      handleClose();
    },
    onError: (e: any) => setError(e.response?.data?.message || e.message || 'Failed to save'),
  });

  if (!open) return null;

  const addItem = (m: Ingredient) => {
    setItems((prev) => [...prev, { ingredientId: m.id, name: m.name, unit: m.unit, quantity: '', unitCost: '' }]);
    setSearch('');
  };
  const updateItem = (id: string, key: 'quantity' | 'unitCost', value: string) => {
    setItems((prev) => prev.map((it) => (it.ingredientId === id ? { ...it, [key]: value } : it)));
  };
  const removeItem = (id: string) => setItems((prev) => prev.filter((it) => it.ingredientId !== id));

  const handleClose = () => {
    setItems([]); setSupplier(''); setNotes(''); setSearch(''); setError('');
    setReceivedAt(new Date().toISOString().slice(0, 10));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Truck className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">Receive Ingredients</h2>
              <p className="text-xs text-text-muted">Quantities are added to current ingredient stock</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Date received</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
                <input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} className="input pl-10" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Supplier (optional)</label>
              <input value={supplier} onChange={(e) => setSupplier(e.target.value)} className="input" placeholder="e.g. Irvines" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Notes (optional)</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Invoice #, etc." />
          </div>

          {/* Search to add */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Add ingredient</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search to add..." />
            </div>
            {search && filtered.length > 0 && (
              <div className="mt-2 bg-panel-2 border border-border rounded-xl divide-y divide-border max-h-48 overflow-y-auto">
                {filtered.map((m) => (
                  <button key={m.id} onClick={() => addItem(m)} className="w-full text-left px-3 py-2 hover:bg-panel flex items-center justify-between text-sm">
                    <span>{m.name}</span>
                    <span className="text-text-muted text-xs">{m.unit}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Draft items */}
          {items.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Items ({items.length})</p>
              {items.map((it) => (
                <div key={it.ingredientId} className="bg-panel-2 border border-border rounded-xl p-3 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 sm:col-span-5">
                    <p className="font-semibold text-sm">{it.name}</p>
                    <p className="text-[10px] text-text-muted uppercase">{it.unit}</p>
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <input type="number" value={it.quantity} onChange={(e) => updateItem(it.ingredientId, 'quantity', e.target.value)} placeholder="Qty" className="input py-2" />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <input type="number" step="0.01" value={it.unitCost} onChange={(e) => updateItem(it.ingredientId, 'unitCost', e.target.value)} placeholder="$/unit" className="input py-2" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeItem(it.ingredientId)} className="w-8 h-8 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-sm">
            {totalCost > 0 && (
              <span className="text-text-muted">Total: <span className="text-text-primary font-bold tabular-nums">${totalCost.toFixed(2)}</span></span>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={handleClose} className="btn btn-ghost">Cancel</button>
            <button onClick={() => create.mutate()} disabled={create.isPending || items.length === 0} className="btn btn-primary">
              <Save className="w-4 h-4" /> {create.isPending ? 'Saving…' : 'Save delivery'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
