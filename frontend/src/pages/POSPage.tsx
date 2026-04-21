import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, ShoppingCart, Plus, Minus, Trash2, LogOut, Bell, Lock, PlayCircle,
  Diamond, X, Sparkles,
} from 'lucide-react';
import { menuApi, categoriesApi, shiftsApi } from '../services/api';
import { useCartStore } from '../stores/cartStore';
import { useAuthStore } from '../stores/authStore';
import PaymentModal from '../components/PaymentModal';
import ShiftCloseModal from '../components/ShiftCloseModal';
import { getSocket, joinRoom } from '../services/socket';

const LOW_STOCK_THRESHOLD = 10;

const CATEGORY_EMOJI: Record<string, string> = {
  chicken: '🍗', burger: '🍔', sides: '🍟', drinks: '🥤',
  dessert: '🍰', salad: '🥗', rice: '🍛', pizza: '🍕',
};

function emojiForItem(name: string, categoryName?: string): string {
  const n = (categoryName || name).toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_EMOJI)) if (n.includes(k)) return v;
  return '🍴';
}

export default function POSPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [readyAlerts, setReadyAlerts] = useState<string[]>([]);
  const [shiftCloseOpen, setShiftCloseOpen] = useState(false);
  const [openingFloat, setOpeningFloat] = useState('');
  const [shiftLoading, setShiftLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [cartDrawer, setCartDrawer] = useState(false); // mobile cart drawer
  const { user, logout } = useAuthStore();
  const cart = useCartStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: currentShift, refetch: refetchShift } = useQuery({
    queryKey: ['current-shift'],
    queryFn: async () => (await shiftsApi.current()).data.data,
  });

  const handleOpenShift = async () => {
    const val = parseFloat(openingFloat);
    if (isNaN(val) || val < 0) return;
    setShiftLoading(true);
    try {
      await shiftsApi.open(val);
      await refetchShift();
      setOpeningFloat('');
    } finally { setShiftLoading(false); }
  };

  useEffect(() => {
    const socket = getSocket();
    joinRoom('cashiers');
    const onReady = (order: any) => {
      const msg = `Order ${order.orderNumber} is READY for pickup`;
      setReadyAlerts((prev) => [msg, ...prev].slice(0, 5));
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = 880; gain.gain.value = 0.1;
        osc.start();
        setTimeout(() => { osc.stop(); ctx.close(); }, 200);
      } catch { /* noop */ }
    };
    socket.on('order:ready', onReady);
    const refreshMenu = () => queryClient.invalidateQueries({ queryKey: ['menu'] });
    socket.on('order:new', refreshMenu);
    return () => { socket.off('order:ready', onReady); socket.off('order:new', refreshMenu); };
  }, [queryClient]);

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => (await categoriesApi.getAll()).data.data,
  });

  const { data: menu } = useQuery({
    queryKey: ['menu'],
    queryFn: async () => (await menuApi.getAll()).data.data,
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
      setTimeout(() => setToast(null), 2500);
      return;
    }
    const existing = cart.items.find((i) => i.menuItemId === item.id);
    const nextQty = (existing?.quantity || 0) + 1;
    if (stock !== null && nextQty > stock) {
      setToast(`Only ${stock} of ${item.name} left`);
      setTimeout(() => setToast(null), 2500);
      return;
    }
    cart.addItem({ menuItemId: item.id, name: item.name, price: item.price });
  };

  const categoryNameById = (id: string) => categories?.find((c: any) => c.id === id)?.name;
  const cartCount = cart.items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ---------- Top bar ---------- */}
      <header className="h-14 sm:h-16 bg-panel border-b border-border flex items-center justify-between px-3 sm:px-6 flex-shrink-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
            <Diamond className="w-5 h-5 text-background" fill="currentColor" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold text-text-primary leading-none truncate">Diamond Chicken</p>
            <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1.5">
              <span className="dot dot-live" /> Point of Sale
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden xl:block text-xs text-text-secondary tabular-nums font-mono px-2">
            {new Date(now).toLocaleTimeString()}
          </div>
          <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 bg-panel-2 border border-border rounded-xl">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center font-display font-bold text-background text-xs">
              {user?.name?.[0]?.toUpperCase() || 'C'}
            </div>
            <div className="text-xs leading-tight">
              <p className="font-semibold text-text-primary">{user?.name}</p>
              <p className="text-text-muted capitalize text-[10px]">{user?.role}</p>
            </div>
          </div>
          {currentShift && (
            <button
              onClick={() => setShiftCloseOpen(true)}
              className="btn btn-ghost text-xs sm:text-sm px-3"
              style={{ borderColor: 'rgba(255,107,53,0.4)', color: '#FF6B35' }}
            >
              <Lock className="w-4 h-4" />
              <span className="hidden sm:inline">Close Shift</span>
            </button>
          )}
          <button onClick={logout} className="btn btn-ghost text-xs sm:text-sm px-3">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
          {/* Mobile cart toggle */}
          <button
            onClick={() => setCartDrawer(true)}
            className="lg:hidden relative btn btn-primary px-3"
          >
            <ShoppingCart className="w-4 h-4" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center border-2 border-background">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* ---------- Start shift prompt ---------- */}
      {!currentShift && (
        <div className="bg-info/10 border-b border-info/20 px-4 sm:px-6 py-3 flex items-center justify-between flex-shrink-0 animate-slide-up flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-info/15 border border-info/30 flex items-center justify-center flex-shrink-0">
              <PlayCircle className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Start your shift to take orders</p>
              <p className="text-xs text-text-muted">Enter your opening cash float.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm font-semibold pointer-events-none z-10">$</span>
              <input
                type="number" step="0.01" value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="0.00"
                className="input pl-7 w-full sm:w-32 h-10"
                onKeyDown={(e) => e.key === 'Enter' && handleOpenShift()}
              />
            </div>
            <button onClick={handleOpenShift} disabled={shiftLoading || !openingFloat} className="btn btn-primary h-10 text-sm">
              {shiftLoading ? 'Opening…' : 'Start Shift'}
            </button>
          </div>
        </div>
      )}

      <ShiftCloseModal
        open={shiftCloseOpen}
        onClose={() => setShiftCloseOpen(false)}
        onClosed={() => { setShiftCloseOpen(false); refetchShift(); }}
      />

      {toast && (
        <div className="fixed top-20 right-4 sm:right-6 z-40 animate-slide-up max-w-[90vw]">
          <div className="glass-elevated rounded-xl px-4 py-3 flex items-center gap-3 border-danger/30">
            <span className="w-2 h-2 rounded-full bg-danger animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold text-text-primary">{toast}</span>
          </div>
        </div>
      )}

      {readyAlerts.length > 0 && (
        <div className="fixed bottom-4 right-4 sm:right-6 z-40 space-y-2 max-w-[90vw] sm:max-w-sm">
          {readyAlerts.map((alert, i) => (
            <div key={`${alert}-${i}`} className="flex items-start gap-3 bg-panel-2 border border-primary/40 rounded-xl px-4 py-3 amber-glow-soft animate-slide-up">
              <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-primary font-bold uppercase tracking-wider">Ready for pickup</p>
                <p className="text-sm font-semibold text-text-primary mt-0.5">{alert}</p>
              </div>
              <button onClick={() => setReadyAlerts((prev) => prev.filter((_, idx) => idx !== i))} className="text-text-muted hover:text-text-primary flex-shrink-0"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      <PaymentModal
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        onSuccess={(orderNumber, change) => {
          setPaymentOpen(false);
          setCartDrawer(false);
          const msg = change && change > 0
            ? `Order ${orderNumber} sent • Change $${change.toFixed(2)}`
            : `Order ${orderNumber} sent to kitchen`;
          setToast(msg);
          setTimeout(() => setToast(null), 4000);
        }}
      />

      {/* ---------- Main ---------- */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: menu */}
        <div className="flex-1 flex flex-col p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-hidden">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none z-10" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search menu items..."
              className="input pl-12 pr-12 py-3.5"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg hover:bg-panel-2 flex items-center justify-center text-text-muted z-10"
              ><X className="w-4 h-4" /></button>
            )}
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
            <CategoryPill
              active={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              icon="✨" label="All" count={menu?.length}
            />
            {categories?.map((cat: any) => (
              <CategoryPill
                key={cat.id}
                active={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                icon={cat.icon || emojiForItem(cat.name)}
                label={cat.name}
                count={menu?.filter((m: any) => m.categoryId === cat.id).length}
              />
            ))}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto -mr-3 pr-3">
            {!menu ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="shimmer rounded-2xl h-36 sm:h-40" />
                ))}
              </div>
            ) : filteredMenu?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full bg-panel flex items-center justify-center mb-4 text-4xl">🔎</div>
                <p className="font-display text-lg font-semibold text-text-primary mb-1">No items match</p>
                <p className="text-sm text-text-muted">Try a different search or category</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                {filteredMenu?.map((item: any) => {
                  const stock = getStock(item);
                  const threshold = Number(item.lowStockThreshold ?? item.low_stock_threshold ?? LOW_STOCK_THRESHOLD);
                  const outOfStock = stock !== null && stock <= 0;
                  const lowStock = stock !== null && stock > 0 && stock <= threshold;
                  const inCart = cart.items.find((i) => i.menuItemId === item.id);
                  const emoji = emojiForItem(item.name, categoryNameById(item.categoryId));
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleAddToCart(item)}
                      disabled={outOfStock}
                      className={`card card-interactive p-3 sm:p-4 text-left ${outOfStock ? 'opacity-40 grayscale cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2 sm:mb-3">
                        <div className="text-3xl sm:text-4xl">{emoji}</div>
                        {outOfStock ? <span className="chip chip-danger">Out</span>
                          : lowStock ? <span className="chip chip-warn">Low</span>
                          : inCart ? <span className="chip chip-primary">×{inCart.quantity}</span>
                          : null}
                      </div>
                      <h3 className="font-display font-semibold text-text-primary text-xs sm:text-sm leading-tight mb-1 line-clamp-2 min-h-[2.2rem]">
                        {item.name}
                      </h3>
                      <div className="flex items-end justify-between mt-2">
                        <p className="font-display text-lg sm:text-xl font-bold text-primary tabular-nums">${parseFloat(item.price).toFixed(2)}</p>
                        {stock !== null && (
                          <span className={`text-[10px] font-semibold uppercase tracking-wider ${
                            outOfStock ? 'text-danger' : lowStock ? 'text-secondary' : 'text-text-muted'
                          }`}>{stock} left</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: cart (desktop) or drawer (mobile/tablet) */}
        <CartPanel
          open={cartDrawer}
          onClose={() => setCartDrawer(false)}
          onCheckout={() => setPaymentOpen(true)}
        />
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

function CartPanel({
  open, onClose, onCheckout,
}: { open: boolean; onClose: () => void; onCheckout: () => void }) {
  const cart = useCartStore();
  const isEmpty = cart.items.length === 0;

  const inner = (
    <>
      <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
        <h2 className="font-display text-lg sm:text-xl font-bold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Current Order
        </h2>
        <div className="flex items-center gap-2">
          {!isEmpty && (
            <button onClick={cart.clearCart} className="text-xs text-text-muted hover:text-danger flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
          <button onClick={onClose} className="lg:hidden w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-10">
            <div className="w-20 h-20 rounded-2xl bg-panel-2 flex items-center justify-center mb-4">
              <ShoppingCart className="w-8 h-8 text-text-muted" />
            </div>
            <p className="font-display text-lg font-semibold text-text-primary mb-1">Empty cart</p>
            <p className="text-sm text-text-muted">Tap items on the left to start building the order.</p>
            <div className="mt-6 flex items-center gap-2 text-xs text-text-muted">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Orders sync to kitchen instantly
            </div>
          </div>
        ) : (
          cart.items.map((item) => (
            <div key={item.menuItemId} className="bg-panel border border-border rounded-xl p-3 flex items-center gap-3 animate-scale-in">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-primary text-sm truncate">{item.name}</p>
                <p className="text-xs text-text-muted">
                  ${parseFloat(item.price).toFixed(2)} × {item.quantity} = <span className="text-primary font-semibold">${(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                </p>
              </div>
              <div className="flex items-center gap-1 bg-panel-2 border border-border rounded-lg p-1">
                <button
                  onClick={() => cart.updateQuantity(item.menuItemId, item.quantity - 1)}
                  className="w-7 h-7 rounded-md hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-secondary transition-colors"
                ><Minus className="w-3.5 h-3.5" /></button>
                <span className="w-6 text-center font-bold text-sm tabular-nums">{item.quantity}</span>
                <button
                  onClick={() => cart.updateQuantity(item.menuItemId, item.quantity + 1)}
                  className="w-7 h-7 rounded-md hover:bg-primary/15 hover:text-primary flex items-center justify-center text-text-secondary transition-colors"
                ><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <button
                onClick={() => cart.removeItem(item.menuItemId)}
                className="w-8 h-8 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted transition-colors flex-shrink-0"
              ><Trash2 className="w-4 h-4" /></button>
            </div>
          ))
        )}
      </div>

      <div className="p-4 sm:p-5 border-t border-border space-y-3 sm:space-y-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-text-secondary">
            <span>Subtotal</span>
            <span className="tabular-nums">${cart.getSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-text-secondary">
            <span>VAT (15%)</span>
            <span className="tabular-nums">${cart.getTax().toFixed(2)}</span>
          </div>
          <div className="divider my-2" />
          <div className="flex justify-between items-baseline font-display">
            <span className="text-text-secondary text-sm uppercase tracking-wider">Total</span>
            <span className="text-2xl sm:text-3xl font-bold text-primary tabular-nums">${cart.getTotal().toFixed(2)}</span>
          </div>
        </div>
        <button disabled={isEmpty} onClick={onCheckout} className="btn btn-primary w-full py-3.5 sm:py-4 text-base">
          {isEmpty ? 'Add items to continue' : <>Charge ${cart.getTotal().toFixed(2)}</>}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: always-visible right rail */}
      <aside className="hidden lg:flex w-[340px] xl:w-[380px] 2xl:w-[420px] bg-panel border-l border-border flex-col flex-shrink-0">
        {inner}
      </aside>

      {/* Mobile/Tablet: drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex justify-end animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
          <aside className="relative w-full sm:w-[420px] max-w-full bg-panel border-l border-border flex flex-col animate-slide-up h-full">
            {inner}
          </aside>
        </div>
      )}
    </>
  );
}

function CategoryPill({
  active, onClick, icon, label, count,
}: { active: boolean; onClick: () => void; icon: string; label: string; count?: number }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-medium whitespace-nowrap transition-all flex items-center gap-2 border ${
        active ? 'bg-primary text-background border-primary' : 'bg-panel text-text-secondary border-border hover:text-text-primary hover:border-border-strong'
      }`}
    >
      <span className="text-sm sm:text-base">{icon}</span>
      <span className="text-xs sm:text-sm font-semibold">{label}</span>
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? 'bg-background/20' : 'bg-panel-2'}`}>{count}</span>
      )}
    </button>
  );
}
