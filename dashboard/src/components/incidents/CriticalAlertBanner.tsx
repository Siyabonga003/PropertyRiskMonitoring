import React, { useState, useEffect } from 'react';
import { Flame, Droplets, Activity, Thermometer, BellRing, VolumeX, CheckCircle, ChevronRight } from 'lucide-react';
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
        return <Flame className="w-6 h-6 text-rose-300" />;
      case 'WATER_LEAK':
        return <Droplets className="w-6 h-6 text-cyan-300" />;
      case 'HIGH_TEMP':
        return <Thermometer className="w-6 h-6 text-amber-300" />;
      case 'MOTION':
        return <Activity className="w-6 h-6 text-amber-300" />;
      default:
        return <BellRing className="w-6 h-6 text-rose-300" />;
    }
  };

  const getReadingBadge = (inc: Incident) => {
    if (inc.readingValue === null || inc.readingValue === undefined) return null;
    switch (inc.hazardType) {
      case 'SMOKE':
        return `${inc.readingValue} PPM`;
      case 'HIGH_TEMP':
      case 'LOW_TEMP':
        return `${inc.readingValue}°C`;
      case 'WATER_LEAK':
        return 'Conductivity Active';
      case 'MOTION':
        return 'PIR Pulse Active';
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

  return (
    <div
      className={`relative rounded-2xl border p-4 sm:p-5 transition-all shadow-2xl overflow-hidden ${
        isCritical
          ? 'bg-rose-950/40 border-rose-500/80 shadow-rose-950/70 animate-flash-siren'
          : 'bg-amber-950/40 border-amber-500/80 shadow-amber-950/70'
      }`}
    >
      {/* Background strobe effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-rose-500/10 via-transparent to-rose-500/10 pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Hazard details & icon */}
        <div className="flex items-start sm:items-center gap-4">
          <div
            className={`p-3 rounded-xl border flex items-center justify-center shrink-0 ${
              isCritical
                ? 'bg-rose-500/30 border-rose-400 animate-pulse'
                : 'bg-amber-500/30 border-amber-400'
            }`}
          >
            {getHazardIcon(currentInc.hazardType)}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2 py-0.5 text-xs font-black tracking-widest uppercase rounded border ${
                  isCritical
                    ? 'bg-rose-600 text-white border-rose-400 animate-pulse'
                    : 'bg-amber-600 text-slate-950 border-amber-400 font-bold'
                }`}
              >
                {isCritical ? 'CRITICAL HAZARD' : 'SECURITY WARNING'}
              </span>

              <span className="text-xs font-semibold text-slate-300">
                Zone: <strong className="text-white">{currentInc.device?.zone?.name || 'Main Zone'}</strong>
              </span>

              <span className="text-xs text-slate-400 font-mono">
                ({currentInc.deviceId})
              </span>

              <span className="text-xs font-medium text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700">
                {calculateElapsed(currentInc.startedAt)}
              </span>
            </div>

            <div className="mt-1 flex items-baseline gap-2">
              <h3 className="text-lg font-bold text-white tracking-tight">
                {currentInc.details || `${currentInc.hazardType.replace('_', ' ')} detected!`}
              </h3>
              {getReadingBadge(currentInc) && (
                <span className="text-sm font-mono font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800">
                  {getReadingBadge(currentInc)}
                </span>
              )}
            </div>

            {/* Multiple incident counter selector */}
            {activeIncidents.length > 1 && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-300">
                <span>
                  Active Hazards ({selectedIdx + 1} of {activeIncidents.length}):
                </span>
                <div className="flex gap-1">
                  {activeIncidents.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedIdx(i)}
                      className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[10px] transition-colors ${
                        i === selectedIdx
                          ? 'bg-rose-500 text-white font-extrabold'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {silenceSuccess && (
              <div className="mt-1 text-xs text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5 inline" /> {silenceSuccess}
              </div>
            )}
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
          {/* Silence Buzzer on ESP32 */}
          <button
            onClick={handleSilenceDevice}
            disabled={isProcessing}
            title="Silence the hardware buzzer on the edge node"
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900/90 border border-slate-700 hover:border-slate-500 text-slate-200 hover:text-white text-xs font-semibold transition-all shadow-md"
          >
            <VolumeX className="w-4 h-4 text-amber-400" />
            <span>Silence Buzzer</span>
          </button>

          {/* Acknowledge Incident */}
          <button
            onClick={handleAcknowledge}
            disabled={isProcessing}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs tracking-wide transition-all shadow-lg shadow-amber-950/60"
          >
            <CheckCircle className="w-4 h-4 text-slate-950" />
            <span>Acknowledge Hazard</span>
          </button>

          {/* Direct Resolve (Quick Action) */}
          <button
            onClick={handleDirectResolve}
            disabled={isProcessing}
            className="p-2 rounded-xl bg-emerald-600/30 border border-emerald-500/50 hover:bg-emerald-600 hover:text-white text-emerald-300 text-xs font-semibold transition-all"
            title="Mark Hazard Resolved"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
