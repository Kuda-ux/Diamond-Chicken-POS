import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Search, Plus, Save, X, Pencil, Trash2,
  UtensilsCrossed, Eye, EyeOff, DollarSign, Tag,
} from 'lucide-react';
import { menuApi, categoriesApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  isAvailable: boolean;
  prepTimeMinutes?: number;
  sortOrder?: number;
  stockQuantity?: number;
  lowStockThreshold?: number;
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export default function MenuManagementPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const [query, setQuery] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [creating, setCreating] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'manager';
  const canManage = isAdmin || isManager;

  const { data: menuItems, isLoading } = useQuery({
    queryKey: ['menu'],
    queryFn: async () => (await menuApi.getAll()).data.data as MenuItem[],
    refetchInterval: 30000,
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.getAll()).data.data as Category[],
  });

  const toggleMut = useMutation({
    mutationFn: (id: string) => menuApi.toggle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => menuApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu'] });
    },
  });

  const catMap = (categories || []).reduce<Record<string, string>>((acc, c) => {
    acc[c.id] = c.name;
    return acc;
  }, {});

  const list = menuItems || [];
  const filtered = list.filter((item) => {
    const matchSearch =
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      (catMap[item.categoryId] || '').toLowerCase().includes(query.toLowerCase());
    const matchCat = catFilter === 'all' || item.categoryId === catFilter;
    return matchSearch && matchCat;
  });

  const availableCount = list.filter((i) => i.isAvailable).length;
  const unavailableCount = list.filter((i) => !i.isAvailable).length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-panel/90 backdrop-blur-lg border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-panel-2 border border-border hover:bg-panel-2 flex items-center justify-center flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <UtensilsCrossed className="w-5 h-5 text-background" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-text-primary leading-none truncate">Menu Management</h1>
              <p className="text-[10px] sm:text-xs text-text-muted mt-1">Add, edit prices, toggle availability</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {canManage && (
              <button onClick={() => setCreating(true)} className="btn btn-primary text-xs sm:text-sm">
                <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Item</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-panel border border-border rounded-2xl p-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total items</p>
            <p className="font-display text-2xl sm:text-3xl font-bold text-text-primary tabular-nums">{list.length}</p>
          </div>
          <div className="bg-panel border border-border rounded-2xl p-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Available</p>
            <p className="font-display text-2xl sm:text-3xl font-bold text-success tabular-nums">{availableCount}</p>
          </div>
          <div className="bg-panel border border-border rounded-2xl p-4">
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Unavailable</p>
            <p className="font-display text-2xl sm:text-3xl font-bold text-danger tabular-nums">{unavailableCount}</p>
          </div>
        </div>

        {/* Search + category filter */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search item name or category..."
              className="input pl-11"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="input w-auto min-w-[160px]"
          >
            <option value="all">All categories</option>
            {(categories || []).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Menu items table */}
        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="text-left px-5 py-3">Item</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Category</th>
                  <th className="text-right px-5 py-3">Price</th>
                  <th className="text-center px-5 py-3 hidden sm:table-cell">Prep time</th>
                  <th className="text-center px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-16 text-text-muted">Loading menu items…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16">
                    <div className="flex flex-col items-center">
                      <UtensilsCrossed className="w-10 h-10 text-text-muted mb-3" />
                      <p className="text-text-secondary font-semibold mb-1">No items found</p>
                      <p className="text-xs text-text-muted">Try adjusting your search or category filter</p>
                    </div>
                  </td></tr>
                ) : (
                  filtered.map((item) => (
                    <tr key={item.id} className="border-t border-border hover:bg-panel-2 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-text-primary">{item.name}</p>
                        {item.description && <p className="text-xs text-text-muted truncate max-w-[250px]">{item.description}</p>}
                        <p className="text-xs text-text-muted md:hidden">{catMap[item.categoryId] || '—'}</p>
                      </td>
                      <td className="px-5 py-4 text-text-secondary text-sm hidden md:table-cell">
                        <span className="inline-flex items-center gap-1.5">
                          <Tag className="w-3 h-3 text-text-muted" />
                          {catMap[item.categoryId] || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-display font-bold text-lg text-primary tabular-nums">
                          ${Number(item.price).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center text-text-secondary text-sm hidden sm:table-cell tabular-nums">
                        {item.prepTimeMinutes || 5} min
                      </td>
                      <td className="px-5 py-4 text-center">
                        {item.isAvailable ? (
                          <span className="chip chip-success"><Eye className="w-3 h-3" /> Active</span>
                        ) : (
                          <span className="chip chip-danger"><EyeOff className="w-3 h-3" /> Hidden</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {canManage && (
                            <>
                              <button
                                onClick={() => setEditing(item)}
                                className="w-8 h-8 rounded-lg hover:bg-primary/15 hover:text-primary flex items-center justify-center text-text-muted"
                                title="Edit item"
                              ><Pencil className="w-4 h-4" /></button>
                              <button
                                onClick={() => toggleMut.mutate(item.id)}
                                disabled={toggleMut.isPending}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center text-text-muted ${
                                  item.isAvailable ? 'hover:bg-secondary/15 hover:text-secondary' : 'hover:bg-success/15 hover:text-success'
                                }`}
                                title={item.isAvailable ? 'Hide from menu' : 'Show on menu'}
                              >
                                {item.isAvailable ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete "${item.name}"? This cannot be undone.`)) {
                                  removeMut.mutate(item.id);
                                }
                              }}
                              disabled={removeMut.isPending}
                              className="w-8 h-8 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted"
                              title="Delete (admin only)"
                            ><Trash2 className="w-4 h-4" /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Edit / Create modal */}
      {(editing || creating) && (
        <MenuItemEditor
          item={editing}
          categories={categories || []}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); qc.invalidateQueries({ queryKey: ['menu'] }); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor modal
// ---------------------------------------------------------------------------

function MenuItemEditor({
  item, categories, onClose, onSaved,
}: {
  item: MenuItem | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!item;
  const [name, setName] = useState(item?.name || '');
  const [categoryId, setCategoryId] = useState(item?.categoryId || (categories[0]?.id || ''));
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [description, setDescription] = useState(item?.description || '');
  const [prepTime, setPrepTime] = useState(String(item?.prepTimeMinutes || 5));
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Name is required');
      if (!price || isNaN(parseFloat(price)) || parseFloat(price) <= 0) throw new Error('Price must be a positive number');
      if (!categoryId) throw new Error('Category is required');

      const payload = {
        categoryId,
        name: name.trim(),
        price: parseFloat(price),
        description: description.trim() || undefined,
        prepTimeMinutes: parseInt(prepTime) || 5,
      };

      if (isEdit) {
        return menuApi.update(item!.id, payload);
      } else {
        return menuApi.create(payload);
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
              {isEdit ? <Pencil className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">
                {isEdit ? 'Edit Menu Item' : 'New Menu Item'}
              </h2>
              {isEdit && <p className="text-xs text-text-muted">Editing: {item!.name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <Field label="Name">
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. 2 Piece Chicken" autoFocus />
          </Field>

          <Field label="Category">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="input">
              {categories.length === 0 && <option value="">No categories</option>}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Price ($)">
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="input pl-10 font-display text-xl font-bold"
                placeholder="0.00"
              />
            </div>
          </Field>

          <Field label="Description (optional)">
            <input value={description} onChange={(e) => setDescription(e.target.value)} className="input" placeholder="Brief description" />
          </Field>

          <Field label="Prep time (minutes)">
            <input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} className="input" />
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
