import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { Navbar } from '../components/layout/Navbar';
import { ArmingControl } from '../components/monitoring/ArmingControl';
import { CriticalAlertBanner } from '../components/incidents/CriticalAlertBanner';
import { ZoneCard } from '../components/monitoring/ZoneCard';
import { TelemetryChart } from '../components/analytics/TelemetryChart';
import { IncidentTable } from '../components/incidents/IncidentTable';
import { IncidentTimelineModal } from '../components/incidents/IncidentTimeline';
import { DeviceSettingsModal } from '../components/settings/DeviceSettingsModal';
import type { Zone } from '../types/property';
import type { Incident } from '../types/incidents';
import {
  Layers,
  ShieldCheck,
  AlertOctagon,
  Cpu,
  Flame,
  Sliders,
  Sparkles,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    currentProperty,
    latestReadings,
    incidents,
    activeCriticalCount,
    acknowledgeIncident,
    resolveIncident,
  } = useSocket();

  const [selectedIncidentForTimeline, setSelectedIncidentForTimeline] = useState<Incident | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);

  const zones = currentProperty?.zones || [];
  const isArmed = currentProperty?.armingState !== 'DISARMED';

  // Count total devices online
  const totalDevices = zones.flatMap((z) => z.devices || []);
  const onlineDevicesCount = totalDevices.filter((d) => d.isOnline !== false).length;

  const handleOpenZoneThresholds = (zone: Zone) => {
    setEditingZone(zone);
    setIsSettingsOpen(true);
  };

  const handleOpenGeneralSettings = () => {
    setEditingZone(null);
    setIsSettingsOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <Navbar onOpenSettings={handleOpenGeneralSettings} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Critical Emergency Banner (Auto-rendered when active hazards exist) */}
        <CriticalAlertBanner />

        {/* Property Arming Status Bar */}
        <ArmingControl />

        {/* Key Operational Metric Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* Card 1: Active Critical Hazards */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
            <div
              className={`p-3 rounded-xl ${
                activeCriticalCount > 0
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              {activeCriticalCount > 0 ? (
                <AlertOctagon className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">{activeCriticalCount}</div>
              <div className="text-xs text-slate-400 font-medium">Active Hazards</div>
            </div>
          </div>

          {/* Card 2: Monitored Risk Zones */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">{zones.length}</div>
              <div className="text-xs text-slate-400 font-medium">Protected Zones</div>
            </div>
          </div>

          {/* Card 3: ESP32 Edge Nodes */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">
                {onlineDevicesCount}
                <span className="text-sm font-normal text-slate-400">/{totalDevices.length}</span>
              </div>
              <div className="text-xs text-slate-400 font-medium">Nodes Connected</div>
            </div>
          </div>

          {/* Card 4: Total Incident Audit History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-black text-white font-mono">{incidents.length}</div>
              <div className="text-xs text-slate-400 font-medium">Incidents Logged</div>
            </div>
          </div>
        </div>

        {/* Section: Zone Monitoring Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-400" />
                Live Zone Environmental & Hazard Telemetry
              </h2>
              <p className="text-xs text-slate-400">
                Continuous real-time sensor sampling: Temperature, Humidity, MQ-2 Combustible Gas, Water Probe, and PIR
              </p>
            </div>

            <button
              onClick={handleOpenGeneralSettings}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors border border-slate-700"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Configure Thresholds</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {zones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                latestReadings={latestReadings}
                isArmed={isArmed}
                onEditThresholds={handleOpenZoneThresholds}
              />
            ))}
          </div>
        </section>

        {/* Section: Historical Telemetry Charts */}
        <section className="space-y-3">
          <TelemetryChart
            deviceId={zones[0]?.devices?.[0]?.id || 'ESP32_KITCHEN_01'}
            latestTelemetry={latestReadings}
          />
        </section>

        {/* Section: Filterable Incident Management & Audit Log */}
        <section className="space-y-3">
          <IncidentTable
            onSelectIncident={(incident) => setSelectedIncidentForTimeline(incident)}
          />
        </section>

        {/* Interactive Simulation & Quick Actions Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Live Evaluator Demo Tools</div>
              <div className="text-xs text-slate-400">
                Test the audible Web Audio synthesizer siren, inject smoke spikes, or trigger remote buzzer pulses.
              </div>
            </div>
          </div>

          <button
            onClick={handleOpenGeneralSettings}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-lg shadow-indigo-950/50"
          >
            Open Simulator & Node Controls
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 py-6 text-center text-xs text-slate-500 mt-10">
        RiskGuard Property Risk Monitoring System • Microcontroller Edge Sensor & Siren Engine
      </footer>

      {/* Incident Detail Timeline Modal */}
      <IncidentTimelineModal
        incident={selectedIncidentForTimeline}
        onClose={() => setSelectedIncidentForTimeline(null)}
        onAcknowledge={acknowledgeIncident}
        onResolve={resolveIncident}
      />

      {/* Device & Settings Modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedZoneToEdit={editingZone}
      />
    </div>
  );
};
