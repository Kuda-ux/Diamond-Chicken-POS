import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ChefHat, Pencil, Package } from 'lucide-react';
import { recipesApi } from '../services/api';
import RecipeEditorModal from './RecipeEditorModal';

interface RecipeOverview {
  menuItemId: string;
  name: string;
  price: number;
  categoryName?: string;
  ingredientCount: number;
}

export default function RecipesTab() {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<RecipeOverview | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['recipes-overview'],
    queryFn: async () => (await recipesApi.listOverview()).data.data as RecipeOverview[],
  });

  const list = data || [];
  const filtered = list.filter((r) =>
    r.name.toLowerCase().includes(query.toLowerCase()) ||
    (r.categoryName || '').toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search menu item..."
          className="input pl-11"
        />
      </div>

      <div className="bg-panel border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px]">
            <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
              <tr>
                <th className="text-left px-5 py-3">Menu item</th>
                <th className="text-left px-5 py-3 hidden md:table-cell">Category</th>
                <th className="text-right px-5 py-3 hidden sm:table-cell">Price</th>
                <th className="text-center px-5 py-3">Recipe</th>
                <th className="text-right px-5 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={5} className="text-center py-16 text-text-muted">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-16 text-text-muted">No menu items match</td></tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.menuItemId} className="border-t border-border hover:bg-panel-2 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-text-primary">{row.name}</p>
                      <p className="text-xs text-text-muted md:hidden">{row.categoryName || '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-text-secondary text-sm hidden md:table-cell">{row.categoryName || '—'}</td>
                    <td className="px-5 py-4 text-right text-text-secondary tabular-nums hidden sm:table-cell">${row.price.toFixed(2)}</td>
                    <td className="px-5 py-4 text-center">
                      {row.ingredientCount > 0 ? (
                        <span className="chip chip-success">
                          <Package className="w-3 h-3" /> {row.ingredientCount} ingredient{row.ingredientCount === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="chip">No recipe</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={() => setEditing(row)}
                        className="btn btn-ghost text-xs px-3 py-2"
                        style={{ borderColor: 'rgba(245,166,35,0.4)', color: '#F5A623' }}
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit recipe
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-panel-2 border border-border rounded-2xl p-4 flex items-start gap-3">
        <ChefHat className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
        <div className="text-xs text-text-secondary">
          <p className="mb-1"><strong className="text-text-primary">How recipes work:</strong></p>
          <p>Add a recipe to a menu item by listing the ingredients it consumes per single unit sold.</p>
          <p>When a customer orders, the system deducts each ingredient by <code className="text-primary">quantity × order qty</code>. Items without a recipe still use the legacy per-item stock.</p>
        </div>
      </div>

      {editing && (
        <RecipeEditorModal
          menuItemId={editing.menuItemId}
          menuItemName={editing.name}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
