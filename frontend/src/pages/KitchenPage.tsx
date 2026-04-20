import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, LogOut, ChefHat } from 'lucide-react';
import { api, ordersApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

function minutesSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
}

export default function KitchenPage() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['kitchen-orders', now],
    queryFn: async () => {
      // Fetch confirmed + preparing separately and merge (API doesn't support comma-list)
      const [a, b] = await Promise.all([
        ordersApi.getAll({ status: 'confirmed' }),
        ordersApi.getAll({ status: 'preparing' }),
      ]);
      return [...(a.data.data || []), ...(b.data.data || [])]
        .sort((x: any, y: any) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime());
    },
    refetchInterval: 5000,
  });

  // Fetch detailed items for each order (includes items[])
  const { data: detailedOrders } = useQuery({
    queryKey: ['kitchen-order-details', orders?.map((o: any) => `${o.id}:${o.status}`).join('|')],
    enabled: !!orders && orders.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        (orders || []).map(async (o: any) => {
          try {
            const res = await api.get(`/orders/${o.id}`);
            return res.data.data;
          } catch {
            return o;
          }
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
    } finally {
      setUpdatingId(null);
    }
  };

  const list = detailedOrders || orders || [];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="w-10 h-10 text-primary" />
          <div>
            <h1 className="font-display text-3xl font-bold text-gradient">
              Diamond Chicken — Kitchen
            </h1>
            <p className="text-sm text-text-secondary">
              {user?.name} • {list.length} active order{list.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xl font-display text-text-primary tabular-nums">
            {new Date(now).toLocaleTimeString()}
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-3 py-2 rounded-lg glass hover:bg-surface-2 text-text-secondary text-sm"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {isLoading && !list.length ? (
        <div className="text-center py-20 text-text-secondary">Loading orders…</div>
      ) : list.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">✨</div>
          <p className="text-2xl text-text-secondary">All caught up! No pending orders.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((order: any) => {
            const mins = minutesSince(order.created_at || order.createdAt);
            const status = order.status;
            const items = order.items || [];
            const urgent = mins >= 15;
            return (
              <div
                key={order.id}
                className={`glass-elevated rounded-2xl p-5 border-l-4 transition-all ${
                  urgent ? 'border-danger' : status === 'confirmed' ? 'border-info' : 'border-secondary'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-primary">
                      {order.order_number || order.orderNumber}
                    </h2>
                    <p className="text-text-secondary text-sm">
                      {order.order_type === 'dine_in' || order.orderType === 'dine_in'
                        ? '🍽️ Dine-in'
                        : order.order_type === 'delivery' || order.orderType === 'delivery'
                          ? '� Delivery'
                          : '�🛍️ Takeaway'}
                      {(order.table_number || order.tableNumber) &&
                        ` • Table ${order.table_number || order.tableNumber}`}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 text-sm font-semibold ${urgent ? 'text-danger' : 'text-text-muted'}`}>
                    <Clock className="w-4 h-4" />
                    <span>{mins} min</span>
                  </div>
                </div>

                <div className="space-y-1.5 mb-4 min-h-[60px]">
                  {items.length === 0 ? (
                    <p className="text-sm text-text-muted italic">No item details</p>
                  ) : (
                    items.map((it: any, idx: number) => (
                      <div key={it.id || idx} className="flex gap-3 text-text-primary">
                        <span className="font-display font-bold text-primary min-w-[2rem]">{it.quantity}×</span>
                        <span className="font-medium">
                          {it.menuItem?.name || it.name || 'Item'}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                {order.notes && (
                  <div className="bg-danger/10 border border-danger/20 rounded-lg p-2.5 mb-3">
                    <p className="text-xs text-danger font-medium">📝 {order.notes}</p>
                  </div>
                )}

                <button
                  disabled={updatingId === order.id}
                  onClick={() =>
                    updateStatus(order.id, status === 'confirmed' ? 'preparing' : 'ready')
                  }
                  className={`w-full py-3 font-display font-bold rounded-lg transition-all disabled:opacity-50 ${
                    status === 'confirmed'
                      ? 'bg-info text-background hover:bg-info/90'
                      : 'bg-primary text-background hover:bg-primary/90 amber-glow'
                  }`}
                >
                  {updatingId === order.id
                    ? 'Updating…'
                    : status === 'confirmed'
                      ? '▶ Start Preparing'
                      : '✓ Mark Ready'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
