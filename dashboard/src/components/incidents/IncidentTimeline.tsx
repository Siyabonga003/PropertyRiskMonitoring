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
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Incident ${incident.id}`}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 animate-fade-in"
    >
      <div className="card w-full max-w-lg p-6 relative">
        <button onClick={onClose} aria-label="Close" className="btn-icon absolute top-4 right-4">
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-5 pr-12">
          <div className="p-3 rounded-lg bg-navy-900 text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight">Incident #{incident.id}</h3>
            <p className="text-sm text-ink-muted">
              {incident.hazardType.replace('_', ' ')} · {incident.device?.zone?.name || 'All zones'}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="bg-mist rounded-lg p-4 mb-6">
          <div className="text-sm text-ink-muted mb-1">Sensor reading and diagnostics</div>
          <div className="text-sm font-medium">{incident.details}</div>
          <div className="mt-3 flex items-center gap-4 text-xs text-ink-muted">
            <span>
              Device: <strong className="font-mono text-navy-900">{incident.deviceId}</strong>
            </span>
            {incident.readingValue !== undefined && incident.readingValue !== null && (
              <span>
                Reading: <strong className="text-[#A3162B]">{incident.readingValue}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="space-y-4 mb-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
          <div className="flex items-start gap-3 relative">
            <div className="w-6 h-6 rounded-full bg-status-critical-soft text-[#A3162B] border border-status-critical flex items-center justify-center shrink-0 z-10">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-sm font-semibold">Hazard triggered, siren dispatched</div>
              <div className="text-xs text-ink-muted tabular-nums">{new Date(incident.startedAt).toLocaleString()}</div>
            </div>
          </div>

          <div className="flex items-start gap-3 relative">
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                incident.acknowledgedAt
                  ? 'bg-status-warn-soft text-[#7A5200] border-status-warn'
                  : 'bg-mist text-ink-muted border-line'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {incident.acknowledgedAt ? 'Acknowledged by operator' : 'Awaiting acknowledgment'}
              </div>
              <div className="text-xs text-ink-muted tabular-nums">
                {incident.acknowledgedAt
                  ? `${new Date(incident.acknowledgedAt).toLocaleString()} (${incident.acknowledgedBy || 'Operator'})`
                  : 'The alarm keeps broadcasting until acknowledged'}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 relative">
            <div
              className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 z-10 ${
                incident.resolvedAt
                  ? 'bg-status-ok-soft text-[#0B6B3D] border-status-ok'
                  : 'bg-mist text-ink-muted border-line'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-sm font-semibold">
                {incident.resolvedAt ? 'Resolved and back to normal' : 'Pending resolution'}
              </div>
              <div className="text-xs text-ink-muted tabular-nums">
                {incident.resolvedAt
                  ? new Date(incident.resolvedAt).toLocaleString()
                  : 'Sensor values must return to safe thresholds'}
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-4 border-t border-line">
          <button onClick={onClose} className="btn-outline">
            Close
          </button>

          {incident.status !== 'RESOLVED' && (
            <button onClick={() => onResolve(incident.id)} className="btn-outline">
              Mark resolved
            </button>
          )}

          {incident.status === 'ACTIVE' && (
            <button onClick={() => onAcknowledge(incident.id)} className="btn-primary">
              Acknowledge
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
