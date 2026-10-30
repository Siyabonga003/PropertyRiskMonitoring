import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Lock, Mail, ArrowRight, ShieldCheck, Flame, Droplets, Activity } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-emerald-400 p-0.5 shadow-xl shadow-rose-950/50 mb-4">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-rose-500" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">RiskGuard</h1>
          <p className="text-sm text-slate-400 mt-1">IoT Real-Time Property Risk & Hazard Monitoring</p>
        </div>

        {/* Login Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl backdrop-blur-xl">
          <h2 className="text-lg font-bold text-white mb-1">Mission Control Sign In</h2>
          <p className="text-xs text-slate-400 mb-6">
            Access live sensor streams, hazard dispatch, and security arming controls
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Operator Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-rose-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-sm tracking-wide transition-all shadow-lg shadow-rose-950/60 flex items-center justify-center gap-2"
            >
              <span>{isLoading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Reviewer One-Click Demo Login */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-3">
              Fast Reviewer Access (1-Click Demo)
            </div>

            <button
              onClick={() => handleDemo('ADMIN')}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Explore as Administrator (`admin@example.com`)</span>
            </button>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => handleDemo('MANAGER')}
                className="py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-xs transition-colors text-center"
              >
                Manager Demo
              </button>
              <button
                onClick={() => handleDemo('VIEWER')}
                className="py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium text-xs transition-colors text-center"
              >
                Viewer Demo
              </button>
            </div>
          </div>
        </div>

        {/* Features footer badges */}
        <div className="mt-8 grid grid-cols-3 gap-3 text-center text-slate-500 text-xs">
          <div className="flex flex-col items-center">
            <Flame className="w-4 h-4 text-rose-500 mb-1" />
            <span>Smoke Detection</span>
          </div>
          <div className="flex flex-col items-center">
            <Droplets className="w-4 h-4 text-cyan-500 mb-1" />
            <span>Water Leak Alert</span>
          </div>
          <div className="flex flex-col items-center">
            <Activity className="w-4 h-4 text-amber-500 mb-1" />
            <span>PIR Security</span>
          </div>
        </div>
      </div>
    </div>
  );
};
