import React, { useState, useEffect } from 'react';
import { ShieldAlert, Flame, Droplets, Volume2, VolumeX, Building2, UserCircle, LogOut } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { StatusIndicator } from '../common/StatusIndicator';
import { soundAlert } from '../../services/soundAlert';

interface Props {
  onOpenSettings: () => void;
}

export const Navbar: React.FC<Props> = ({ onOpenSettings }) => {
  const { connectionState, properties, currentProperty, setCurrentProperty, activeCriticalCount } = useSocket();
  const { user, logout, demoLogin } = useAuth();

  const [isMuted, setIsMuted] = useState(soundAlert.isMuted());
  const [isSirenActive, setIsSirenActive] = useState(soundAlert.getIsPlaying());

  useEffect(() => {
    const unsubscribe = soundAlert.subscribe((muted, playing) => {
      setIsMuted(muted);
      setIsSirenActive(playing);
    });
    return () => unsubscribe();
  }, []);

  const handleToggleMute = () => {
    const newMuted = soundAlert.toggleMute();
    setIsMuted(newMuted);
    if (!newMuted) {
      soundAlert.playTestBeep();
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-amber-500 to-emerald-400 p-0.5 shadow-lg shadow-rose-900/30">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                  RiskGuard
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                  IoT Real-Time
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span className="flex items-center gap-0.5 text-rose-400">
                  <Flame className="w-3 h-3 inline" /> Fire
                </span>
                <span>•</span>
                <span className="flex items-center gap-0.5 text-cyan-400">
                  <Droplets className="w-3 h-3 inline" /> Water
                </span>
                <span>•</span>
                <span className="text-amber-400">Intrusion</span>
              </div>
            </div>
          </div>

          {/* Center: Property Selector */}
          <div className="hidden md:flex items-center bg-slate-800/70 border border-slate-700/60 rounded-lg px-3 py-1.5 shadow-inner">
            <Building2 className="w-4 h-4 text-slate-400 mr-2" />
            <select
              value={currentProperty?.id || ''}
              onChange={(e) => {
                const found = properties.find((p) => p.id === e.target.value);
                if (found) setCurrentProperty(found);
              }}
              className="bg-transparent text-sm font-medium text-slate-200 focus:outline-none cursor-pointer pr-4"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Right Action Elements */}
          <div className="flex items-center gap-3">
            {/* Live WebSocket Status Badge */}
            <StatusIndicator state={connectionState} />

            {/* Audio Siren Mute / Unmute Toggle */}
            <button
              onClick={handleToggleMute}
              title={
                isMuted
                  ? 'Unmute emergency audio siren'
                  : isSirenActive
                  ? 'Active siren sounding! Click to mute'
                  : 'Siren active on critical hazards (Click to mute)'
              }
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                isSirenActive
                  ? 'bg-rose-500/20 border-rose-500 text-rose-300 animate-bounce shadow-lg shadow-rose-950/60'
                  : isMuted
                  ? 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline">Siren Muted</span>
                </>
              ) : (
                <>
                  <Volume2 className={`w-4 h-4 ${isSirenActive ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`} />
                  <span className="hidden sm:inline">
                    {isSirenActive ? `SIREN ALARMING (${activeCriticalCount})` : 'Alarm Armed'}
                  </span>
                </>
              )}
            </button>

            {/* User Profile & Demo Switcher */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-800 text-left transition-colors"
                title="Open Settings & Device Management"
              >
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <UserCircle className="w-5 h-5" />
                </div>
                <div className="hidden lg:block">
                  <div className="text-xs font-semibold text-slate-200 leading-tight">
                    {user?.name || 'Operator'}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider">
                    {user?.role || 'ADMIN'}
                  </div>
                </div>
              </button>

              {/* Quick Demo Role Switcher */}
              <div className="hidden xl:flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-md border border-slate-800 text-[10px]">
                <button
                  onClick={() => demoLogin('ADMIN')}
                  className={`px-1.5 py-0.5 rounded ${
                    user?.role === 'ADMIN'
                      ? 'bg-rose-500 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Admin
                </button>
                <button
                  onClick={() => demoLogin('MANAGER')}
                  className={`px-1.5 py-0.5 rounded ${
                    user?.role === 'MANAGER'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mgr
                </button>
                <button
                  onClick={() => demoLogin('VIEWER')}
                  className={`px-1.5 py-0.5 rounded ${
                    user?.role === 'VIEWER'
                      ? 'bg-slate-700 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  View
                </button>
              </div>

              {/* Logout Button */}
              <button
                onClick={logout}
                title="Logout session"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
