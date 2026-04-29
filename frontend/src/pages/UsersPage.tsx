import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, UserPlus, Mail, Lock, Shield, ChefHat, Users as UsersIcon,
  X, Save, Edit3, Power, Trash2, Search, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { usersApi } from '../services/api';
import { useAuthStore } from '../stores/authStore';

type Role = 'admin' | 'manager' | 'cashier' | 'kitchen';

interface User {
  id: string;
  name: string;
  email?: string;
  role: Role;
  isActive: boolean;
  hasPin: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

const ROLE_META: Record<Role, { label: string; icon: any; color: string }> = {
  admin: { label: 'Admin', icon: Shield, color: 'text-danger' },
  manager: { label: 'Manager', icon: Shield, color: 'text-primary' },
  cashier: { label: 'Cashier', icon: UsersIcon, color: 'text-info' },
  kitchen: { label: 'Kitchen', icon: ChefHat, color: 'text-secondary' },
};

export default function UsersPage() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | Role>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Admin gate
  if (currentUser?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await usersApi.list()).data.data as User[],
  });

  const remove = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      flash('success', 'User deactivated');
    },
    onError: (e: any) => flash('error', e.response?.data?.message || 'Failed to deactivate'),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => usersApi.update(id, { isActive: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      flash('success', 'User reactivated');
    },
    onError: (e: any) => flash('error', e.response?.data?.message || 'Failed to reactivate'),
  });

  const flash = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = (users || []).filter((u) => {
    if (!showInactive && !u.isActive) return false;
    if (filter !== 'all' && u.role !== filter) return false;
    const q = search.toLowerCase();
    if (q && !u.name.toLowerCase().includes(q) && !(u.email || '').toLowerCase().includes(q)) return false;
    return true;
  });

  const stats = {
    total: users?.length || 0,
    active: users?.filter((u) => u.isActive).length || 0,
    admin: users?.filter((u) => u.role === 'admin' && u.isActive).length || 0,
  };

  return (
    <div className="min-h-screen">
      {toast && (
        <div className="fixed top-20 right-4 sm:right-6 z-50 animate-slide-up">
          <div className={`px-4 py-3 rounded-xl border flex items-center gap-3 shadow-xl ${
            toast.type === 'success' ? 'bg-success/15 border-success/30 text-success' : 'bg-danger/15 border-danger/30 text-danger'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span className="text-sm font-semibold">{toast.msg}</span>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-panel/90 backdrop-blur-lg border-b border-border">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-panel-2 border border-border flex items-center justify-center flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
              <UsersIcon className="w-5 h-5 text-background" />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl font-bold text-text-primary leading-none truncate">User Management</h1>
              <p className="text-[10px] sm:text-xs text-text-muted mt-1">Add, edit, deactivate staff accounts</p>
            </div>
          </div>
          <button onClick={() => setCreating(true)} className="btn btn-primary text-xs sm:text-sm">
            <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">New User</span>
          </button>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto p-4 sm:p-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 stagger-in">
          <StatCard label="Total users" value={stats.total} Icon={UsersIcon} tint="default" />
          <StatCard label="Active" value={stats.active} Icon={CheckCircle2} tint="success" />
          <StatCard label="Admins" value={stats.admin} Icon={Shield} tint="danger" />
        </div>

        {/* Filters */}
        <div className="bg-panel border border-border rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="input pl-11"
            />
          </div>
          <div className="flex gap-1 bg-panel-2 border border-border rounded-xl p-1">
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>All</FilterChip>
            <FilterChip active={filter === 'admin'} onClick={() => setFilter('admin')}>Admins</FilterChip>
            <FilterChip active={filter === 'manager'} onClick={() => setFilter('manager')}>Managers</FilterChip>
            <FilterChip active={filter === 'cashier'} onClick={() => setFilter('cashier')}>Cashiers</FilterChip>
            <FilterChip active={filter === 'kitchen'} onClick={() => setFilter('kitchen')}>Kitchen</FilterChip>
          </div>
          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none">
            <input
              type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            Show inactive
          </label>
        </div>

        {/* Users table */}
        <div className="bg-panel border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead className="bg-panel-2 text-text-muted text-[10px] uppercase tracking-wider font-bold">
                <tr>
                  <th className="text-left px-5 py-3">User</th>
                  <th className="text-left px-5 py-3 hidden md:table-cell">Email / Login</th>
                  <th className="text-left px-5 py-3">Role</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-right px-5 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={5} className="text-center py-16 text-text-muted">Loading users…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-16 text-text-muted">No users match your filters</td></tr>
                ) : (
                  filtered.map((u) => {
                    const meta = ROLE_META[u.role];
                    const RoleIcon = meta.icon;
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <tr key={u.id} className="border-t border-border hover:bg-panel-2 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary text-background flex items-center justify-center font-display font-bold text-sm flex-shrink-0">
                              {u.name?.[0]?.toUpperCase() || 'U'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-text-primary truncate">
                                {u.name} {isSelf && <span className="text-[10px] text-primary ml-1">(you)</span>}
                              </p>
                              <p className="text-xs text-text-muted md:hidden truncate">{u.email || (u.hasPin ? 'PIN login' : '—')}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          {u.email ? (
                            <span className="text-sm text-text-secondary flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-text-muted" /> {u.email}</span>
                          ) : u.hasPin ? (
                            <span className="text-sm text-text-secondary flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-text-muted" /> PIN login</span>
                          ) : (
                            <span className="text-xs text-text-muted">No login set</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${meta.color}`}>
                            <RoleIcon className="w-3.5 h-3.5" /> {meta.label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          {u.isActive
                            ? <span className="chip chip-success">Active</span>
                            : <span className="chip chip-danger">Inactive</span>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => setEditing(u)}
                              className="w-9 h-9 rounded-lg hover:bg-primary/15 hover:text-primary flex items-center justify-center text-text-muted"
                              title="Edit user"
                            ><Edit3 className="w-4 h-4" /></button>
                            {u.isActive ? (
                              <button
                                disabled={isSelf || remove.isPending}
                                onClick={() => {
                                  if (window.confirm(`Deactivate ${u.name}? They will no longer be able to log in.`)) {
                                    remove.mutate(u.id);
                                  }
                                }}
                                className="w-9 h-9 rounded-lg hover:bg-danger/15 hover:text-danger flex items-center justify-center text-text-muted disabled:opacity-30 disabled:cursor-not-allowed"
                                title={isSelf ? "You can't deactivate yourself" : "Deactivate"}
                              ><Trash2 className="w-4 h-4" /></button>
                            ) : (
                              <button
                                disabled={reactivate.isPending}
                                onClick={() => reactivate.mutate(u.id)}
                                className="w-9 h-9 rounded-lg hover:bg-success/15 hover:text-success flex items-center justify-center text-text-muted"
                                title="Reactivate"
                              ><Power className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {creating && <UserFormModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); flash('success', 'User created'); }} />}
      {editing && <UserFormModal user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); flash('success', 'User updated'); }} />}
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        active ? 'bg-primary text-background' : 'text-text-secondary hover:text-text-primary'
      }`}
    >{children}</button>
  );
}

function StatCard({ label, value, Icon, tint }: { label: string; value: number; Icon: any; tint: 'default' | 'success' | 'danger' }) {
  const t = { default: 'text-text-primary border-border', success: 'text-success border-success/30', danger: 'text-danger border-danger/30' }[tint];
  return (
    <div className="bg-panel border border-border rounded-2xl p-4 flex items-center justify-between">
      <div>
        <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
        <p className="font-display text-2xl sm:text-3xl font-bold text-text-primary tabular-nums">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-lg bg-panel-2 border flex items-center justify-center ${t}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
  );
}

/* ----------------------- User Form Modal ----------------------- */
function UserFormModal({ user, onClose, onSaved }: { user?: User; onClose: () => void; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const isEdit = !!user;
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState<Role>(user?.role || 'cashier');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const needsPassword = role === 'admin' || role === 'manager';
  const needsPin = role === 'cashier' || role === 'kitchen';

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Name is required');
      if (needsPassword && !email) throw new Error('Email is required for admin/manager');
      if (!isEdit) {
        if (needsPassword && (!password || password.length < 6)) throw new Error('Password must be at least 6 characters');
        if (needsPin && !/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
      } else {
        if (password && password.length < 6) throw new Error('Password must be at least 6 characters');
        if (pin && !/^\d{4}$/.test(pin)) throw new Error('PIN must be exactly 4 digits');
      }
      if (isEdit) {
        return usersApi.update(user!.id, {
          name: name.trim(),
          email: email || undefined,
          role,
          password: password || undefined,
          pin: pin || undefined,
        });
      }
      return usersApi.create({
        name: name.trim(),
        email: email || undefined,
        role,
        password: needsPassword ? password : undefined,
        pin: needsPin ? pin : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onSaved();
    },
    onError: (e: any) => {
      setError(e.response?.data?.message || e.message || 'Failed to save');
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in">
      <div className="w-full max-w-lg bg-panel border border-border rounded-2xl shadow-2xl overflow-hidden animate-scale-in max-h-[95vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              {isEdit ? <Edit3 className="w-5 h-5 text-primary" /> : <UserPlus className="w-5 h-5 text-primary" />}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-text-primary">{isEdit ? 'Edit User' : 'New User'}</h2>
              <p className="text-xs text-text-muted">{isEdit ? user!.name : 'Create a new staff account'}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-panel-2 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Full name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tendai Moyo" className="input" autoFocus />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Role</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(ROLE_META) as Role[]).map((r) => {
                const meta = ROLE_META[r];
                const Icon = meta.icon;
                const active = role === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      active ? 'bg-primary/10 border-primary' : 'bg-panel-2 border-border hover:border-border'
                    }`}
                  >
                    <Icon className={`w-4 h-4 mb-1.5 ${active ? 'text-primary' : meta.color}`} />
                    <p className={`text-xs font-bold ${active ? 'text-primary' : 'text-text-primary'}`}>{meta.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {needsPassword && (
            <>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
                  <input
                    type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@diamondchicken.co.zw"
                    className="input pl-11"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                  {isEdit ? 'New password (leave blank to keep current)' : 'Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none z-10" />
                  <input
                    type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEdit ? '••••••••' : 'Min 6 characters'}
                    className="input pl-11"
                  />
                </div>
              </div>
            </>
          )}

          {needsPin && (
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">
                {isEdit ? 'New PIN (leave blank to keep current)' : '4-digit PIN'}
              </label>
              <input
                type="text" inputMode="numeric" maxLength={4} pattern="\d{4}"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder={isEdit ? '••••' : 'e.g. 1234'}
                className="input font-mono text-center text-2xl tracking-[0.5em] py-4"
              />
              <p className="text-[10px] text-text-muted mt-1.5">Must be unique among all active staff PINs.</p>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-danger/10 border border-danger/30 text-danger text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button onClick={onClose} disabled={save.isPending} className="btn btn-ghost flex-1">Cancel</button>
          <button
            onClick={() => { setError(''); save.mutate(); }}
            disabled={save.isPending}
            className="btn btn-primary flex-[2]"
          >
            <Save className="w-4 h-4" /> {save.isPending ? 'Saving…' : (isEdit ? 'Save Changes' : 'Create User')}
          </button>
        </div>
      </div>
    </div>
  );
}
