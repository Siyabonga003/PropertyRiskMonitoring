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
import { Layers, ShieldCheck, AlertOctagon, Cpu, Flame, Sliders } from 'lucide-react';

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

  const stats = [
    {
      label: 'Active hazards',
      value: <>{activeCriticalCount}</>,
      Icon: activeCriticalCount > 0 ? AlertOctagon : ShieldCheck,
      alert: activeCriticalCount > 0,
    },
    { label: 'Protected zones', value: <>{zones.length}</>, Icon: Layers },
    {
      label: 'Nodes connected',
      value: (
        <>
          {onlineDevicesCount}
          <span className="text-base font-normal text-haze">/{totalDevices.length}</span>
        </>
      ),
      Icon: Cpu,
    },
    { label: 'Incidents logged', value: <>{incidents.length}</>, Icon: Flame },
  ];

  return (
    <div className="min-h-screen bg-navy-900 text-white flex flex-col font-sans">
      <Navbar onOpenSettings={handleOpenGeneralSettings} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Appears only while hazards are active */}
        <CriticalAlertBanner />

        <ArmingControl />

        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {stats.map(({ label, value, Icon, alert }) => (
            <div key={label} className="panel p-4 flex items-center gap-3.5">
              <div className="p-2.5 rounded-lg bg-navy-700 text-white">
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-2xl font-semibold tabular-nums">
                  {value}
                  {alert && <span className="h-2.5 w-2.5 rounded-full bg-status-critical" />}
                </div>
                <div className="text-sm text-haze">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Live zones */}
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Live zone telemetry</h2>
              <p className="text-sm text-haze">
                Temperature, humidity, MQ-2 gas, water probe, and PIR motion, updated in real time.
              </p>
            </div>

            <button onClick={handleOpenGeneralSettings} className="btn-outline hidden sm:inline-flex shrink-0">
              <Sliders className="w-4 h-4" />
              <span>Configure thresholds</span>
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

        {/* Historical charts */}
        <section>
          <TelemetryChart
            deviceId={zones[0]?.devices?.[0]?.id || 'ESP32_KITCHEN_01'}
            latestTelemetry={latestReadings}
          />
        </section>

        {/* Incident log */}
        <section>
          <IncidentTable onSelectIncident={(incident) => setSelectedIncidentForTimeline(incident)} />
        </section>

        {/* Simulator shortcut */}
        <div className="panel p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Demo tools</div>
            <div className="text-sm text-haze">
              Test the audible siren, inject a smoke spike, or trigger a remote buzzer pulse.
            </div>
          </div>

          <button onClick={handleOpenGeneralSettings} className="btn-primary shrink-0">
            Open simulator and node controls
          </button>
        </div>
      </main>

      <footer className="border-t border-white/10 py-6 text-center text-sm text-haze mt-10">
        RiskGuard property risk monitoring · Edge sensor and siren engine
      </footer>

      {/* Incident detail modal */}
      <IncidentTimelineModal
        incident={selectedIncidentForTimeline}
        onClose={() => setSelectedIncidentForTimeline(null)}
        onAcknowledge={acknowledgeIncident}
        onResolve={resolveIncident}
      />

      {/* Device and settings modal */}
      <DeviceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedZoneToEdit={editingZone}
      />
    </div>
  );
};
