import React, { useState } from 'react';
import type { Incident, IncidentStatus } from '../../types/incidents';
import { useSocket } from '../../context/SocketContext';
import {
  Flame,
  Droplets,
  Activity,
  Thermometer,
  WifiOff,
  CheckCircle,
  Clock,
  ShieldAlert,
  Search,
} from 'lucide-react';

interface Props {
  onSelectIncident?: (incident: Incident) => void;
}

export const IncidentTable: React.FC<Props> = ({ onSelectIncident }) => {
  const { incidents, acknowledgeIncident, resolveIncident } = useSocket();
  const [statusFilter, setStatusFilter] = useState<'ALL' | IncidentStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const filteredIncidents = incidents.filter((inc) => {
    const matchesStatus = statusFilter === 'ALL' || inc.status === statusFilter;
    const matchesSearch =
      searchQuery === '' ||
      inc.details?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.deviceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.device?.zone?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.hazardType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getHazardIcon = (type: Incident['hazardType']) => {
    switch (type) {
      case 'SMOKE':
        return <Flame className="w-4 h-4" />;
      case 'WATER_LEAK':
        return <Droplets className="w-4 h-4" />;
      case 'HIGH_TEMP':
      case 'LOW_TEMP':
        return <Thermometer className="w-4 h-4" />;
      case 'MOTION':
        return <Activity className="w-4 h-4" />;
      case 'DEVICE_OFFLINE':
        return <WifiOff className="w-4 h-4" />;
      default:
        return <ShieldAlert className="w-4 h-4" />;
    }
  };

  const getSeverityBadge = (severity: Incident['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return <span className="chip-critical">Critical</span>;
      case 'WARNING':
        return <span className="chip-warn">Warning</span>;
      case 'INFO':
        return <span className="chip-neutral">Info</span>;
    }
  };

  const getStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="chip-solid-critical gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
            Active
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="chip-warn">
            <Clock className="w-3 h-3" />
            Acknowledged
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="chip-ok">
            <CheckCircle className="w-3 h-3" />
            Resolved
          </span>
        );
    }
  };

  const handleAcknowledge = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setProcessingId(id);
      await acknowledgeIncident(id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleResolve = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setProcessingId(id);
      await resolveIncident(id);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="card p-5">
      {/* Header and controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4 mb-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">Incident log</h3>
          <p className="text-sm text-ink-muted mt-0.5">
            Every hazard trigger, acknowledgment, and resolution, in order.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <label htmlFor="incident-search" className="sr-only">
              Search incidents
            </label>
            <Search className="w-4 h-4 text-ink-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="incident-search"
              type="text"
              placeholder="Search incidents"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="field pl-9 w-52"
            />
          </div>

          <div className="seg" role="group" aria-label="Filter by status">
            {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                aria-pressed={statusFilter === tab}
                className="seg-btn px-3 py-1"
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Records */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-ink-muted font-medium">
              <th className="py-3 px-3 font-medium">Hazard</th>
              <th className="py-3 px-3 font-medium">Zone / device</th>
              <th className="py-3 px-3 font-medium">Severity</th>
              <th className="py-3 px-3 font-medium">Status</th>
              <th className="py-3 px-3 font-medium">Timeline</th>
              <th className="py-3 px-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-10 text-center text-ink-muted">
                  No incidents match the current filters.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => onSelectIncident?.(inc)}
                  className="hover:bg-mist transition-colors duration-150 cursor-pointer"
                >
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-md bg-navy-900 text-white">{getHazardIcon(inc.hazardType)}</div>
                      <div>
                        <div className="font-semibold">{inc.hazardType.replace('_', ' ')}</div>
                        <div className="text-ink-muted max-w-xs truncate">{inc.details}</div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <div className="font-medium">{inc.device?.zone?.name || 'Property wide'}</div>
                    <div className="text-xs font-mono text-ink-muted">{inc.deviceId}</div>
                  </td>

                  <td className="py-3 px-3">{getSeverityBadge(inc.severity)}</td>

                  <td className="py-3 px-3">{getStatusBadge(inc.status)}</td>

                  <td className="py-3 px-3 text-xs text-ink-muted tabular-nums whitespace-nowrap space-y-0.5">
                    <div>
                      <span>Triggered</span> {new Date(inc.startedAt).toLocaleTimeString()}
                    </div>
                    {inc.acknowledgedAt && (
                      <div>
                        <span>Acknowledged</span> {new Date(inc.acknowledgedAt).toLocaleTimeString()}
                      </div>
                    )}
                    {inc.resolvedAt && (
                      <div>
                        <span>Resolved</span> {new Date(inc.resolvedAt).toLocaleTimeString()}
                      </div>
                    )}
                  </td>

                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {inc.status === 'ACTIVE' && (
                        <button
                          onClick={(e) => handleAcknowledge(inc.id, e)}
                          disabled={processingId === inc.id}
                          className="btn-outline px-2.5 py-1 text-xs"
                        >
                          Acknowledge
                        </button>
                      )}

                      {inc.status !== 'RESOLVED' && (
                        <button
                          onClick={(e) => handleResolve(inc.id, e)}
                          disabled={processingId === inc.id}
                          className="btn-outline px-2.5 py-1 text-xs"
                        >
                          Resolve
                        </button>
                      )}

                      {inc.status === 'RESOLVED' && <span className="text-ink-muted text-xs">Completed</span>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
