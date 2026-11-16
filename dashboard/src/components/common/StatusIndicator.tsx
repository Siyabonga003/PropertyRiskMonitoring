import React from 'react';
import type { SocketConnectionState } from '../../context/SocketContext';
import { Wifi, WifiOff } from 'lucide-react';

interface Props {
  state: SocketConnectionState;
  showText?: boolean;
}

export const StatusIndicator: React.FC<Props> = ({ state, showText = true }) => {
  const configs = {
    connected: { dot: 'bg-status-ok', label: 'Live', Icon: Wifi },
    reconnecting: { dot: 'bg-status-warn', label: 'Reconnecting…', Icon: Wifi },
    disconnected: { dot: 'bg-status-critical', label: 'Disconnected', Icon: WifiOff },
  };

  const current = configs[state] || configs.disconnected;
  const Icon = current.Icon;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-white"
      title={`Socket.IO status: ${state}`}
      role="status"
    >
      <span className={`h-2 w-2 rounded-full ${current.dot}`} />
      <Icon className="w-4 h-4 text-haze" />
      {showText && <span className="hidden lg:inline">{current.label}</span>}
    </div>
  );
};
