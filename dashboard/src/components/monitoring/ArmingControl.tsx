import React, { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldOff, Loader2 } from 'lucide-react';
import type { ArmingState } from '../../types/property';
import { useSocket } from '../../context/SocketContext';

export const ArmingControl: React.FC = () => {
  const { currentProperty, updateArmingState } = useSocket();
  const [isUpdating, setIsUpdating] = useState(false);

  const currentState: ArmingState = currentProperty?.armingState || 'DISARMED';

  const handleSelect = async (state: ArmingState) => {
    if (state === currentState || isUpdating) return;
    try {
      setIsUpdating(true);
      await updateArmingState(state);
    } finally {
      setIsUpdating(false);
    }
  };

  const isArmed = currentState === 'ARMED_HOME' || currentState === 'ARMED_AWAY';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
      {/* Background ambient security glow when armed */}
      {isArmed && (
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      )}

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Current Arming Status Badge */}
        <div className="flex items-center space-x-4">
          <div
            className={`relative flex items-center justify-center w-14 h-14 rounded-2xl border transition-all duration-300 ${
              currentState === 'ARMED_AWAY'
                ? 'bg-rose-500/15 border-rose-500 text-rose-400 shadow-lg shadow-rose-950/50'
                : currentState === 'ARMED_HOME'
                ? 'bg-amber-500/15 border-amber-500 text-amber-400 shadow-lg shadow-amber-950/50'
                : 'bg-slate-800/80 border-slate-700 text-slate-400'
            }`}
          >
            {isArmed && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-2xl opacity-30 bg-current" />
            )}

            {currentState === 'ARMED_AWAY' && <ShieldAlert className="w-7 h-7" />}
            {currentState === 'ARMED_HOME' && <ShieldCheck className="w-7 h-7" />}
            {currentState === 'DISARMED' && <ShieldOff className="w-7 h-7" />}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400">
                Security & Defense Mode
              </span>
              {isUpdating && <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
            </div>
            <div className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              {currentState === 'ARMED_AWAY' && (
                <span className="text-rose-400">ARMED (AWAY MODE)</span>
              )}
              {currentState === 'ARMED_HOME' && (
                <span className="text-amber-400">ARMED (HOME PERIMETER)</span>
              )}
              {currentState === 'DISARMED' && (
                <span className="text-slate-300">DISARMED (HAZARDS ONLY)</span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {currentState === 'ARMED_AWAY' && 'All PIR motion sensors, smoke detection & water probes armed 24/7.'}
              {currentState === 'ARMED_HOME' && 'Perimeter protection active. Interior motion sensors bypassed.'}
              {currentState === 'DISARMED' && 'Intrusion disabled. Smoke and water leak sensors remain actively monitored.'}
            </p>
          </div>
        </div>

        {/* Right: Three Large Visual Buttons */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 bg-slate-950/70 p-1.5 rounded-xl border border-slate-800/80">
          {/* DISARMED */}
          <button
            onClick={() => handleSelect('DISARMED')}
            disabled={isUpdating}
            className={`flex flex-col items-center justify-center py-2.5 px-3 sm:px-5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
              currentState === 'DISARMED'
                ? 'bg-slate-800 border-slate-600 text-white shadow-md'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ShieldOff className="w-4 h-4 mb-1" />
            <span>DISARM</span>
          </button>

          {/* ARMED HOME */}
          <button
            onClick={() => handleSelect('ARMED_HOME')}
            disabled={isUpdating}
            className={`flex flex-col items-center justify-center py-2.5 px-3 sm:px-5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
              currentState === 'ARMED_HOME'
                ? 'bg-amber-500/20 border-amber-500/80 text-amber-300 shadow-md shadow-amber-950/40'
                : 'border-transparent text-slate-400 hover:text-amber-300 hover:bg-slate-900'
            }`}
          >
            <ShieldCheck className="w-4 h-4 mb-1" />
            <span>ARM HOME</span>
          </button>

          {/* ARMED AWAY */}
          <button
            onClick={() => handleSelect('ARMED_AWAY')}
            disabled={isUpdating}
            className={`flex flex-col items-center justify-center py-2.5 px-3 sm:px-5 rounded-lg border text-xs font-semibold transition-all duration-200 ${
              currentState === 'ARMED_AWAY'
                ? 'bg-rose-500/25 border-rose-500 text-rose-300 shadow-md shadow-rose-950/40'
                : 'border-transparent text-slate-400 hover:text-rose-300 hover:bg-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 mb-1" />
            <span>ARM AWAY</span>
          </button>
        </div>
      </div>
    </div>
  );
};
