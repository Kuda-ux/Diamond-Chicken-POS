import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Save, Trash2, ChefHat, Search } from 'lucide-react';
import { recipesApi, ingredientsApi } from '../services/api';

interface Props {
  menuItemId: string;
  menuItemName: string;
  onClose: () => void;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

interface RecipeRow {
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantityPerUnit: number;
}

interface DraftRow {
  ingredientId: string;
  name: string;
  unit: string;
  qty: string;
}

export default function RecipeEditorModal({ menuItemId, menuItemName, onClose }: Props) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftRow[]>([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const { data: existing, isLoading } = useQuery({
    queryKey: ['recipe', menuItemId],
    queryFn: async () => (await recipesApi.get(menuItemId)).data.data as RecipeRow[],
  });

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => (await ingredientsApi.list()).data.data as Ingredient[],
  });

  useEffect(() => {
    if (existing) {
      setDraft(existing.map((r) => ({
        ingredientId: r.ingredientId,
        name: r.ingredientName,
        unit: r.unit,
        qty: String(r.quantityPerUnit),
      })));
    }
  }, [existing]);

  const used = new Set(draft.map((d) => d.ingredientId));
  const filtered = (ingredients || []).filter((i) =>
    !used.has(i.id) &&
    (search === '' || i.name.toLowerCase().includes(search.toLowerCase()))
  ).slice(0, 30);

  const save = useMutation({
    mutationFn: async () => {
      const cleaned = draft
        .map((d) => ({ ingredientId: d.ingredientId, quantityPerUnit: parseFloat(d.qty) }))
        .filter((d) => d.quantityPerUnit > 0);
      return recipesApi.set(menuItemId, cleaned);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recipe', menuItemId] });
      qc.invalidateQueries({ queryKey: ['recipes-overview'] });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.message || e.message || 'Failed to save'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-fade-in">
      <div className="w-full max-w-2xl bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">Recipe for {menuItemName}</h2>
              <p className="text-xs text-text-muted">Ingredients consumed per single unit sold</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {isLoading ? (
            <p className="text-center text-text-muted py-8">Loading recipe…</p>
          ) : (
            <>
              {/* Draft (recipe) rows */}
              <div className="space-y-2">
                {draft.length === 0 ? (
                  <p className="text-sm text-text-muted text-center py-4">No ingredients yet — search below to add</p>
                ) : (
                  draft.map((d) => (
                    <div key={d.ingredientId} className="bg-panel-2 border border-border rounded-xl p-3 grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-12 sm:col-span-6">
                        <p className="font-semibold text-sm">{d.name}</p>
                        <p className="text-[10px] text-text-muted uppercase">{d.unit} per piece sold</p>
                      </div>
                      <div className="col-span-10 sm:col-span-5">
                        <input
                          type="number" step="0.001" value={d.qty}
                          onChange={(e) => setDraft((p) => p.map((r) => r.ingredientId === d.ingredientId ? { ...r, qty: e.target.value } : r))}
                          className="input py-2"
                          placeholder={`Amount in ${d.unit}`}
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1 flex justify-end">
                        <button
                          onClick={() => setDraft((p) => p.filter((r) => r.ingredientId !== d.ingredientId))}
                          className="w-8 h-8 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted"
                        ><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add */}
              <div className="border-t border-border pt-4">
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Add ingredient</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-10" placeholder="Search ingredient..." />
                </div>
                {!ingredients || ingredients.length === 0 ? (
                  <p className="text-xs text-text-muted mt-2">No ingredients exist yet — add them in the <strong>Ingredients</strong> tab first.</p>
                ) : filtered.length > 0 && search ? (
                  <div className="mt-2 bg-panel-2 border border-border rounded-xl divide-y divide-border max-h-48 overflow-y-auto">
                    {filtered.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setDraft((p) => [...p, { ingredientId: m.id, name: m.name, unit: m.unit, qty: '' }]);
                          setSearch('');
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-panel flex items-center justify-between text-sm"
                      >
                        <span>{m.name}</span>
                        <span className="text-text-muted text-xs">{m.unit}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              {error && <p className="text-danger text-sm">{error}</p>}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary flex-[2]">
            <Save className="w-4 h-4" /> {save.isPending ? 'Saving…' : 'Save recipe'}
          </button>
        </div>
      </div>
    </div>
  );
}
