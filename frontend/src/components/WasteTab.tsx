import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Plus, X, Save, Search, AlertTriangle } from 'lucide-react';
import { wasteApi, ingredientsApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

interface WasteRecord {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: string;
  quantity: number;
  reason?: string;
  recordedAt: string;
  recordedByName?: string;
  createdAt: string;
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  quantity: number;
}

export default function WasteTab() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [showForm, setShowForm] = useState(false);
  const [query, setQuery] = useState('');

  const { data: wasteRecords, isLoading } = useQuery({
    queryKey: ['waste'],
    queryFn: async () => (await wasteApi.list({ limit: 200 })).data.data as WasteRecord[],
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => wasteApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waste'] });
      qc.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });

  const records = wasteRecords || [];
  const filtered = records.filter((r) =>
    r.ingredientName.toLowerCase().includes(query.toLowerCase()) ||
    (r.reason || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search waste records..."
            className="input pl-11"
          />
        </div>
        <button onClick={() => setShowForm(true)} className="btn btn-primary text-xs sm:text-sm">
          <Plus className="w-4 h-4" /> Record Waste
        </button>
      </div>

      {/* Waste list */}
      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
              <tr>
                <th className="text-left px-5 py-3">Ingredient</th>
                <th className="text-right px-5 py-3">Qty wasted</th>
                <th className="text-left px-5 py-3">Reason</th>
                <th className="text-left px-5 py-3 hidden sm:table-cell">Date</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Recorded by</th>
                {isAdmin && <th className="text-right px-5 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-16 text-text-muted">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center">
                    <AlertTriangle className="w-10 h-10 text-text-muted mb-3" />
                    <p className="text-text-secondary font-semibold mb-1">No waste records</p>
                    <p className="text-xs text-text-muted">Use "Record Waste" to log wasted ingredients</p>
                  </div>
                </td></tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-panel-2 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-text-primary">{r.ingredientName}</p>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-display font-bold text-danger tabular-nums">{r.quantity}</span>
                      <span className="text-text-muted text-xs ml-1">{r.unit}</span>
                    </td>
                    <td className="px-5 py-3 text-text-secondary text-sm max-w-[200px] truncate">{r.reason || '—'}</td>
                    <td className="px-5 py-3 text-text-secondary text-sm hidden sm:table-cell tabular-nums">{r.recordedAt}</td>
                    <td className="px-5 py-3 text-text-secondary text-sm hidden md:table-cell">{r.recordedByName || '—'}</td>
                    {isAdmin && (
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => {
                            if (window.confirm('Reverse this waste record? Stock will be restored.')) {
                              deleteMut.mutate(r.id);
                            }
                          }}
                          disabled={deleteMut.isPending}
                          className="w-8 h-8 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted"
                          title="Reverse (admin)"
                        ><Trash2 className="w-4 h-4" /></button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <RecordWasteModal
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            qc.invalidateQueries({ queryKey: ['waste'] });
            qc.invalidateQueries({ queryKey: ['ingredients'] });
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Record Waste Modal
// ---------------------------------------------------------------------------

function RecordWasteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [ingredientId, setIngredientId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const { data: ingredients } = useQuery({
    queryKey: ['ingredients'],
    queryFn: async () => (await ingredientsApi.list()).data.data as Ingredient[],
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!ingredientId) throw new Error('Select an ingredient');
      if (!quantity || parseFloat(quantity) <= 0) throw new Error('Quantity must be positive');
      return wasteApi.record({
        ingredientId,
        quantity: parseFloat(quantity),
        reason: reason.trim() || undefined,
      });
    },
    onSuccess: onSaved,
    onError: (e: any) => setError(e.response?.data?.message || e.message),
  });

  const selected = (ingredients || []).find((i) => i.id === ingredientId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-md bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-danger/15 border border-danger/30 flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-danger" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">Record Waste</h2>
              <p className="text-xs text-text-muted">Log wasted/expired ingredients</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Ingredient</label>
            <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className="input">
              <option value="">Select ingredient...</option>
              {(ingredients || []).map((i) => (
                <option key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit} in stock)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
              Quantity wasted{selected ? ` (${selected.unit})` : ''}
            </label>
            <input
              type="number"
              step="0.01"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input font-display text-xl font-bold"
              placeholder="0"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Reason (optional)</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input"
              placeholder="e.g. Expired, burnt, dropped"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3">
          <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
          <button onClick={() => save.mutate()} disabled={save.isPending} className="btn btn-primary flex-[2]">
            <Save className="w-4 h-4" /> {save.isPending ? 'Saving…' : 'Record Waste'}
          </button>
        </div>
      </div>
    </div>
  );
}
