import React from 'react';
import type { Incident } from '../../types/incidents';
import { X, CheckCircle, ShieldAlert, AlertTriangle, UserCheck } from 'lucide-react';

interface Props {
  incident: Incident | null;
  onClose: () => void;
  onAcknowledge: (id: string) => Promise<void>;
  onResolve: (id: string) => Promise<void>;
}

export const IncidentTimelineModal: React.FC<Props> = ({
  incident,
  onClose,
  onAcknowledge,
  onResolve,
}) => {
  if (!incident) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Incident Incident #{incident.id}
            </h3>
            <p className="text-xs text-slate-400">
              {incident.hazardType.replace('_', ' ')} • {incident.device?.zone?.name || 'All Zones'}
            </p>
          </div>
        </div>

        {/* Details Box */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 mb-6">
          <div className="text-xs text-slate-400 uppercase font-semibold tracking-wider mb-1">
            Sensor Reading & Diagnostics
          </div>
          <div className="text-sm font-medium text-slate-200">{incident.details}</div>
          <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-400">
            <span>Device: <strong className="text-slate-300">{incident.deviceId}</strong></span>
            {incident.readingValue !== undefined && incident.readingValue !== null && (
              <span>Reading: <strong className="text-rose-400">{incident.readingValue}</strong></span>
            )}
          </div>
        </div>

        {/* Chronological Timeline */}
        <div className="space-y-4 mb-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
          {/* Step 1: Triggered */}
          <div className="flex items-start gap-3 relative">
            <div className="w-6 h-6 rounded-full bg-rose-500/30 border border-rose-400 flex items-center justify-center shrink-0 z-10 text-rose-300">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">Hazard Triggered & Siren Dispatched</div>
              <div className="text-[11px] font-mono text-slate-400">
                {new Date(incident.startedAt).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Step 2: Acknowledged */}
          <div className="flex items-start gap-3 relative">
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                incident.acknowledgedAt
                  ? 'bg-amber-500/30 border-amber-400 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {incident.acknowledgedAt ? 'Security Operator Acknowledged' : 'Awaiting Acknowledgment'}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {incident.acknowledgedAt
                  ? `${new Date(incident.acknowledgedAt).toLocaleString()} (${incident.acknowledgedBy || 'Operator'})`
                  : 'Alarm beacon continues broadcasting until acknowledged'}
              </div>
            </div>
          </div>

          {/* Step 3: Resolved */}
          <div className="flex items-start gap-3 relative">
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                incident.resolvedAt
                  ? 'bg-emerald-500/30 border-emerald-400 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-500'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {incident.resolvedAt ? 'Hazard Resolved & Normalized' : 'Pending Resolution'}
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {incident.resolvedAt
                  ? new Date(incident.resolvedAt).toLocaleString()
                  : 'Sensor values must return to safe thresholds'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          {incident.status === 'ACTIVE' && (
            <button
              onClick={() => onAcknowledge(incident.id)}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              Acknowledge Incident
            </button>
          )}

          {incident.status !== 'RESOLVED' && (
            <button
              onClick={() => onResolve(incident.id)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors"
            >
              Mark Incident Resolved
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
