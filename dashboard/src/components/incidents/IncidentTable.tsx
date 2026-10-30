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
        return <Flame className="w-4 h-4 text-rose-400" />;
      case 'WATER_LEAK':
        return <Droplets className="w-4 h-4 text-cyan-400" />;
      case 'HIGH_TEMP':
      case 'LOW_TEMP':
        return <Thermometer className="w-4 h-4 text-amber-400" />;
      case 'MOTION':
        return <Activity className="w-4 h-4 text-amber-400" />;
      case 'DEVICE_OFFLINE':
        return <WifiOff className="w-4 h-4 text-slate-400" />;
      default:
        return <ShieldAlert className="w-4 h-4 text-rose-400" />;
    }
  };

  const getSeverityBadge = (severity: Incident['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
            Critical
          </span>
        );
      case 'WARNING':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
            Warning
          </span>
        );
      case 'INFO':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/30">
            Info
          </span>
        );
    }
  };

  const getStatusBadge = (status: IncidentStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-500/25 text-rose-300 border border-rose-500/40 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
            Active
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
            <Clock className="w-3 h-3" />
            Acknowledged
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
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
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Table Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Incident Audit Log & Lifecycle Management
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Full audit trail of edge triggers, security acknowledgments, and resolution states
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950/80 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-slate-600 w-44"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            {(['ALL', 'ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1 rounded-lg transition-colors ${
                  statusFilter === tab
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incident Records Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
              <th className="py-3 px-3">Hazard & Details</th>
              <th className="py-3 px-3">Zone / Device</th>
              <th className="py-3 px-3">Severity</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Timeline (Start / Ack / Resolved)</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredIncidents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-500">
                  No incidents found matching current filters.
                </td>
              </tr>
            ) : (
              filteredIncidents.map((inc) => (
                <tr
                  key={inc.id}
                  onClick={() => onSelectIncident?.(inc)}
                  className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                >
                  {/* Hazard & Description */}
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800">
                        {getHazardIcon(inc.hazardType)}
                      </div>
                      <div>
                        <div className="font-bold text-white group-hover:text-rose-300 transition-colors">
                          {inc.hazardType.replace('_', ' ')}
                        </div>
                        <div className="text-slate-400 max-w-xs truncate">{inc.details}</div>
                      </div>
                    </div>
                  </td>

                  {/* Zone & Device */}
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-200">
                      {inc.device?.zone?.name || 'Property Wide'}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">{inc.deviceId}</div>
                  </td>

                  {/* Severity */}
                  <td className="py-3 px-3">{getSeverityBadge(inc.severity)}</td>

                  {/* Status */}
                  <td className="py-3 px-3">{getStatusBadge(inc.status)}</td>

                  {/* Timeline */}
                  <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500">Trigger:</span>{' '}
                      {new Date(inc.startedAt).toLocaleTimeString()}
                    </div>
                    {inc.acknowledgedAt && (
                      <div className="text-amber-400/90">
                        <span className="text-slate-500">Ack:</span>{' '}
                        {new Date(inc.acknowledgedAt).toLocaleTimeString()}
                      </div>
                    )}
                    {inc.resolvedAt && (
                      <div className="text-emerald-400/90">
                        <span className="text-slate-500">Resolved:</span>{' '}
                        {new Date(inc.resolvedAt).toLocaleTimeString()}
                      </div>
                    )}
                  </td>

                  {/* Direct Actions */}
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {inc.status === 'ACTIVE' && (
                        <button
                          onClick={(e) => handleAcknowledge(inc.id, e)}
                          disabled={processingId === inc.id}
                          className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold transition-all"
                        >
                          Acknowledge
                        </button>
                      )}

                      {inc.status !== 'RESOLVED' && (
                        <button
                          onClick={(e) => handleResolve(inc.id, e)}
                          disabled={processingId === inc.id}
                          className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold transition-all"
                        >
                          Resolve
                        </button>
                      )}

                      {inc.status === 'RESOLVED' && (
                        <span className="text-slate-500 text-[11px] italic">Completed</span>
                      )}
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
