import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, ShoppingBag, TrendingUp, Package, AlertTriangle,
  LogOut, Boxes, Diamond, Activity, Flame,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import { statsApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';
import { getSocket, joinRoom } from '../services/socket';

const METHOD_META: Record<string, { color: string; label: string }> = {
  cash: { color: '#22C55E', label: 'Cash' },
  ecocash: { color: '#3B82F6', label: 'EcoCash' },
  innbucks: { color: '#A855F7', label: 'InnBucks' },
  zipit: { color: '#06B6D4', label: 'ZIPIT' },
  visa: { color: '#F97316', label: 'Visa' },
  mastercard: { color: '#F59E0B', label: 'Mastercard' },
  unpaid: { color: '#52525B', label: 'Unpaid' },
};

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: 'text-text-muted', label: 'Pending' },
  confirmed: { color: 'text-info', label: 'Confirmed' },
  preparing: { color: 'text-secondary', label: 'Preparing' },
  ready: { color: 'text-primary', label: 'Ready' },
  completed: { color: 'text-success', label: 'Completed' },
  cancelled: { color: 'text-danger', label: 'Cancelled' },
};

const money = (v: number | string | undefined) =>
  `$${(typeof v === 'string' ? parseFloat(v) : (v || 0)).toFixed(2)}`;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    joinRoom('managers');
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['stats'] });
    socket.on('order:new', refresh);
    socket.on('order:updated', refresh);
    return () => { socket.off('order:new', refresh); socket.off('order:updated', refresh); };
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await statsApi.dashboard()).data.data,
    refetchInterval: 15000,
  });

  const summary = data?.summary || {};
  const hourlyRevenue: any[] = data?.hourlyRevenue || [];
  const paymentBreakdown: any[] = data?.paymentBreakdown || [];
  const recentOrders: any[] = data?.recentOrders || [];
  const lowStock: any[] = data?.lowStock || [];

  const hourlyPadded = Array.from({ length: 24 }, (_, h) => {
    const found = hourlyRevenue.find((r) => r.hour === h);
    return {
      hour: h.toString().padStart(2, '0'),
      revenue: found?.revenue || 0,
      orders: found?.orders || 0,
    };
  });

  const currentHour = new Date().getHours();
  const totalPayments = paymentBreakdown.reduce((s, p) => s + (p.revenue || 0), 0) || 1;

  return (
    <div className="min-h-screen">
      {/* ---------- Top bar ---------- */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center amber-glow-soft">
              <Diamond className="w-5 h-5 text-background" fill="currentColor" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-text-primary leading-none">Diamond Chicken</h1>
              <p className="text-xs text-text-muted mt-1 flex items-center gap-1.5">
                <span className="dot dot-live" /> Live data • refreshing every 15s
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 px-3 py-2 glass rounded-xl">
              <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center font-display font-bold text-background text-sm">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="text-xs">
                <p className="font-semibold text-text-primary leading-none">{user?.name}</p>
                <p className="text-text-muted mt-0.5 capitalize">{user?.role}</p>
              </div>
            </div>
            <Link to="/inventory" className="btn btn-ghost text-sm">
              <Boxes className="w-4 h-4" /> Inventory
            </Link>
            <button onClick={logout} className="btn btn-ghost text-sm">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-6 space-y-6">
        {/* ---------- Welcome / Hero ---------- */}
        <div className="relative overflow-hidden rounded-3xl p-8 glass-elevated noise">
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full bg-brand opacity-10 blur-3xl" />
          <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-text-muted mb-2">Welcome back,</p>
              <h2 className="font-display text-4xl font-bold text-text-primary mb-1">{user?.name}</h2>
              <p className="text-text-secondary">Here's how Diamond Chicken is performing today.</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Today</p>
              <p className="font-display text-2xl font-bold text-gradient">
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        </div>

        {/* ---------- KPI cards ---------- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-in">
          <KpiCard
            tint="primary" Icon={DollarSign}
            label="Today's Revenue" value={money(summary.totalRevenue)}
            hint={`VAT: ${money(summary.totalTax)}`}
            loading={isLoading}
          />
          <KpiCard
            tint="info" Icon={ShoppingBag}
            label="Orders Today" value={`${summary.totalOrders || 0}`}
            hint={`${recentOrders.length} in last view`}
            loading={isLoading}
          />
          <KpiCard
            tint="success" Icon={TrendingUp}
            label="Avg. Order Value" value={money(summary.averageOrderValue)}
            hint="Per transaction"
            loading={isLoading}
          />
          <KpiCard
            tint="secondary" Icon={Package}
            label="Items Sold" value={`${summary.totalItems || 0}`}
            hint="Units moved today"
            loading={isLoading}
          />
        </div>

        {/* ---------- Charts ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-text-primary">Revenue by Hour</h3>
                <p className="text-xs text-text-muted mt-0.5">Live throughout the day</p>
              </div>
              <span className="chip chip-primary"><Flame className="w-3 h-3" /> Today</span>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyPadded} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F5A623" stopOpacity={1} />
                      <stop offset="100%" stopColor="#FF6B35" stopOpacity={0.5} />
                    </linearGradient>
                    <linearGradient id="barGradCurrent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFD166" stopOpacity={1} />
                      <stop offset="100%" stopColor="#F5A623" stopOpacity={0.8} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                  <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(245,166,35,0.06)' }}
                    contentStyle={{
                      background: 'rgba(17,17,20,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12,
                      fontSize: 12,
                      backdropFilter: 'blur(16px)',
                    }}
                    labelFormatter={(h) => `${h}:00`}
                    formatter={(v: any, name) => [name === 'revenue' ? money(v) : `${v}`, name === 'revenue' ? 'Revenue' : 'Orders']}
                  />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                    {hourlyPadded.map((_, i) => (
                      <Cell key={i} fill={i === currentHour ? 'url(#barGradCurrent)' : 'url(#barGrad)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-text-primary">Payment Mix</h3>
              <span className="chip"><Activity className="w-3 h-3" /> Live</span>
            </div>
            {paymentBreakdown.length === 0 ? (
              <div className="h-72 flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mb-3">
                  <Activity className="w-7 h-7 text-text-muted" />
                </div>
                <p className="text-text-muted text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-44 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={paymentBreakdown}
                        dataKey="revenue"
                        nameKey="method"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {paymentBreakdown.map((p: any, i: number) => (
                          <Cell key={i} fill={METHOD_META[p.method]?.color || '#F5A623'} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'rgba(17,17,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                        formatter={(v: any) => money(v)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-xs text-text-muted">Total</p>
                    <p className="font-display text-xl font-bold text-text-primary">{money(totalPayments)}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {paymentBreakdown.map((p: any) => {
                    const pct = ((p.revenue / totalPayments) * 100) || 0;
                    const meta = METHOD_META[p.method] || { color: '#F5A623', label: p.method };
                    return (
                      <div key={p.method} className="flex items-center gap-3 text-xs">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                        <span className="flex-1 text-text-secondary">{meta.label}</span>
                        <span className="font-semibold text-text-primary">{money(p.revenue)}</span>
                        <span className="text-text-muted w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Live feed + low stock ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-8">
          <div className="lg:col-span-2 glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-text-primary">Live Order Feed</h3>
                <p className="text-xs text-text-muted mt-0.5">Most recent orders, updated in real time</p>
              </div>
              <span className="chip chip-success"><span className="dot dot-live" /> Live</span>
            </div>
            <div className="space-y-2 max-h-[420px] overflow-y-auto -mr-2 pr-2">
              {recentOrders.length === 0 ? (
                <EmptyState icon={<ShoppingBag className="w-6 h-6" />} label="No orders yet today" sub="They'll appear here the moment a cashier charges a customer." />
              ) : (
                recentOrders.map((o) => {
                  const st = STATUS_META[o.status] || { color: 'text-text-muted', label: o.status };
                  return (
                    <div key={o.id} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-surface-2 transition-colors">
                      <div className="w-12 h-12 rounded-xl bg-primary-soft border border-primary/20 flex flex-col items-center justify-center text-primary flex-shrink-0">
                        <span className="text-[9px] uppercase tracking-wider leading-none">{formatTime(o.createdAt)}</span>
                        <span className="font-display font-bold text-sm mt-0.5">{o.itemCount}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text-primary text-sm truncate">
                          {o.orderNumber} <span className="text-text-muted font-normal">• {String(o.orderType).replace('_', '-')}</span>
                        </p>
                        <p className="text-xs text-text-muted truncate">
                          {o.itemCount} item{o.itemCount !== 1 ? 's' : ''}{o.cashierName && ` • by ${o.cashierName}`}{o.paymentMethod && ` • ${o.paymentMethod}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display font-bold text-base text-text-primary">{money(o.totalAmount)}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${st.color}`}>{st.label}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-secondary" />
                <h3 className="font-display text-lg font-bold text-text-primary">Stock Alerts</h3>
              </div>
              <span className={`chip ${lowStock.length === 0 ? 'chip-success' : 'chip-warn'}`}>{lowStock.length}</span>
            </div>
            <div className="space-y-2 max-h-[360px] overflow-y-auto -mr-2 pr-2">
              {lowStock.length === 0 ? (
                <EmptyState icon={<Package className="w-6 h-6 text-success" />} label="All stocked up" sub="Every item is above its low-stock threshold." />
              ) : (
                lowStock.map((item) => {
                  const isOut = item.quantity <= 0;
                  const pct = Math.min(100, Math.max(0, (item.quantity / (item.threshold * 2)) * 100));
                  return (
                    <div key={item.id} className={`p-3 rounded-xl border ${isOut ? 'bg-danger-soft border-danger/30' : 'bg-secondary-soft border-secondary/30'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-semibold text-text-primary text-sm truncate pr-2">{item.name}</p>
                        <span className={`font-display text-lg font-bold ${isOut ? 'text-danger' : 'text-secondary'}`}>{item.quantity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isOut ? 'bg-danger' : 'bg-secondary'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-text-muted mt-1">Threshold: {item.threshold}</p>
                    </div>
                  );
                })
              )}
            </div>
            <Link to="/inventory" className="mt-4 btn btn-primary w-full">
              <Boxes className="w-4 h-4" /> Manage Inventory
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  tint, Icon, label, value, hint, loading,
}: {
  tint: 'primary' | 'info' | 'success' | 'secondary';
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  loading?: boolean;
}) {
  const tints = {
    primary: { bg: 'from-primary/25 to-transparent', icon: 'text-primary bg-primary-soft border-primary/30', ring: 'amber-glow-soft' },
    info: { bg: 'from-info/25 to-transparent', icon: 'text-info bg-info-soft border-info/30', ring: '' },
    success: { bg: 'from-success/25 to-transparent', icon: 'text-success bg-success-soft border-success/30', ring: '' },
    secondary: { bg: 'from-secondary/25 to-transparent', icon: 'text-secondary bg-secondary-soft border-secondary/30', ring: '' },
  }[tint];
  return (
    <div className={`relative overflow-hidden glass rounded-2xl p-5 group hover-lift ${tints.ring}`}>
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${tints.bg} opacity-60 pointer-events-none`} />
      <div className="relative flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${tints.icon}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      {loading ? (
        <div className="h-9 w-28 shimmer rounded-md" />
      ) : (
        <p className="font-display text-3xl font-bold text-text-primary tabular-nums">{value}</p>
      )}
      {hint && <p className="text-[11px] text-text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

function EmptyState({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10">
      <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center text-text-muted mb-3">
        {icon}
      </div>
      <p className="text-sm font-semibold text-text-secondary">{label}</p>
      {sub && <p className="text-xs text-text-muted mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}
