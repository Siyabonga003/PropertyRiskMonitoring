import React from 'react';
import type { SocketConnectionState } from '../../context/SocketContext';
import { Wifi, WifiOff } from 'lucide-react';

interface Props {
  state: SocketConnectionState;
  showText?: boolean;
}

export const StatusIndicator: React.FC<Props> = ({ state, showText = true }) => {
  const configs = {
    connected: {
      dotColor: 'bg-emerald-500',
      pingColor: 'bg-emerald-400',
      textColor: 'text-emerald-400',
      border: 'border-emerald-500/30',
      bg: 'bg-emerald-500/10',
      label: 'Live Stream Active',
      Icon: Wifi,
    },
    reconnecting: {
      dotColor: 'bg-amber-500',
      pingColor: 'bg-amber-400',
      textColor: 'text-amber-400',
      border: 'border-amber-500/30',
      bg: 'bg-amber-500/10',
      label: 'Reconnecting...',
      Icon: Wifi,
    },
    disconnected: {
      dotColor: 'bg-rose-500',
      pingColor: 'bg-rose-400',
      textColor: 'text-rose-400',
      border: 'border-rose-500/30',
      bg: 'bg-rose-500/10',
      label: 'Disconnected',
      Icon: WifiOff,
    },
  };

  const current = configs[state] || configs.disconnected;
  const Icon = current.Icon;

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border ${current.border} ${current.bg} transition-colors`}
      title={`Socket.IO Status: ${state}`}
    >
      <span className="relative flex h-2 w-2">
        {state === 'connected' && (
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${current.pingColor}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${current.dotColor}`} />
      </span>

      <Icon className={`w-3.5 h-3.5 ${current.textColor}`} />

      {showText && <span className={current.textColor}>{current.label}</span>}
    </div>
  );
};
