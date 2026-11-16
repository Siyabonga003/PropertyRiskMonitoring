import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Mail, ShieldCheck, Flame, Droplets, Activity } from 'lucide-react';
import { BrandMark } from '../components/common/BrandMark';

export const Login: React.FC = () => {
  const { login, demoLogin, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email || !password) {
      setError('Please provide email and password.');
      return;
    }
    const success = await login(email, password);
    if (!success) {
      setError('Authentication failed. Check credentials or use Demo Login.');
    }
  };

  const handleDemo = async (role: 'ADMIN' | 'MANAGER' | 'VIEWER') => {
    setError(null);
    await demoLogin(role);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-navy-900">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-8">
          <BrandMark className="w-14 h-14 mb-4" />
          <h1 className="text-3xl font-semibold tracking-tight text-white">RiskGuard</h1>
          <p className="text-sm text-haze mt-1">Real-time property risk and hazard monitoring</p>
        </div>

        {/* Sign-in card */}
        <div className="card p-7">
          <h2 className="text-lg font-semibold">Sign in</h2>
          <p className="text-sm text-ink-muted mt-0.5 mb-6">
            Access live sensor data, hazard alerts, and arming controls.
          </p>

          {error && (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-status-critical/30 bg-status-critical-soft px-3 py-2.5 text-sm font-medium text-[#A3162B]"
            >
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="field-label">
                Email address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="field pl-9"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="field-label">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field pl-9"
                />
              </div>
            </div>

            <button type="submit" disabled={isLoading} className="btn-primary w-full py-2.5">
              {isLoading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* One-click demo access */}
          <div className="mt-6 pt-6 border-t border-line">
            <div className="text-sm font-medium text-center text-ink-muted mb-3">Or try a demo account</div>

            <button onClick={() => handleDemo('ADMIN')} className="btn-outline w-full">
              <ShieldCheck className="w-4 h-4" />
              <span>Explore as Administrator</span>
            </button>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button onClick={() => handleDemo('MANAGER')} className="btn-outline">
                Manager
              </button>
              <button onClick={() => handleDemo('VIEWER')} className="btn-outline">
                Viewer
              </button>
            </div>
          </div>
        </div>

        {/* What the system watches */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-haze text-sm">
          <div className="flex flex-col items-center gap-1.5">
            <Flame className="w-5 h-5 text-white" />
            <span>Smoke detection</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Droplets className="w-5 h-5 text-white" />
            <span>Water leak alerts</span>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <Activity className="w-5 h-5 text-white" />
            <span>Motion security</span>
          </div>
        </div>
      </div>
    </div>
  );
};
