import React from 'react';
import { Droplet, Activity, Wifi } from 'lucide-react';

interface WaterBadgeProps {
  detected: boolean;
}

export const WaterBadge: React.FC<WaterBadgeProps> = ({ detected }) => {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
        detected
          ? 'bg-rose-600/30 border-rose-500 text-rose-300 animate-pulse-fast shadow-lg shadow-rose-950/60'
          : 'bg-slate-900/80 border-slate-800 text-slate-300'
      }`}
    >
      <div
        className={`w-6 h-6 rounded-lg flex items-center justify-center ${
          detected ? 'bg-rose-500 text-white animate-bounce' : 'bg-slate-800 text-cyan-400'
        }`}
      >
        <Droplet className="w-3.5 h-3.5" />
      </div>

      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
          Water Leak Probe
        </span>
        <span className={`text-xs ${detected ? 'text-rose-400 font-extrabold' : 'text-emerald-400'}`}>
          {detected ? 'LEAK DETECTED!' : 'DRY (SAFE)'}
        </span>
      </div>
    </div>
  );
};

interface MotionBadgeProps {
  detected: boolean;
  isArmed?: boolean;
}

export const MotionBadge: React.FC<MotionBadgeProps> = ({ detected, isArmed = true }) => {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
        detected
          ? 'bg-amber-500/25 border-amber-500 text-amber-300 animate-pulse shadow-lg shadow-amber-950/60'
          : 'bg-slate-900/80 border-slate-800 text-slate-300'
      }`}
    >
      <div
        className={`w-6 h-6 rounded-lg flex items-center justify-center ${
          detected ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
        }`}
      >
        <Activity className="w-3.5 h-3.5" />
      </div>

      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">
          PIR Motion Sensor
        </span>
        <span
          className={`text-xs ${
            detected
              ? 'text-amber-400 font-extrabold'
              : isArmed
              ? 'text-slate-400'
              : 'text-slate-500 line-through'
          }`}
        >
          {detected ? 'MOTION DETECTED!' : isArmed ? 'Clear (No Movement)' : 'Bypassed (Disarmed)'}
        </span>
      </div>
    </div>
  );
};

interface RssiBadgeProps {
  rssi: number | null | undefined;
}

export const RssiBadge: React.FC<RssiBadgeProps> = ({ rssi }) => {
  if (rssi === null || rssi === undefined) return null;

  // Signal strength: -50 dBm is excellent, -70 is fair, -85 is weak
  const quality = rssi > -60 ? 'Strong' : rssi > -75 ? 'Good' : 'Weak';
  const color = rssi > -60 ? 'text-emerald-400' : rssi > -75 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-400"
      title={`Wi-Fi RSSI: ${rssi} dBm (${quality})`}
    >
      <Wifi className={`w-3 h-3 ${color}`} />
      <span>{rssi} dBm</span>
    </div>
  );
};
