import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Diamond, Loader2, Mail, Lock, Delete, ShieldCheck, Zap, Clock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/api';

export default function LoginPage() {
  const [mode, setMode] = useState<'staff' | 'pin'>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  useEffect(() => {
    if (mode === 'staff') setTimeout(() => emailRef.current?.focus(), 50);
  }, [mode]);

  const flashError = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await authApi.login(email, password);
      const { token, user } = response.data.data;
      login(user, token);
      navigate('/');
    } catch (err: any) {
      flashError(err.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const submitPin = async (fullPin: string) => {
    if (fullPin.length !== 4) return;
    setError('');
    setLoading(true);
    try {
      const response = await authApi.pinLogin(fullPin);
      const { token, user } = response.data.data;
      login(user, token);
      navigate('/');
    } catch (err: any) {
      flashError(err.response?.data?.message || 'Invalid PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (loading) return;
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) setTimeout(() => submitPin(next), 120);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* ---------- Hero / Brand panel ---------- */}
      <div className="relative lg:w-1/2 min-h-[40vh] lg:min-h-screen overflow-hidden p-8 lg:p-14 flex flex-col justify-between noise">
        <div className="mesh-bg">
          <div className="blob-3" />
        </div>

        <div className="relative z-10 stagger-in">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-14 h-14 rounded-2xl bg-brand flex items-center justify-center amber-glow-soft">
              <Diamond className="w-7 h-7 text-background" fill="currentColor" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display text-4xl lg:text-5xl font-bold text-gradient leading-none">Diamond</h1>
              <p className="font-display text-2xl lg:text-3xl font-semibold text-text-primary leading-none mt-1">Chicken POS</p>
            </div>
          </div>
          <p className="text-text-secondary text-xl lg:text-2xl max-w-md leading-relaxed">
            Serving quality,<br />every single order.
          </p>
        </div>

        <div className="relative z-10 hidden lg:grid grid-cols-3 gap-4 max-w-xl stagger-in">
          <FeaturePill icon={<Zap className="w-4 h-4" />} title="Lightning fast" subtitle="Take orders in seconds" />
          <FeaturePill icon={<ShieldCheck className="w-4 h-4" />} title="ZIMRA compliant" subtitle="Fiscal receipts & Z-Reports" />
          <FeaturePill icon={<Clock className="w-4 h-4" />} title="Real-time kitchen" subtitle="Live order sync" />
        </div>

        <div className="relative z-10 text-xs text-text-muted">
          © 2026 Diamond Chicken • Harare, Zimbabwe
        </div>

        {/* Drifting chicken emoji */}
        <div className="absolute right-[-40px] bottom-[-40px] text-[240px] opacity-[0.06] animate-float select-none pointer-events-none z-0">🍗</div>
      </div>

      {/* ---------- Auth panel ---------- */}
      <div className="relative lg:w-1/2 flex items-center justify-center p-6 lg:p-14">
        <div className={`w-full max-w-md ${shake ? 'animate-bounce-in' : ''}`}>
          <div className="mb-6 flex items-center gap-2 text-xs text-text-muted">
            <span className="dot dot-live" /> System online
          </div>

          <h2 className="font-display text-3xl font-bold text-text-primary mb-1">Welcome back</h2>
          <p className="text-text-secondary mb-8">Sign in to access your dashboard.</p>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 glass rounded-xl mb-6">
            <TabButton active={mode === 'staff'} onClick={() => { setMode('staff'); setError(''); }}>
              <Mail className="w-4 h-4" /> Staff
            </TabButton>
            <TabButton active={mode === 'pin'} onClick={() => { setMode('pin'); setError(''); }}>
              <Lock className="w-4 h-4" /> Cashier PIN
            </TabButton>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-danger-soft border border-danger/30 rounded-xl text-danger text-sm flex items-center gap-2 animate-scale-in">
              <span className="w-2 h-2 rounded-full bg-danger" /> {error}
            </div>
          )}

          {mode === 'staff' ? (
            <form onSubmit={handleStaffLogin} className="space-y-5 animate-fade-in">
              <Field label="Email address" icon={<Mail className="w-4 h-4" />}>
                <input
                  ref={emailRef}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-11"
                  placeholder="admin@diamondchicken.co.zw"
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Password" icon={<Lock className="w-4 h-4" />}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-11"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <button type="submit" disabled={loading} className="btn btn-primary w-full py-4 text-base">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</> : 'Sign In'}
              </button>
              <p className="text-xs text-text-muted text-center pt-2">
                Admins and managers sign in here.
              </p>
            </form>
          ) : (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center">
                <p className="text-sm text-text-secondary mb-5">Enter your 4-digit PIN</p>
                <div className="flex justify-center gap-3 mb-2">
                  {[0, 1, 2, 3].map((i) => {
                    const filled = pin.length > i;
                    return (
                      <div
                        key={i}
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl font-bold transition-all duration-300 ${
                          filled
                            ? 'bg-brand text-background amber-glow scale-105'
                            : 'glass border-border'
                        }`}
                      >
                        {filled ? '●' : ''}
                      </div>
                    );
                  })}
                </div>
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-text-secondary mt-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {['1','2','3','4','5','6','7','8','9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinInput(digit)}
                    className="h-16 glass rounded-2xl font-display text-2xl font-bold text-text-primary hover:bg-primary-soft hover:border-primary/30 active:scale-95 transition-all"
                  >{digit}</button>
                ))}
                <button
                  type="button"
                  onClick={() => { setPin(''); setError(''); }}
                  className="h-16 glass rounded-2xl font-medium text-text-secondary hover:bg-danger-soft hover:text-danger hover:border-danger/30 active:scale-95 transition-all flex items-center justify-center"
                >Clear</button>
                <button
                  type="button"
                  onClick={() => handlePinInput('0')}
                  className="h-16 glass rounded-2xl font-display text-2xl font-bold text-text-primary hover:bg-primary-soft hover:border-primary/30 active:scale-95 transition-all"
                >0</button>
                <button
                  type="button"
                  onClick={() => setPin(pin.slice(0, -1))}
                  className="h-16 glass rounded-2xl font-medium text-text-secondary hover:bg-surface-2 active:scale-95 transition-all flex items-center justify-center"
                  aria-label="Backspace"
                ><Delete className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-text-muted text-center">
                Fast PIN login for cashiers.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 px-4 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
        active ? 'bg-brand text-background amber-glow' : 'text-text-secondary hover:text-text-primary'
      }`}
    >{children}</button>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">{icon}</span>
        {children}
      </div>
    </label>
  );
}

function FeaturePill({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="w-8 h-8 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center text-primary mb-2">
        {icon}
      </div>
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="text-xs text-text-muted mt-0.5">{subtitle}</p>
    </div>
  );
}
