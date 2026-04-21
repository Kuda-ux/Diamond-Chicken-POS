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
    setError(''); setLoading(true);
    try {
      const response = await authApi.login(email, password);
      const { token, user } = response.data.data;
      login(user, token);
      navigate('/');
    } catch (err: any) {
      flashError(err.response?.data?.message || 'Invalid credentials');
    } finally { setLoading(false); }
  };

  const submitPin = async (fullPin: string) => {
    if (fullPin.length !== 4) return;
    setError(''); setLoading(true);
    try {
      const response = await authApi.pinLogin(fullPin);
      const { token, user } = response.data.data;
      login(user, token);
      navigate('/');
    } catch (err: any) {
      flashError(err.response?.data?.message || 'Invalid PIN');
      setPin('');
    } finally { setLoading(false); }
  };

  const handlePinInput = (digit: string) => {
    if (loading) return;
    if (pin.length < 4) {
      const next = pin + digit;
      setPin(next);
      if (next.length === 4) setTimeout(() => submitPin(next), 100);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ---------- Brand panel ---------- */}
      <div className="relative lg:w-1/2 min-h-[30vh] lg:min-h-screen overflow-hidden px-6 py-10 sm:px-10 lg:p-14 flex flex-col justify-between bg-panel border-b lg:border-b-0 lg:border-r border-border">
        {/* Subtle single-color accent corner */}
        <div className="absolute -left-20 -top-20 w-80 h-80 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
        <div className="absolute right-0 bottom-0 text-[180px] sm:text-[220px] opacity-[0.04] select-none pointer-events-none leading-none">🍗</div>

        <div className="relative z-10 stagger-in">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Diamond className="w-6 h-6 text-background" fill="currentColor" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-text-primary leading-none">Diamond Chicken</h1>
              <p className="text-xs sm:text-sm text-text-muted mt-1">Point of Sale System</p>
            </div>
          </div>
          <p className="text-text-secondary text-base sm:text-lg max-w-md leading-relaxed">
            Serving quality — every single order.
          </p>
        </div>

        <div className="relative z-10 hidden lg:grid grid-cols-3 gap-3 max-w-xl stagger-in">
          <FeaturePill icon={<Zap className="w-4 h-4" />} title="Lightning fast" subtitle="Seconds per order" />
          <FeaturePill icon={<ShieldCheck className="w-4 h-4" />} title="ZIMRA compliant" subtitle="Fiscal Z-Reports" />
          <FeaturePill icon={<Clock className="w-4 h-4" />} title="Real-time sync" subtitle="Live kitchen display" />
        </div>

        <div className="relative z-10 text-xs text-text-muted mt-4 lg:mt-0">
          © 2026 Diamond Chicken • Harare, Zimbabwe
        </div>
      </div>

      {/* ---------- Auth panel ---------- */}
      <div className="relative lg:w-1/2 flex items-center justify-center px-6 py-10 sm:p-10 lg:p-14 bg-background">
        <div className={`w-full max-w-md ${shake ? 'animate-bounce-in' : ''}`}>
          <div className="mb-4 flex items-center gap-2 text-xs text-text-muted">
            <span className="dot dot-live" /> System online
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-bold text-text-primary mb-1">Welcome back</h2>
          <p className="text-sm text-text-secondary mb-6">Sign in to continue.</p>

          {/* Mode tabs */}
          <div className="flex gap-1 p-1 bg-panel rounded-xl mb-5 border border-border">
            <TabButton active={mode === 'staff'} onClick={() => { setMode('staff'); setError(''); }}>
              <Mail className="w-4 h-4" /> Staff
            </TabButton>
            <TabButton active={mode === 'pin'} onClick={() => { setMode('pin'); setError(''); }}>
              <Lock className="w-4 h-4" /> Cashier / Kitchen PIN
            </TabButton>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-danger/10 border border-danger/30 rounded-xl text-danger text-sm flex items-center gap-2 animate-scale-in">
              <span className="w-2 h-2 rounded-full bg-danger flex-shrink-0" /> {error}
            </div>
          )}

          {mode === 'staff' ? (
            <form onSubmit={handleStaffLogin} className="space-y-4 animate-fade-in">
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
              <button type="submit" disabled={loading} className="btn btn-primary w-full py-3.5 text-base">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Signing in…</> : 'Sign In'}
              </button>
              <p className="text-xs text-text-muted text-center pt-1">
                Admins and managers sign in here.
              </p>
            </form>
          ) : (
            <div className="space-y-5 animate-fade-in">
              <div className="text-center">
                <p className="text-sm text-text-secondary mb-4">Enter your 4-digit PIN</p>
                <div className="flex justify-center gap-3 mb-2">
                  {[0, 1, 2, 3].map((i) => {
                    const filled = pin.length > i;
                    return (
                      <div
                        key={i}
                        className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl font-bold transition-all duration-200 ${
                          filled ? 'bg-primary text-background border border-primary' : 'bg-panel border border-border'
                        }`}
                      >
                        {filled ? '●' : ''}
                      </div>
                    );
                  })}
                </div>
                {loading && (
                  <div className="flex items-center justify-center gap-2 text-xs text-text-secondary mt-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying…
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                {['1','2','3','4','5','6','7','8','9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinInput(digit)}
                    className="h-14 sm:h-16 bg-panel border border-border rounded-2xl font-display text-2xl font-bold text-text-primary hover:border-primary/40 hover:bg-panel-2 active:scale-95 transition-all"
                  >{digit}</button>
                ))}
                <button
                  type="button"
                  onClick={() => { setPin(''); setError(''); }}
                  className="h-14 sm:h-16 bg-panel border border-border rounded-2xl font-semibold text-sm text-text-secondary hover:border-danger/40 hover:text-danger active:scale-95 transition-all"
                >Clear</button>
                <button
                  type="button"
                  onClick={() => handlePinInput('0')}
                  className="h-14 sm:h-16 bg-panel border border-border rounded-2xl font-display text-2xl font-bold text-text-primary hover:border-primary/40 hover:bg-panel-2 active:scale-95 transition-all"
                >0</button>
                <button
                  type="button"
                  onClick={() => setPin(pin.slice(0, -1))}
                  className="h-14 sm:h-16 bg-panel border border-border rounded-2xl text-text-secondary hover:bg-panel-2 active:scale-95 transition-all flex items-center justify-center"
                  aria-label="Backspace"
                ><Delete className="w-5 h-5" /></button>
              </div>

              {/* PIN hints (helpful for staff) */}
              <div className="pt-2 border-t border-border">
                <p className="text-[10px] uppercase tracking-wider font-bold text-text-muted mb-2">Default PINs</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <HintChip role="Cashier" pin="1234" />
                  <HintChip role="Cashier" pin="5678" />
                  <HintChip role="Kitchen" pin="9999" />
                </div>
              </div>
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
      className={`flex-1 py-2.5 px-3 rounded-lg font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
        active ? 'bg-primary text-background' : 'text-text-secondary hover:text-text-primary'
      }`}
    >{children}</button>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wider">{label}</span>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none z-10">{icon}</span>
        {children}
      </div>
    </label>
  );
}

function FeaturePill({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="bg-panel rounded-xl p-3 border border-border">
      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-2">
        {icon}
      </div>
      <p className="text-xs font-semibold text-text-primary">{title}</p>
      <p className="text-[10px] text-text-muted mt-0.5">{subtitle}</p>
    </div>
  );
}

function HintChip({ role, pin }: { role: string; pin: string }) {
  return (
    <div className="bg-panel border border-border rounded-lg px-2 py-1.5">
      <p className="text-[9px] uppercase text-text-muted tracking-wider font-semibold">{role}</p>
      <p className="font-mono font-bold text-sm text-text-primary tabular-nums">{pin}</p>
    </div>
  );
}
