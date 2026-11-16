import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Building2, UserCircle, LogOut } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { StatusIndicator } from '../common/StatusIndicator';
import { BrandMark } from '../common/BrandMark';
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

  const roles = [
    { role: 'ADMIN', label: 'Admin' },
    { role: 'MANAGER', label: 'Manager' },
    { role: 'VIEWER', label: 'Viewer' },
  ] as const;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/10 bg-navy-950/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <BrandMark className="w-9 h-9" />
            <div className="leading-tight">
              <div className="text-lg font-semibold tracking-tight text-white">RiskGuard</div>
              <div className="hidden sm:block text-xs text-haze">Property risk monitoring</div>
            </div>
          </div>

          {/* Property selector */}
          <div className="hidden md:flex items-center rounded-lg border border-white/15 bg-white/5 px-3 py-1.5">
            <Building2 className="w-4 h-4 text-haze mr-2" />
            <label htmlFor="property-select" className="sr-only">
              Property
            </label>
            <select
              id="property-select"
              value={currentProperty?.id || ''}
              onChange={(e) => {
                const found = properties.find((p) => p.id === e.target.value);
                if (found) setCurrentProperty(found);
              }}
              className="bg-transparent text-sm font-medium text-white focus:outline-none cursor-pointer pr-4"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id} className="bg-navy-900 text-white">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <StatusIndicator state={connectionState} />

            {/* Siren mute toggle */}
            <button
              onClick={handleToggleMute}
              aria-pressed={!isMuted}
              title={
                isMuted
                  ? 'Unmute emergency audio siren'
                  : isSirenActive
                  ? 'Siren is sounding. Click to mute'
                  : 'Siren sounds on critical hazards. Click to mute'
              }
              className="btn-outline px-3 py-1.5 text-white"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              <span className="hidden lg:inline">
                {isMuted ? 'Siren muted' : isSirenActive ? `Siren on (${activeCriticalCount})` : 'Siren ready'}
              </span>
            </button>

            {/* Profile, role switcher, logout */}
            <div className="flex items-center gap-1.5 sm:gap-2 pl-2 sm:pl-3 border-l border-white/10">
              <button
                onClick={onOpenSettings}
                className="flex items-center gap-2 rounded-lg p-1.5 text-left text-white transition-colors hover:bg-pink/10"
                title="Open settings and device management"
              >
                <UserCircle className="w-7 h-7 text-haze" />
                <div className="hidden lg:block leading-tight">
                  <div className="text-sm font-medium">{user?.name || 'Operator'}</div>
                  <div className="text-xs text-haze capitalize">{(user?.role || 'ADMIN').toLowerCase()}</div>
                </div>
              </button>

              <div className="hidden xl:flex seg" role="group" aria-label="Switch demo role">
                {roles.map(({ role, label }) => (
                  <button
                    key={role}
                    onClick={() => demoLogin(role)}
                    aria-pressed={user?.role === role}
                    className="seg-btn px-2.5 py-1 text-xs text-white"
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button onClick={logout} title="Sign out" aria-label="Sign out" className="btn-icon text-white">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
