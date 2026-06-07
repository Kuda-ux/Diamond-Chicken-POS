import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Save, X, AlertTriangle, CheckCircle2, Package, Search, Trash2, Pencil, Truck,
} from 'lucide-react';
import { ingredientsApi } from '../services/api';
import ReceiveIngredientsModal from './ReceiveIngredientsModal';

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  lowStockThreshold: number;
  unitCost?: number;
  notes?: string;
}

export default function IngredientsTab({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [creating, setCreating] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const { data: ingredients, isLoading } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => (await ingredientsApi.list()).data.data as Ingredient[],
    refetchInterval: 30000,
  });

  const list = ingredients || [];
  const filtered = list.filter((r) => {
    const matches = r.name.toLowerCase().includes(query.toLowerCase());
    const isOut = r.quantity <= 0;
    const isLow = !isOut && r.quantity <= r.lowStockThreshold;
    if (filter === 'low' && !isLow) return false;
    if (filter === 'out' && !isOut) return false;
    return matches;
  });

  const summary = {
    total: list.length,
    low: list.filter((i) => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length,
    out: list.filter((i) => i.quantity <= 0).length,
    ok: list.filter((i) => i.quantity > i.lowStockThreshold).length,
  };

  const remove = useMutation({
    mutationFn: (id: string) => ingredientsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ingredients'] }),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ingredient..."
            className="input pl-11"
          />
        </div>
        <button onClick={() => setReceiveOpen(true)} className="btn btn-ghost">
          <Truck className="w-4 h-4" /> Receive
        </button>
        <button onClick={() => setCreating(true)} className="btn btn-primary">
          <Plus className="w-4 h-4" /> New ingredient
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total" value={summary.total} Icon={Package} tint="default" active={filter === 'all'} onClick={() => setFilter('all')} />
        <SummaryCard label="OK" value={summary.ok} Icon={CheckCircle2} tint="success" />
        <SummaryCard label="Low" value={summary.low} Icon={AlertTriangle} tint="secondary" active={filter === 'low'} onClick={() => setFilter('low')} />
        <SummaryCard label="Out" value={summary.out} Icon={Package} tint="danger" active={filter === 'out'} onClick={() => setFilter('out')} />
      </div>

      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
              <tr>
                <th className="text-left px-5 py-3">Ingredient</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Unit</th>
                <th className="text-left px-5 py-3 w-48">Stock</th>
                <th className="text-right px-5 py-3 hidden md:table-cell">Threshold</th>
                <th className="text-right px-5 py-3 hidden md:table-cell">Cost</th>
                <th className="text-right px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-16 text-text-muted">Loading ingredients…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center">
                    <Package className="w-10 h-10 text-text-muted mb-3" />
                    <p className="text-text-secondary font-semibold mb-1">No ingredients yet</p>
                    <p className="text-xs text-text-muted">Click <strong>New ingredient</strong> to add chicken pieces, oil, salt, boxes etc.</p>
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
                        {row.notes && <p className="text-xs text-text-muted truncate max-w-[200px]">{row.notes}</p>}
                      </td>
                      <td className="px-5 py-4 text-text-secondary text-sm hidden sm:table-cell">{row.unit}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 h-2 rounded-full bg-panel-2 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${isOut ? 'bg-danger' : isLow ? 'bg-secondary' : 'bg-success'}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={`font-display font-bold text-lg tabular-nums min-w-[3rem] text-right ${
                            isOut ? 'text-danger' : isLow ? 'text-secondary' : 'text-success'
                          }`}>{row.quantity}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-right text-text-muted hidden md:table-cell tabular-nums">{row.lowStockThreshold}</td>
                      <td className="px-5 py-4 text-right text-text-muted hidden md:table-cell tabular-nums">
                        {row.unitCost ? `$${row.unitCost.toFixed(2)}` : '—'}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => setEditing(row)}
                            className="w-8 h-8 rounded-lg hover:bg-primary/15 hover:text-primary flex items-center justify-center text-text-muted"
                            title="Edit / adjust"
                          ><Pencil className="w-4 h-4" /></button>
                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete "${row.name}"? This cannot be undone if it isn't used in any recipe.`)) {
                                  remove.mutate(row.id);
                                }
                              }}
                              disabled={remove.isPending}
                              className="w-8 h-8 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted"
                              title="Delete (admin only)"
                            ><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(editing || creating) && (
        <IngredientEditor
          ingredient={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); qc.invalidateQueries({ queryKey: ['ingredients'] }); }}
        />
      )}

      <ReceiveIngredientsModal open={receiveOpen} onClose={() => setReceiveOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor modal (create + adjust)
// ---------------------------------------------------------------------------

function IngredientEditor({
  ingredient, onClose, onSaved,
}: {
  ingredient: Ingredient | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!ingredient;
  const [name, setName] = useState(ingredient?.name || '');
  const [unit, setUnit] = useState(ingredient?.unit || 'pcs');
  const [threshold, setThreshold] = useState(String(ingredient?.lowStockThreshold ?? 10));
  const [unitCost, setUnitCost] = useState(ingredient?.unitCost ? String(ingredient.unitCost) : '');
  const [addQty, setAddQty] = useState('');
  const [notes, setNotes] = useState(ingredient?.notes || '');
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Name is required');
      if (isEdit) {
        await ingredientsApi.update(ingredient!.id, {
          name: name.trim(),
          unit,
          lowStockThreshold: parseFloat(threshold) || 0,
          unitCost: unitCost ? parseFloat(unitCost) : undefined,
          notes: notes || undefined,
        });
        const addNum = parseFloat(addQty);
        if (!isNaN(addNum) && addNum !== 0) {
          await ingredientsApi.restock(ingredient!.id, { quantity: addNum, mode: 'add' });
        }
      } else {
        await ingredientsApi.create({
          name: name.trim(),
          unit,
          quantity: parseFloat(addQty) || 0,
          lowStockThreshold: parseFloat(threshold) || 0,
          unitCost: unitCost ? parseFloat(unitCost) : undefined,
          notes: notes || undefined,
        });
      }
    },
    onSuccess: onSaved,
    onError: (e: any) => setError(e.response?.data?.message || e.message || 'Failed to save'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">
                {isEdit ? 'Edit Ingredient' : 'New Ingredient'}
              </h2>
              {isEdit && <p className="text-xs text-text-muted">Current stock: {ingredient!.quantity} {ingredient!.unit}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Chicken pieces, Cooking oil, Takeaway box" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Unit">
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className="input">
                <option value="pcs">pcs (pieces)</option>
                <option value="each">each</option>
                <option value="g">g (grams)</option>
                <option value="kg">kg (kilograms)</option>
                <option value="ml">ml (millilitres)</option>
                <option value="L">L (litres)</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
              </select>
            </Field>
            <Field label="Low-stock threshold">
              <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="input" />
            </Field>
          </div>

          <Field label={isEdit ? 'Add to stock (use negative to subtract)' : 'Initial quantity'}>
            <input type="number" value={addQty} onChange={(e) => setAddQty(e.target.value)} className="input" placeholder="e.g. 100" />
          </Field>

          <Field label="Unit cost (optional)">
            <input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="input" placeholder="$ per unit" />
          </Field>

          <Field label="Notes (optional)">
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="e.g. Supplier: Irvines" />
          </Field>

          {error && <p className="text-danger text-sm">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary flex-[2]">
            <Save className="w-4 h-4" /> {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function SummaryCard({
  label, value, Icon, tint, active, onClick,
}: {
  label: string; value: number; Icon: any;
  tint: 'default' | 'success' | 'danger' | 'secondary';
  active?: boolean; onClick?: () => void;
}) {
  const tintCls = tint === 'success' ? 'text-success'
    : tint === 'danger' ? 'text-danger'
    : tint === 'secondary' ? 'text-secondary' : 'text-primary';
  return (
    <button
      onClick={onClick}
      className={`bg-panel border rounded-2xl p-4 text-left transition-all ${
        active ? 'border-primary shadow-lg' : 'border-border hover:border-border-strong'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted">{label}</p>
        <Icon className={`w-4 h-4 ${tintCls}`} />
      </div>
      <p className={`font-display text-3xl font-bold tabular-nums ${tintCls}`}>{value}</p>
    </button>
  );
}
