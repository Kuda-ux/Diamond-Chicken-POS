import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut, ChefHat, Timer, Check, Play, AlertCircle } from 'lucide-react';
import { api, ordersApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { getSocket, joinRoom } from '../services/socket';

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}
function secondsSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
}

const ORDER_TYPE_META: Record<string, { emoji: string; label: string }> = {
  dine_in: { emoji: '🍽️', label: 'Dine-in' },
  takeaway: { emoji: '🛍️', label: 'Takeaway' },
  delivery: { emoji: '🛵', label: 'Delivery' },
};

export default function KitchenPage() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    joinRoom('kitchen');
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      queryClient.invalidateQueries({ queryKey: ['kitchen-order-details'] });
    };
    socket.on('order:new', refresh);
    socket.on('order:updated', refresh);
    return () => { socket.off('order:new', refresh); socket.off('order:updated', refresh); };
  }, [queryClient]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: async () => {
      const [a, b] = await Promise.all([
        ordersApi.getAll({ status: 'confirmed' }),
        ordersApi.getAll({ status: 'preparing' }),
      ]);
      return [...(a.data.data || []), ...(b.data.data || [])]
        .sort((x: any, y: any) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
    },
    refetchInterval: 5000,
  });

  const { data: detailedOrders } = useQuery({
    queryKey: ['kitchen-order-details', orders?.map((o: any) => `${o.id}:${o.status}`).join('|')],
    enabled: !!orders && orders.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        (orders || []).map(async (o: any) => {
          try { return (await api.get(`/orders/${o.id}`)).data.data; }
          catch { return o; }
        })
      );
      return results;
    },
  });

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      await ordersApi.updateStatus(orderId, newStatus);
      await queryClient.invalidateQueries({ queryKey: ['kitchen-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['kitchen-order-details'] });
    } finally { setUpdatingId(null); }
  };

  const list: any[] = detailedOrders || orders || [];
  const confirmedCount = list.filter((o) => o.status === 'confirmed').length;
  const preparingCount = list.filter((o) => o.status === 'preparing').length;
  const urgentCount = list.filter((o) => minutesSince(o.created_at || o.createdAt) >= 15).length;

  return (
    <div className="min-h-screen p-5">
      {/* Top bar */}
      <header className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center amber-glow-soft">
            <ChefHat className="w-7 h-7 text-background" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold text-gradient leading-none">Kitchen Display</h1>
            <p className="text-sm text-text-secondary mt-1 flex items-center gap-2">
              <span className="dot dot-live" /> {user?.name} • {list.length} active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <StatBadge label="Incoming" value={confirmedCount} color="info" />
          <StatBadge label="Cooking" value={preparingCount} color="secondary" />
          <StatBadge label="Urgent" value={urgentCount} color="danger" />
          <div className="px-4 py-2 glass rounded-xl text-center">
            <p className="text-[10px] text-text-muted uppercase tracking-wider">Time</p>
            <p className="font-display font-bold text-text-primary tabular-nums text-sm">
              {new Date(now).toLocaleTimeString()}
            </p>
          </div>
          <button onClick={logout} className="btn btn-ghost text-sm">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      {/* Body */}
      {isLoading && !list.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="shimmer rounded-2xl h-64" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="glass rounded-3xl p-20 text-center">
          <div className="text-8xl mb-6 animate-float inline-block">✨</div>
          <h2 className="font-display text-3xl font-bold text-gradient mb-2">All caught up!</h2>
          <p className="text-text-secondary">No pending orders. Great work team.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
          {list.map((order) => {
            const created = order.created_at || order.createdAt;
            const secs = secondsSince(created);
            const mins = Math.floor(secs / 60);
            const displaySecs = secs % 60;
            const urgent = mins >= 15;
            const hot = mins >= 10;
            const status = order.status;
            const items = order.items || [];
            const typeKey = order.order_type || order.orderType;
            const typeMeta = ORDER_TYPE_META[typeKey] || { emoji: '•', label: typeKey };
            const tableNum = order.table_number || order.tableNumber;
            const totalQty = items.reduce((s: number, it: any) => s + (it.quantity || 0), 0);

            return (
              <div
                key={order.id}
                className={`relative glass-elevated rounded-2xl p-5 overflow-hidden transition-all animate-slide-up ${
                  urgent ? 'danger-glow' : ''
                }`}
              >
                {/* Side bar indicator */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                  urgent ? 'bg-danger' : hot ? 'bg-secondary' : status === 'preparing' ? 'bg-primary' : 'bg-info'
                }`} />

                {/* Header */}
                <div className="flex items-start justify-between mb-4 pl-2">
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
                      {status === 'confirmed' ? 'Incoming' : 'Cooking'}
                    </p>
                    <h2 className="font-display text-2xl font-bold text-text-primary leading-none">
                      {order.order_number || order.orderNumber}
                    </h2>
                    <p className="text-text-secondary text-sm mt-2 flex items-center gap-1.5">
                      <span className="text-base">{typeMeta.emoji}</span>
                      {typeMeta.label}{tableNum && ` • Table ${tableNum}`}
                    </p>
                  </div>

                  {/* Timer badge */}
                  <div className={`flex flex-col items-center px-3 py-2 rounded-xl ${
                    urgent ? 'bg-danger-soft border border-danger/40'
                      : hot ? 'bg-secondary-soft border border-secondary/40'
                      : 'bg-surface-2 border border-border'
                  }`}>
                    <div className={`flex items-center gap-1 ${urgent ? 'text-danger' : hot ? 'text-secondary' : 'text-text-muted'}`}>
                      {urgent ? <AlertCircle className="w-3 h-3" /> : <Timer className="w-3 h-3" />}
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {urgent ? 'Urgent' : hot ? 'Hot' : 'Timer'}
                      </span>
                    </div>
                    <p className={`font-display text-lg font-bold tabular-nums mt-0.5 ${
                      urgent ? 'text-danger' : hot ? 'text-secondary' : 'text-text-primary'
                    }`}>
                      {mins}:{displaySecs.toString().padStart(2, '0')}
                    </p>
                  </div>
                </div>

                {/* Quantity summary */}
                <div className="flex items-center gap-2 mb-3 text-xs">
                  <span className="chip">
                    <span className="text-primary">{totalQty}</span> units
                  </span>
                  <span className="chip">
                    <Clock className="w-3 h-3" /> {mins}m
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2 mb-4 min-h-[80px] max-h-60 overflow-y-auto -mr-2 pr-2">
                  {items.length === 0 ? (
                    <p className="text-sm text-text-muted italic">Loading items…</p>
                  ) : (
                    items.map((it: any, idx: number) => (
                      <div key={it.id || idx} className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-lg bg-primary-soft border border-primary/30 flex items-center justify-center flex-shrink-0">
                          <span className="font-display font-bold text-primary text-sm">{it.quantity}</span>
                        </div>
                        <p className="text-text-primary font-medium text-sm leading-tight pt-1.5">
                          {it.menuItem?.name || it.name || 'Item'}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Notes */}
                {order.notes && (
                  <div className="p-3 rounded-xl bg-danger-soft border border-danger/20 mb-4">
                    <p className="text-[10px] text-danger uppercase tracking-wider font-bold mb-1">Note</p>
                    <p className="text-xs text-text-primary">{order.notes}</p>
                  </div>
                )}

                {/* Action button */}
                <button
                  disabled={updatingId === order.id}
                  onClick={() => updateStatus(order.id, status === 'confirmed' ? 'preparing' : 'ready')}
                  className={`w-full py-3.5 font-display font-bold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    status === 'confirmed'
                      ? 'bg-info text-background hover:bg-info/90'
                      : 'btn-primary'
                  }`}
                >
                  {updatingId === order.id
                    ? 'Updating…'
                    : status === 'confirmed'
                      ? <><Play className="w-4 h-4" /> Start Preparing</>
                      : <><Check className="w-4 h-4" /> Mark Ready</>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }: { label: string; value: number; color: 'info' | 'secondary' | 'danger' }) {
  const tints = {
    info: 'bg-info-soft border-info/30 text-info',
    secondary: 'bg-secondary-soft border-secondary/30 text-secondary',
    danger: 'bg-danger-soft border-danger/30 text-danger',
  }[color];
  return (
    <div className={`px-4 py-2 rounded-xl border ${tints} text-center min-w-[90px]`}>
      <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">{label}</p>
      <p className="font-display text-xl font-bold tabular-nums leading-none">{value}</p>
    </div>
  );
}
