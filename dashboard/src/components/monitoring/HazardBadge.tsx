import React from 'react';
import { Droplet, Activity, Wifi } from 'lucide-react';

interface WaterBadgeProps {
  detected: boolean;
}

export const WaterBadge: React.FC<WaterBadgeProps> = ({ detected }) => {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-200 ${
        detected ? 'border-status-critical bg-status-critical-soft' : 'border-transparent bg-mist'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-md flex items-center justify-center ${
          detected ? 'bg-status-critical text-white' : 'bg-navy-900 text-white'
        }`}
      >
        <Droplet className="w-4 h-4" />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="text-xs text-ink-muted">Water leak probe</span>
        <span className={`text-sm font-semibold ${detected ? 'text-[#A3162B]' : 'text-[#0B6B3D]'}`}>
          {detected ? 'Leak detected' : 'Dry'}
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
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-200 ${
        detected ? 'border-status-warn bg-status-warn-soft' : 'border-transparent bg-mist'
      }`}
    >
      <div
        className={`w-8 h-8 rounded-md flex items-center justify-center ${
          detected ? 'bg-status-warn text-navy-900' : 'bg-navy-900 text-white'
        }`}
      >
        <Activity className="w-4 h-4" />
      </div>

      <div className="flex flex-col leading-tight">
        <span className="text-xs text-ink-muted">PIR motion sensor</span>
        <span
          className={`text-sm font-semibold ${
            detected ? 'text-[#7A5200]' : isArmed ? 'text-ink-muted' : 'text-ink-muted line-through'
          }`}
        >
          {detected ? 'Motion detected' : isArmed ? 'Clear' : 'Bypassed (disarmed)'}
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
  const color = rssi > -60 ? 'text-status-ok' : rssi > -75 ? 'text-status-warn' : 'text-status-critical';

  return (
    <div className="chip-neutral gap-1.5 font-normal" title={`Wi-Fi RSSI: ${rssi} dBm (${quality})`}>
      <Wifi className={`w-3.5 h-3.5 ${color}`} />
      <span className="tabular-nums">{rssi} dBm</span>
    </div>
  );
};
