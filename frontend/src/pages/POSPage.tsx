import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShoppingCart, Plus, Minus, Trash2, LogOut, Bell } from 'lucide-react';
import { menuApi, categoriesApi } from '../services/api';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import PaymentModal from '../components/PaymentModal';
import { getSocket, joinRoom } from '../services/socket';

const LOW_STOCK_THRESHOLD = 10;

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [readyAlerts, setReadyAlerts] = useState<string[]>([]);
  const { user, logout } = useAuthStore();
  const cart = useCartStore();
  const queryClient = useQueryClient();

  // Socket.IO: listen for order:ready
  useEffect(() => {
    const socket = getSocket();
    joinRoom('cashiers');

    const onReady = (order: any) => {
      const msg = `🔔 Order ${order.orderNumber} is READY for pickup`;
      setReadyAlerts((prev) => [msg, ...prev].slice(0, 5));
      // Beep using WebAudio
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.value = 0.1;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
      } catch { /* noop */ }
    };

    socket.on('order:ready', onReady);
    // Refresh menu stock when orders happen
    const refreshMenu = () => queryClient.invalidateQueries({ queryKey: ['menu'] });
    socket.on('order:new', refreshMenu);

    return () => {
      socket.off('order:ready', onReady);
      socket.off('order:new', refreshMenu);
    };
  }, [queryClient]);

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

  const getStock = (item: any): number | null => {
    const v = item.stockQuantity ?? item.stock_quantity;
    return v === undefined || v === null ? null : Number(v);
  };

  const handleAddToCart = (item: any) => {
    const stock = getStock(item);
    if (stock !== null && stock <= 0) {
      setToast(`${item.name} is out of stock`);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    // Check already-in-cart count vs stock
    const existing = cart.items.find((i) => i.menuItemId === item.id);
    const nextQty = (existing?.quantity || 0) + 1;
    if (stock !== null && nextQty > stock) {
      setToast(`Only ${stock} of ${item.name} left`);
      setTimeout(() => setToast(null), 3000);
      return;
    }
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

      {readyAlerts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-40 space-y-2 max-w-sm">
          {readyAlerts.map((alert, i) => (
            <div
              key={`${alert}-${i}`}
              className="flex items-start gap-3 bg-primary/20 border border-primary text-text-primary px-4 py-3 rounded-xl shadow-xl amber-glow animate-pulse"
            >
              <Bell className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm font-medium">{alert}</div>
              <button
                onClick={() => setReadyAlerts((prev) => prev.filter((_, idx) => idx !== i))}
                className="text-text-muted hover:text-text-primary text-xs"
              >
                ✕
              </button>
            </div>
          ))}
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
              {filteredMenu?.map((item: any) => {
                const stock = getStock(item);
                const threshold = Number(item.lowStockThreshold ?? item.low_stock_threshold ?? LOW_STOCK_THRESHOLD);
                const outOfStock = stock !== null && stock <= 0;
                const lowStock = stock !== null && stock > 0 && stock <= threshold;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    disabled={outOfStock}
                    className={`relative glass rounded-xl p-4 transition-all text-left ${
                      outOfStock
                        ? 'opacity-40 cursor-not-allowed grayscale'
                        : 'hover:bg-primary/10 active:scale-95'
                    }`}
                  >
                    {lowStock && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-secondary/20 border border-secondary text-secondary text-[10px] font-bold uppercase">
                        Low
                      </span>
                    )}
                    {outOfStock && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-danger/20 border border-danger text-danger text-[10px] font-bold uppercase">
                        Out
                      </span>
                    )}
                    <div className="text-4xl mb-2">🍗</div>
                    <h3 className="font-display font-semibold text-text-primary mb-1">{item.name}</h3>
                    <p className="text-primary font-bold">${parseFloat(item.price).toFixed(2)}</p>
                    {stock !== null && (
                      <p className={`text-xs mt-2 ${outOfStock ? 'text-danger' : lowStock ? 'text-secondary' : 'text-success'}`}>
                        Stock: {stock}
                      </p>
                    )}
                  </button>
                );
              })}
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
