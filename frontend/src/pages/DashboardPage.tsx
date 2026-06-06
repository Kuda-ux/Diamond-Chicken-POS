import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign, ShoppingBag, TrendingUp, Package, AlertTriangle,
  LogOut, Boxes, Diamond, Activity, Flame, Users, Clock, Award, AlertCircle,
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

type Range = 'today' | 'yesterday' | 'week' | 'month';
const RANGES: { key: Range; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
];

export default function DashboardPage() {
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();
  const [range, setRange] = useState<Range>('today');

  useEffect(() => {
    const socket = getSocket();
    joinRoom('managers');
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['stats'] });
    socket.on('order:new', refresh);
    socket.on('order:updated', refresh);
    return () => { socket.off('order:new', refresh); socket.off('order:updated', refresh); };
  }, [queryClient]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['stats', range],
    queryFn: async () => (await statsApi.dashboard({ range })).data.data,
    refetchInterval: 15000,
  });

  const summary = data?.summary || {};
  const hourlyRevenue: any[] = data?.hourlyRevenue || [];
  const paymentBreakdown: any[] = data?.paymentBreakdown || [];
  const cashierBreakdown: any[] = data?.cashierBreakdown || [];
  const topItems: any[] = data?.topItems || [];
  const shifts: any[] = data?.shifts || [];
  const recentOrders: any[] = data?.recentOrders || [];
  const lowStock: any[] = data?.lowStock || [];
  const rangeLabel = data?.range?.label || 'Today';

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
      <header className="sticky top-0 z-30 bg-panel/90 backdrop-blur-lg border-b border-border">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <Diamond className="w-5 h-5 text-background" fill="currentColor" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-base sm:text-xl font-bold text-text-primary leading-none truncate">Diamond Chicken</h1>
              <p className="text-[10px] sm:text-xs text-text-muted mt-1 flex items-center gap-1.5">
                <span className="dot dot-live" /> <span className="hidden sm:inline">Live data • refreshing every 15s</span><span className="sm:hidden">Live</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <div className="hidden md:flex items-center gap-3 px-3 py-2 bg-panel-2 border border-border rounded-xl">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-display font-bold text-background text-sm">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="text-xs">
                <p className="font-semibold text-text-primary leading-none">{user?.name}</p>
                <p className="text-text-muted mt-0.5 capitalize">{user?.role}</p>
              </div>
            </div>
            <Link to="/inventory" className="btn btn-ghost text-xs sm:text-sm">
              <Boxes className="w-4 h-4" /> <span className="hidden sm:inline">Inventory</span>
            </Link>
            {user?.role === 'admin' && (
              <Link to="/users" className="btn btn-ghost text-xs sm:text-sm">
                <Users className="w-4 h-4" /> <span className="hidden sm:inline">Users</span>
              </Link>
            )}
            <button onClick={logout} className="btn btn-ghost text-xs sm:text-sm">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-5">
        {/* ---------- Welcome + Range selector ---------- */}
        <div className="bg-panel rounded-2xl p-5 sm:p-8 border border-border">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
            <div>
              <p className="text-xs sm:text-sm text-text-muted mb-2">Welcome back,</p>
              <h2 className="font-display text-2xl sm:text-4xl font-bold text-text-primary mb-1">{user?.name}</h2>
              <p className="text-sm text-text-secondary">Showing <span className="text-primary font-semibold">{rangeLabel}</span> &mdash; paid sales only.</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wider mb-1">Live time (Harare)</p>
              <p className="font-display text-lg sm:text-2xl font-bold text-primary">
                {new Date().toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border transition-colors ${
                  range === r.key
                    ? 'bg-primary text-background border-primary'
                    : 'bg-panel-2 text-text-secondary border-border hover:border-primary/40'
                }`}
              >
                {r.label}
              </button>
            ))}
            {isFetching && <span className="px-3 py-2 text-[10px] text-text-muted flex items-center gap-1.5"><span className="dot dot-live" /> Refreshing…</span>}
          </div>
        </div>

        {/* ---------- KPI cards ---------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 stagger-in">
          <KpiCard tint="primary" Icon={DollarSign} label={`Revenue (${rangeLabel})`} value={money(summary.totalRevenue)} hint={`VAT: ${money(summary.totalTax)} • ${summary.paidOrders || 0} paid`} loading={isLoading} />
          <KpiCard tint="info" Icon={ShoppingBag} label="Paid Orders" value={`${summary.paidOrders || 0}`} hint={summary.unpaidOrders ? `${summary.unpaidOrders} unpaid pending` : 'All settled'} loading={isLoading} />
          <KpiCard tint="success" Icon={TrendingUp} label="Avg. Order Value" value={money(summary.averageOrderValue)} hint="Per transaction" loading={isLoading} />
          <KpiCard tint="secondary" Icon={Package} label="Items Sold" value={`${summary.totalItems || 0}`} hint="Units moved" loading={isLoading} />
        </div>

        {/* ---------- Outstanding banner (only when there's unpaid revenue) ---------- */}
        {summary.outstandingRevenue > 0 && (
          <div className="bg-danger/10 border border-danger/30 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-text-primary text-sm">{money(summary.outstandingRevenue)} outstanding</p>
              <p className="text-xs text-text-muted mt-0.5">{summary.unpaidOrders} order(s) created but not yet paid for. These are excluded from revenue above.</p>
            </div>
          </div>
        )}

        {/* ---------- Charts ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-panel border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Revenue by Hour</h3>
                <p className="text-xs text-text-muted mt-0.5">Live throughout the day</p>
              </div>
              <span className="chip chip-primary"><Flame className="w-3 h-3" /> Today</span>
            </div>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyPadded} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                  <XAxis dataKey="hour" stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} interval={1} />
                  <YAxis stroke="#52525B" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    cursor={{ fill: 'rgba(245,166,35,0.06)' }}
                    contentStyle={{ background: '#18181F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }}
                    labelFormatter={(h) => `${h}:00`}
                    formatter={(v: any, name) => [name === 'revenue' ? money(v) : `${v}`, name === 'revenue' ? 'Revenue' : 'Orders']}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {hourlyPadded.map((_, i) => (
                      <Cell key={i} fill={i === currentHour ? '#FFB949' : '#F5A623'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-panel border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Payment Mix</h3>
              <span className="chip"><Activity className="w-3 h-3" /> Live</span>
            </div>
            {paymentBreakdown.length === 0 ? (
              <div className="h-56 sm:h-72 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-panel-2 flex items-center justify-center mb-3 border border-border">
                  <Activity className="w-6 h-6 text-text-muted" />
                </div>
                <p className="text-text-muted text-sm">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="h-40 sm:h-44 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentBreakdown} dataKey="revenue" nameKey="method" cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} stroke="none">
                        {paymentBreakdown.map((p: any, i: number) => (
                          <Cell key={i} fill={METHOD_META[p.method]?.color || '#F5A623'} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#18181F', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} formatter={(v: any) => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-xs text-text-muted">Total</p>
                    <p className="font-display text-lg sm:text-xl font-bold text-text-primary">{money(totalPayments)}</p>
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
                        <span className="font-semibold text-text-primary tabular-nums">{money(p.revenue)}</span>
                        <span className="text-text-muted w-10 text-right tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Cashiers + Shifts ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Per-cashier performance */}
          <div className="bg-panel border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-primary" />
                <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Cashier Performance</h3>
              </div>
              <span className="chip">{cashierBreakdown.length} active</span>
            </div>
            {cashierBreakdown.length === 0 ? (
              <EmptyState icon={<Users className="w-6 h-6" />} label="No sales yet" sub="Cashiers' totals appear here as they ring up customers." />
            ) : (
              <div className="space-y-3">
                {cashierBreakdown.map((c, i) => {
                  const max = Math.max(...cashierBreakdown.map((x) => x.revenue || 0)) || 1;
                  const pct = ((c.revenue || 0) / max) * 100;
                  return (
                    <div key={c.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${i === 0 ? 'bg-primary text-background' : 'bg-panel-2 text-text-secondary border border-border'}`}>{i + 1}</span>
                          <span className="font-semibold text-text-primary truncate">{c.name}</span>
                          <span className="text-[10px] text-text-muted uppercase tracking-wider">{c.role}</span>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-display font-bold text-text-primary tabular-nums">{money(c.revenue)}</p>
                          <p className="text-[10px] text-text-muted">{c.orders} order(s) • avg {money(c.averageOrder)}</p>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Shifts */}
          <div className="bg-panel border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-info" />
                <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Shifts</h3>
              </div>
              <span className="chip">{shifts.length}</span>
            </div>
            {shifts.length === 0 ? (
              <EmptyState icon={<Clock className="w-6 h-6" />} label="No shifts in this window" sub="When a cashier opens their till, it appears here." />
            ) : (
              <div className="space-y-2 max-h-[360px] overflow-y-auto -mr-2 pr-2">
                {shifts.map((s) => {
                  const isOpen = !s.endedAt;
                  const expectedCash = (s.openingFloat || 0) + (s.cashRevenue || 0);
                  const variance = s.closingFloat != null ? s.closingFloat - expectedCash : null;
                  return (
                    <div key={s.id} className={`p-3 rounded-xl border ${isOpen ? 'bg-success/5 border-success/30' : 'bg-panel-2 border-border'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`dot ${isOpen ? 'dot-live' : ''}`} style={!isOpen ? { background: '#52525B' } : undefined} />
                          <span className="font-semibold text-text-primary text-sm truncate">{s.cashierName}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isOpen ? 'bg-success/20 text-success' : 'bg-panel text-text-muted'}`}>{isOpen ? 'Open' : 'Closed'}</span>
                        </div>
                        <span className="font-display font-bold text-text-primary tabular-nums text-sm">{money(s.totalRevenue)}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-[10px] text-text-muted">
                        <span><span className="block text-text-secondary font-semibold">{s.transactionCount}</span>orders</span>
                        <span><span className="block text-text-secondary font-semibold tabular-nums">{money(s.openingFloat)}</span>float</span>
                        <span><span className="block text-text-secondary font-semibold tabular-nums">{money(s.cashRevenue)}</span>cash sales</span>
                        {variance != null ? (
                          <span><span className={`block font-semibold tabular-nums ${variance < 0 ? 'text-danger' : variance > 0 ? 'text-secondary' : 'text-success'}`}>{variance >= 0 ? '+' : ''}{money(variance)}</span>variance</span>
                        ) : (
                          <span><span className="block text-text-secondary font-semibold tabular-nums">{money(expectedCash)}</span>expected</span>
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted mt-1.5">
                        {new Date(s.startedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' })} → {s.endedAt ? new Date(s.endedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Harare' }) : 'now'}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ---------- Top items ---------- */}
        {topItems.length > 0 && (
          <div className="bg-panel border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-secondary" />
                <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Top Sellers</h3>
              </div>
              <span className="text-xs text-text-muted">{rangeLabel}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {topItems.map((t, i) => (
                <div key={t.id} className="p-3 rounded-xl bg-panel-2 border border-border">
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">#{i + 1}</p>
                  <p className="font-semibold text-text-primary text-sm leading-tight mt-1 line-clamp-2">{t.name}</p>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="font-display text-xl font-bold text-primary tabular-nums">{t.unitsSold}</span>
                    <span className="text-[11px] text-text-muted">{money(t.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Live feed + low stock ---------- */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pb-6">
          <div className="lg:col-span-2 bg-panel border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Live Order Feed</h3>
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
                    <div key={o.id} className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl hover:bg-panel-2 transition-colors">
                      <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary/10 border border-primary/25 flex flex-col items-center justify-center text-primary flex-shrink-0">
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
                      <div className="text-right flex-shrink-0">
                        <p className="font-display font-bold text-sm sm:text-base text-text-primary tabular-nums">{money(o.totalAmount)}</p>
                        <p className={`text-[10px] font-bold uppercase tracking-wider ${st.color}`}>{st.label}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="bg-panel border border-border rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-secondary" />
                <h3 className="font-display text-base sm:text-lg font-bold text-text-primary">Stock Alerts</h3>
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
                    <div key={item.id} className={`p-3 rounded-xl border ${isOut ? 'bg-danger/10 border-danger/30' : 'bg-secondary/10 border-secondary/30'}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-semibold text-text-primary text-sm truncate pr-2">{item.name}</p>
                        <span className={`font-display text-lg font-bold tabular-nums ${isOut ? 'text-danger' : 'text-secondary'}`}>{item.quantity}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${isOut ? 'bg-danger' : 'bg-secondary'}`} style={{ width: `${pct}%` }} />
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
  label: string; value: string; hint?: string; loading?: boolean;
}) {
  const tints = {
    primary: 'text-primary bg-primary/10 border-primary/25',
    info: 'text-info bg-info/10 border-info/25',
    success: 'text-success bg-success/10 border-success/25',
    secondary: 'text-secondary bg-secondary/10 border-secondary/25',
  }[tint];
  return (
    <div className="bg-panel border border-border rounded-2xl p-4 sm:p-5 hover-lift transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center border ${tints}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <p className="text-[10px] sm:text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      {loading ? <div className="h-8 w-24 shimmer" />
        : <p className="font-display text-2xl sm:text-3xl font-bold text-text-primary tabular-nums">{value}</p>}
      {hint && <p className="text-[10px] sm:text-[11px] text-text-muted mt-1.5">{hint}</p>}
    </div>
  );
}

function EmptyState({ icon, label, sub }: { icon: React.ReactNode; label: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-10 px-4">
      <div className="w-14 h-14 rounded-full bg-panel-2 flex items-center justify-center text-text-muted mb-3 border border-border">{icon}</div>
      <p className="text-sm font-semibold text-text-secondary">{label}</p>
      {sub && <p className="text-xs text-text-muted mt-1 max-w-xs">{sub}</p>}
    </div>
  );
}
