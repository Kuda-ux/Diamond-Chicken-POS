import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShoppingCart, Plus, Minus, Trash2, LogOut } from 'lucide-react';
import { menuApi, categoriesApi } from '../services/api';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import PaymentModal from '../components/PaymentModal';

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { user, logout } = useAuthStore();
  const cart = useCartStore();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await categoriesApi.getAll();
      return res.data.data;
    },
  });

  const { data: menu } = useQuery({
    queryKey: ['menu'],
    queryFn: async () => {
      const res = await menuApi.getAll();
      return res.data.data;
    },
  });

  const filteredMenu = menu?.filter((item: any) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory && item.isAvailable;
  });

  const handleAddToCart = (item: any) => {
    cart.addItem({
      menuItemId: item.id,
      name: item.name,
      price: item.price,
    });
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <div className="h-14 bg-surface border-b border-border flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <span className="font-display text-xl font-bold text-primary">◆ Diamond Chicken</span>
          <span className="text-text-secondary">|</span>
          <span className="text-text-secondary">{user?.name}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-text-secondary text-sm">
            {new Date().toLocaleTimeString()}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass hover:bg-surface-2 text-text-secondary text-sm"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {toast && (
        <div className="fixed top-20 right-6 z-40 bg-success/20 border border-success text-success px-6 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={(orderNumber, change) => {
          setPaymentOpen(false);
          const msg = change && change > 0
            ? `Order ${orderNumber} sent • Change $${change.toFixed(2)}`
            : `Order ${orderNumber} sent to kitchen`;
          setToast(msg);
          setTimeout(() => setToast(null), 5000);
        }}
      />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu items..."
              className="w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-6 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-primary text-background'
                  : 'glass text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </button>
            {categories?.map((cat: any) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-6 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-background'
                    : 'glass text-text-secondary hover:text-primary'
                }`}
              >
                {cat.icon} {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-3 gap-4">
              {filteredMenu?.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => handleAddToCart(item)}
                  className="glass rounded-xl p-4 hover:bg-primary/10 transition-all active:scale-95 text-left"
                >
                  <div className="text-4xl mb-2">🍗</div>
                  <h3 className="font-display font-semibold text-text-primary mb-1">{item.name}</h3>
                  <p className="text-primary font-bold">${parseFloat(item.price).toFixed(2)}</p>
                  {item.stockQuantity !== undefined && (
                    <p className={`text-xs mt-2 ${item.stockQuantity > 10 ? 'text-success' : 'text-secondary'}`}>
                      Stock: {item.stockQuantity}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="w-96 bg-surface border-l border-border flex flex-col">
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" />
              Current Order
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {cart.items.length === 0 ? (
              <div className="text-center text-text-muted py-12">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items yet</p>
              </div>
            ) : (
              cart.items.map((item) => (
                <div key={item.menuItemId} className="glass rounded-lg p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-text-primary">{item.name}</p>
                    <p className="text-sm text-text-secondary">${parseFloat(item.price).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => cart.updateQuantity(item.menuItemId, item.quantity - 1)}
                      className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-danger/20 flex items-center justify-center"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-bold">{item.quantity}</span>
                    <button
                      onClick={() => cart.updateQuantity(item.menuItemId, item.quantity + 1)}
                      className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-primary/20 flex items-center justify-center"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => cart.removeItem(item.menuItemId)}
                      className="w-8 h-8 rounded-lg bg-surface-2 hover:bg-danger/20 flex items-center justify-center ml-2"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 border-t border-border space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal</span>
                <span>${cart.getSubtotal().toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Tax (15%)</span>
                <span>${cart.getTax().toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-display text-xl font-bold text-primary">
                <span>Total</span>
                <span>${cart.getTotal().toFixed(2)}</span>
              </div>
            </div>

            <button
              disabled={cart.items.length === 0}
              onClick={() => setPaymentOpen(true)}
              className="w-full py-4 bg-primary text-background font-display font-bold text-lg rounded-xl hover:bg-primary/90 transition-all amber-glow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Charge ${cart.getTotal().toFixed(2)} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
