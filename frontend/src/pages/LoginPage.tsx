import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Diamond, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../services/api';

export default function LoginPage() {
  const [mode, setMode] = useState<'staff' | 'pin'>('staff');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuthStore();

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
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;

    setError('');
    setLoading(true);

    try {
      const response = await authApi.pinLogin(pin);
      const { token, user } = response.data.data;
      login(user, token);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      setPin(pin + digit);
    }
  };

  const handlePinBackspace = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <div className="min-h-screen flex">
      <div className="w-1/2 bg-gradient-to-br from-surface via-surface-2 to-background relative overflow-hidden p-12 flex flex-col justify-between">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <Diamond className="w-12 h-12 text-primary" fill="currentColor" />
            <h1 className="font-display text-4xl font-bold text-gradient">Diamond Chicken</h1>
          </div>
          <p className="text-text-secondary text-xl">Serving Quality, Every Order</p>
        </div>

        <div className="relative z-10 space-y-4 text-text-muted">
          <p className="text-sm">Powered by Diamond POS</p>
          <p className="text-xs">© 2026 Diamond Chicken. All rights reserved.</p>
        </div>

        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <div className="text-9xl animate-float">🍗</div>
        </div>
      </div>

      <div className="w-1/2 bg-background flex items-center justify-center p-12">
        <div className="w-full max-w-md space-y-8">
          <div className="flex gap-2 p-1 glass rounded-xl">
            <button
              onClick={() => setMode('staff')}
              className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                mode === 'staff'
                  ? 'bg-primary text-background amber-glow'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Staff Login
            </button>
            <button
              onClick={() => setMode('pin')}
              className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all ${
                mode === 'pin'
                  ? 'bg-primary text-background amber-glow'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Cashier PIN
            </button>
          </div>

          {error && (
            <div className="p-4 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
              {error}
            </div>
          )}

          {mode === 'staff' ? (
            <form onSubmit={handleStaffLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
                  placeholder="admin@diamondchicken.co.zw"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-text-primary"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-primary text-background font-display font-bold text-lg rounded-lg hover:bg-primary/90 transition-all amber-glow disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePinLogin} className="space-y-8">
              <div className="text-center">
                <p className="text-text-secondary mb-4">Enter your 4-digit PIN</p>
                <div className="flex justify-center gap-3 mb-8">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${
                        pin.length > i
                          ? 'bg-primary text-background'
                          : 'bg-surface border border-border'
                      }`}
                    >
                      {pin.length > i ? '•' : ''}
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handlePinInput(digit.toString())}
                    className="h-20 glass rounded-xl font-display text-2xl font-bold hover:bg-primary/10 transition-all active:scale-95"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handlePinBackspace}
                  className="h-20 glass rounded-xl font-medium hover:bg-danger/10 transition-all active:scale-95"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => handlePinInput('0')}
                  className="h-20 glass rounded-xl font-display text-2xl font-bold hover:bg-primary/10 transition-all active:scale-95"
                >
                  0
                </button>
                <button
                  type="submit"
                  disabled={pin.length !== 4 || loading}
                  className="h-20 bg-primary text-background rounded-xl font-bold hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : '✓'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
