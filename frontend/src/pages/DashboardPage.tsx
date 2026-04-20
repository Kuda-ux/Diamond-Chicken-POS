import { useQuery } from '@tanstack/react-query';
import { DollarSign, ShoppingBag, TrendingUp, Package } from 'lucide-react';
import { ordersApi } from '../services/api';

export default function DashboardPage() {
  const { data: summary } = useQuery({
    queryKey: ['today-summary'],
    queryFn: async () => {
      const res = await ordersApi.getTodaySummary();
      return res.data.data;
    },
    refetchInterval: 30000,
  });

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mb-8">
        <h1 className="font-display text-4xl font-bold text-gradient mb-2">
          Manager Dashboard
        </h1>
        <p className="text-text-secondary">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
          </div>
          <h3 className="text-text-secondary text-sm mb-1">Today's Revenue</h3>
          <p className="font-display text-3xl font-bold text-primary">
            ${parseFloat(summary?.totalRevenue || '0').toFixed(2)}
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-info" />
            </div>
          </div>
          <h3 className="text-text-secondary text-sm mb-1">Orders Today</h3>
          <p className="font-display text-3xl font-bold text-text-primary">
            {summary?.totalOrders || 0}
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-success" />
            </div>
          </div>
          <h3 className="text-text-secondary text-sm mb-1">Avg. Order Value</h3>
          <p className="font-display text-3xl font-bold text-text-primary">
            ${parseFloat(summary?.averageOrderValue || '0').toFixed(2)}
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center">
              <Package className="w-6 h-6 text-secondary" />
            </div>
          </div>
          <h3 className="text-text-secondary text-sm mb-1">Items Sold</h3>
          <p className="font-display text-3xl font-bold text-text-primary">
            {summary?.totalItems || 0}
          </p>
        </div>
      </div>

      <div className="glass rounded-2xl p-8">
        <h2 className="font-display text-2xl font-bold mb-6">Recent Orders</h2>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-surface rounded-xl">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center font-bold text-primary">
                  #{i}
                </div>
                <div>
                  <p className="font-semibold text-text-primary">Order DC-{String(i).padStart(4, '0')}</p>
                  <p className="text-sm text-text-secondary">2 items • Takeaway</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-primary">$12.50</p>
                <p className="text-xs text-success">Completed</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
