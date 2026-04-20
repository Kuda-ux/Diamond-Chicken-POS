import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { ordersApi } from '../services/api';

export default function KitchenPage() {
  const { data: orders } = useQuery({
    queryKey: ['kitchen-orders'],
    queryFn: async () => {
      const res = await ordersApi.getAll({ status: 'confirmed,preparing' });
      return res.data.data;
    },
    refetchInterval: 5000,
  });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="font-display text-4xl font-bold text-gradient">
          ◆ Diamond Chicken — Kitchen Display
        </h1>
        <div className="text-2xl font-display text-text-primary">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {orders?.map((order: any) => (
          <div
            key={order.id}
            className={`glass-elevated rounded-2xl p-6 border-l-4 ${
              order.status === 'confirmed' ? 'border-info' : 'border-secondary'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="font-display text-2xl font-bold text-primary">
                  {order.orderNumber}
                </h2>
                <p className="text-text-secondary text-sm">
                  {order.orderType === 'dine_in' ? '🍽️ Dine-in' : '🛍️ Takeaway'}
                  {order.tableNumber && ` • Table ${order.tableNumber}`}
                </p>
              </div>
              <div className="flex items-center gap-2 text-text-muted">
                <Clock className="w-4 h-4" />
                <span className="text-sm">5 min</span>
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="text-lg font-semibold text-text-primary">2x Quarter Chicken</div>
              <div className="text-lg font-semibold text-text-primary">1x Large Chips</div>
              <div className="text-lg font-semibold text-text-primary">2x Coca-Cola</div>
            </div>

            {order.notes && (
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 mb-4">
                <p className="text-sm text-danger font-medium">Note: {order.notes}</p>
              </div>
            )}

            <button className="w-full py-3 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 transition-all">
              {order.status === 'confirmed' ? 'Start Preparing' : 'Mark Ready'}
            </button>
          </div>
        ))}
      </div>

      {(!orders || orders.length === 0) && (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">✨</div>
          <p className="text-2xl text-text-secondary">All caught up! No pending orders.</p>
        </div>
      )}
    </div>
  );
}
