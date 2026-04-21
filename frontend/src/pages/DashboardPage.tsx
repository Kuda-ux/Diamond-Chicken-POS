import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, ShoppingBag, TrendingUp, Package, AlertTriangle,
  LogOut, Boxes,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { statsApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { getSocket, joinRoom } from '../services/socket';

const METHOD_COLORS: Record<string, string> = {
  cash: '#10b981',
  ecocash: '#3b82f6',
  innbucks: '#a855f7',
  zipit: '#06b6d4',
  visa: '#f97316',
  mastercard: '#f59e0b',
  unpaid: '#6b7280',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-text-muted',
  confirmed: 'text-info',
  preparing: 'text-secondary',
  ready: 'text-primary',
  completed: 'text-success',
  cancelled: 'text-danger',
};

function formatMoney(v: number | string | undefined): string {
  const n = typeof v === 'string' ? parseFloat(v) : (v || 0);
  return `$${n.toFixed(2)}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  // Real-time: refresh stats on any order event
  useEffect(() => {
    const socket = getSocket();
    joinRoom('managers');
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['stats'] });
    socket.on('order:new', refresh);
    socket.on('order:updated', refresh);
    return () => {
      socket.off('order:new', refresh);
      socket.off('order:updated', refresh);
    };
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await statsApi.dashboard()).data.data,
    refetchInterval: 15000,
  });

  const summary = data?.summary || {};
  const hourlyRevenue = data?.hourlyRevenue || [];
  const paymentBreakdown = data?.paymentBreakdown || [];
  const recentOrders = data?.recentOrders || [];
  const lowStock = data?.lowStock || [];

  // Pad hourly to full 24h for nicer chart
  const hourlyPadded = Array.from({ length: 24 }, (_, h) => {
    const found = hourlyRevenue.find((r: any) => r.hour === h);
    return { hour: `${h.toString().padStart(2, '0')}h`, revenue: found?.revenue || 0, orders: found?.orders || 0 };
  });

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-gradient mb-1">Manager Dashboard</h1>
          <p className="text-text-secondary">Welcome back, {user?.name} • Live data</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/inventory"
            className="flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-surface-2 text-text-primary text-sm font-semibold"
          >
            <Boxes className="w-4 h-4" /> Inventory
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg glass hover:bg-surface-2 text-text-secondary text-sm"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <KpiCard icon={<DollarSign className="w-6 h-6 text-primary" />} tint="primary" label="Today's Revenue" value={formatMoney(summary.totalRevenue)} loading={isLoading} />
        <KpiCard icon={<ShoppingBag className="w-6 h-6 text-info" />} tint="info" label="Orders Today" value={`${summary.totalOrders || 0}`} loading={isLoading} />
        <KpiCard icon={<TrendingUp className="w-6 h-6 text-success" />} tint="success" label="Avg. Order Value" value={formatMoney(summary.averageOrderValue)} loading={isLoading} />
        <KpiCard icon={<Package className="w-6 h-6 text-secondary" />} tint="secondary" label="Items Sold" value={`${summary.totalItems || 0}`} loading={isLoading} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold mb-4">Revenue by Hour</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyPadded}>
                <XAxis dataKey="hour" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                  formatter={(v: any) => formatMoney(v)}
                />
                <Bar dataKey="revenue" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold mb-4">Payment Methods</h2>
          {paymentBreakdown.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-text-muted">No data yet</div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="revenue"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                  >
                    {paymentBreakdown.map((p: any, i: number) => (
                      <Cell key={i} fill={METHOD_COLORS[p.method] || '#f59e0b'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
                    formatter={(v: any) => formatMoney(v)}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Live feed + low stock */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold mb-4">Live Order Feed</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {recentOrders.length === 0 ? (
              <p className="text-text-muted text-center py-8">No orders yet today</p>
            ) : (
              recentOrders.map((o: any) => (
                <div key={o.id} className="flex items-center justify-between p-3 bg-surface rounded-xl hover:bg-surface-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center font-bold text-primary text-xs">
                      {formatTime(o.createdAt)}
                    </div>
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{o.orderNumber}</p>
                      <p className="text-xs text-text-secondary">
                        {o.itemCount} item{o.itemCount !== 1 ? 's' : ''} • {String(o.orderType).replace('_', '-')}
                        {o.cashierName && ` • ${o.cashierName}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatMoney(o.totalAmount)}</p>
                    <p className={`text-xs font-semibold capitalize ${STATUS_COLORS[o.status] || 'text-text-muted'}`}>
                      {o.status}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="glass rounded-2xl p-6">
          <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-secondary" />
            Low Stock Alerts
          </h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {lowStock.length === 0 ? (
              <p className="text-success text-sm text-center py-8">✓ All items well stocked</p>
            ) : (
              lowStock.map((item: any) => {
                const isOut = item.quantity <= 0;
                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-xl border ${
                      isOut ? 'bg-danger/10 border-danger/30' : 'bg-secondary/10 border-secondary/30'
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-text-primary text-sm">{item.name}</p>
                      <p className="text-xs text-text-secondary">Threshold: {item.threshold}</p>
                    </div>
                    <span className={`font-display text-xl font-bold ${isOut ? 'text-danger' : 'text-secondary'}`}>
                      {item.quantity}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <Link
            to="/inventory"
            className="mt-4 w-full py-2.5 flex items-center justify-center gap-2 bg-primary/10 border border-primary/30 rounded-lg text-primary font-semibold text-sm hover:bg-primary/20 transition-colors"
          >
            <Boxes className="w-4 h-4" /> Manage Inventory
          </Link>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon, tint, label, value, loading,
}: { icon: React.ReactNode; tint: string; label: string; value: string; loading?: boolean }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl bg-${tint}/20 flex items-center justify-center`}>{icon}</div>
      </div>
      <h3 className="text-text-secondary text-sm mb-1">{label}</h3>
      <p className="font-display text-3xl font-bold text-text-primary">
        {loading ? '…' : value}
      </p>
    </div>
  );
}
