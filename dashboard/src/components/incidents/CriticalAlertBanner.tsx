import React, { useState, useEffect } from 'react';
import { Flame, Droplets, Activity, Thermometer, BellRing, VolumeX, CheckCircle } from 'lucide-react';
import type { Incident } from '../../types/incidents';
import { useSocket } from '../../context/SocketContext';
import { deviceService } from '../../services/api';
import { soundAlert } from '../../services/soundAlert';

export const CriticalAlertBanner: React.FC = () => {
  const { incidents, acknowledgeIncident, resolveIncident } = useSocket();
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [silenceSuccess, setSilenceSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter for ACTIVE incidents (critical first, then warnings)
  const activeIncidents = incidents
    .filter((i) => i.status === 'ACTIVE')
    .sort((a, b) => (a.severity === 'CRITICAL' ? -1 : b.severity === 'CRITICAL' ? 1 : 0));

  // Reset index if out of bounds
  useEffect(() => {
    if (selectedIdx >= activeIncidents.length) {
      setSelectedIdx(0);
    }
  }, [activeIncidents.length, selectedIdx]);

  if (activeIncidents.length === 0) {
    return null;
  }

  const currentInc: Incident = activeIncidents[selectedIdx] || activeIncidents[0];

  const getHazardIcon = (type: Incident['hazardType']) => {
    switch (type) {
      case 'SMOKE':
        return <Flame className="w-6 h-6" />;
      case 'WATER_LEAK':
        return <Droplets className="w-6 h-6" />;
      case 'HIGH_TEMP':
        return <Thermometer className="w-6 h-6" />;
      case 'MOTION':
        return <Activity className="w-6 h-6" />;
      default:
        return <BellRing className="w-6 h-6" />;
    }
  };

  const getReadingBadge = (inc: Incident) => {
    if (inc.readingValue === null || inc.readingValue === undefined) return null;
    switch (inc.hazardType) {
      case 'SMOKE':
        return `${inc.readingValue} ppm`;
      case 'HIGH_TEMP':
      case 'LOW_TEMP':
        return `${inc.readingValue}°C`;
      case 'WATER_LEAK':
        return 'Probe wet';
      case 'MOTION':
        return 'Motion detected';
      default:
        return `${inc.readingValue}`;
    }
  };

  const calculateElapsed = (startedAt: string) => {
    const diff = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ${diff % 60}s ago`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m ago`;
  };

  const handleAcknowledge = async () => {
    try {
      setIsProcessing(true);
      await acknowledgeIncident(currentInc.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSilenceDevice = async () => {
    try {
      setIsProcessing(true);
      soundAlert.stopSiren();
      await deviceService.sendCommand(currentInc.deviceId, 'SILENCE_BUZZER', { durationMs: 60000 });
      setSilenceSuccess(`Hardware buzzer on ${currentInc.deviceId} silenced.`);
      setTimeout(() => setSilenceSuccess(null), 5000);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectResolve = async () => {
    try {
      setIsProcessing(true);
      await resolveIncident(currentInc.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const isCritical = currentInc.severity === 'CRITICAL';
  const readingBadge = getReadingBadge(currentInc);

  return (
    <div
      role="alert"
      className={`card border-l-8 p-4 sm:p-5 ${
        isCritical ? 'border-l-status-critical' : 'border-l-status-warn'
      }`}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Hazard details */}
        <div className="flex items-start sm:items-center gap-4">
          <div className="p-3 rounded-lg bg-navy-900 text-white shrink-0">{getHazardIcon(currentInc.hazardType)}</div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${isCritical ? 'chip-solid-critical' : 'chip-warn'} gap-1.5`}>
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isCritical ? 'bg-white motion-safe:animate-dot-pulse' : 'bg-[#7A5200]'}`}
                />
                {isCritical ? 'Critical hazard' : 'Security warning'}
              </span>

              <span className="text-sm text-ink-muted">
                Zone: <strong className="text-navy-900">{currentInc.device?.zone?.name || 'Main Zone'}</strong>
              </span>

              <span className="text-xs text-ink-muted font-mono">{currentInc.deviceId}</span>

              <span className="chip-neutral tabular-nums">{calculateElapsed(currentInc.startedAt)}</span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <h3 className="text-lg font-semibold tracking-tight">
                {currentInc.details || `${currentInc.hazardType.replace('_', ' ')} detected`}
              </h3>
              {readingBadge && <span className="chip-critical text-sm tabular-nums">{readingBadge}</span>}
            </div>

            {/* Selector when several hazards are active */}
            {activeIncidents.length > 1 && (
              <div className="mt-2 flex items-center gap-2 text-sm text-ink-muted">
                <span>
                  Active hazards ({selectedIdx + 1} of {activeIncidents.length})
                </span>
                <div className="seg p-0.5 gap-0.5" role="group" aria-label="Select active hazard">
                  {activeIncidents.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(i)}
                      aria-pressed={i === selectedIdx}
                      className="seg-btn px-2 py-0.5 text-xs"
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {silenceSuccess && (
              <div className="mt-1.5 text-sm text-[#0B6B3D] font-medium flex items-center gap-1" role="status">
                <CheckCircle className="w-4 h-4" /> {silenceSuccess}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
          <button
            onClick={handleSilenceDevice}
            disabled={isProcessing}
            title="Silence the hardware buzzer on the edge node"
            className="btn-outline flex-1 sm:flex-initial"
          >
            <VolumeX className="w-4 h-4" />
            <span>Silence buzzer</span>
          </button>

          <button
            onClick={handleAcknowledge}
            disabled={isProcessing}
            className="btn-primary flex-1 sm:flex-initial"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Acknowledge</span>
          </button>

          <button
            onClick={handleDirectResolve}
            disabled={isProcessing}
            title="Mark hazard resolved"
            className="btn-outline flex-1 sm:flex-initial"
          >
            <span>Resolve</span>
          </button>
        </div>
      </div>
    </div>
  );
};
