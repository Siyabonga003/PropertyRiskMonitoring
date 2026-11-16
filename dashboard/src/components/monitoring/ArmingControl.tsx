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

  const options: { state: ArmingState; label: string; Icon: typeof ShieldOff }[] = [
    { state: 'DISARMED', label: 'Disarm', Icon: ShieldOff },
    { state: 'ARMED_HOME', label: 'Arm home', Icon: ShieldCheck },
    { state: 'ARMED_AWAY', label: 'Arm away', Icon: ShieldAlert },
  ];

  return (
    <div className="panel p-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        {/* Current mode */}
        <div className="flex items-center gap-4">
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-xl transition-colors duration-200 ${
              isArmed ? 'bg-white text-navy-900' : 'bg-navy-700 text-haze'
            }`}
          >
            {currentState === 'ARMED_AWAY' && <ShieldAlert className="w-7 h-7" />}
            {currentState === 'ARMED_HOME' && <ShieldCheck className="w-7 h-7" />}
            {currentState === 'DISARMED' && <ShieldOff className="w-7 h-7" />}
          </div>

          <div>
            <div className="flex items-center gap-2 text-sm text-haze">
              <span>Security mode</span>
              {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </div>
            <div className="text-xl font-semibold tracking-tight">
              {currentState === 'ARMED_AWAY' && 'Armed, away mode'}
              {currentState === 'ARMED_HOME' && 'Armed, home perimeter'}
              {currentState === 'DISARMED' && 'Disarmed, hazards only'}
            </div>
            <p className="text-sm text-haze mt-0.5 max-w-xl">
              {currentState === 'ARMED_AWAY' && 'All motion sensors, smoke detection, and water probes are armed 24/7.'}
              {currentState === 'ARMED_HOME' && 'Perimeter protection is active. Interior motion sensors are bypassed.'}
              {currentState === 'DISARMED' && 'Intrusion alerts are off. Smoke and water leak sensors stay active.'}
            </p>
          </div>
        </div>

        {/* Mode selector */}
        <div className="seg grid grid-cols-3 gap-1" role="group" aria-label="Security mode">
          {options.map(({ state, label, Icon }) => (
            <button
              key={state}
              onClick={() => handleSelect(state)}
              disabled={isUpdating}
              aria-pressed={currentState === state}
              className="seg-btn flex-col sm:flex-row justify-center px-3 sm:px-5 py-2.5 disabled:cursor-not-allowed"
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
