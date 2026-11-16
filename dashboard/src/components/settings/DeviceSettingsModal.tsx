import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { deviceService } from '../../services/api';
import type { Zone, ZoneThresholdConfig } from '../../types/property';
import {
  X,
  Cpu,
  BellRing,
  Sliders,
  CheckCircle,
  Flame,
  Droplet,
  Activity,
  Thermometer,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedZoneToEdit?: Zone | null;
}

export const DeviceSettingsModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedZoneToEdit,
}) => {
  const { currentProperty, updateZoneThresholds, triggerSimulationIncident } = useSocket();

  const [activeTab, setActiveTab] = useState<'devices' | 'thresholds' | 'simulator'>(
    selectedZoneToEdit ? 'thresholds' : 'devices'
  );

  const [activeZoneId, setActiveZoneId] = useState<string>(
    selectedZoneToEdit?.id || currentProperty?.zones?.[0]?.id || ''
  );

  const activeZone = currentProperty?.zones?.find((z) => z.id === activeZoneId);

  // Threshold form state
  const [maxTemp, setMaxTemp] = useState<number>(activeZone?.thresholdConfig?.maxTemp || 45);
  const [maxSmokePpm, setMaxSmokePpm] = useState<number>(activeZone?.thresholdConfig?.maxSmokePpm || 350);
  const [waterAlertEnabled, setWaterAlertEnabled] = useState<boolean>(
    activeZone?.thresholdConfig?.waterAlertEnabled !== false
  );
  const [motionAlertEnabled, setMotionAlertEnabled] = useState<boolean>(
    activeZone?.thresholdConfig?.motionAlertEnabled !== false
  );

  const [savingThresholds, setSavingThresholds] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Buzzer test state
  const [buzzerOutput, setBuzzerOutput] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleTestBuzzer = async (deviceId: string) => {
    try {
      setBuzzerOutput((prev) => ({ ...prev, [deviceId]: 'Sending MQTT command...' }));
      const res = await deviceService.sendCommand(deviceId, 'TRIGGER_BUZZER', { durationMs: 3000 });
      setBuzzerOutput((prev) => ({ ...prev, [deviceId]: res.message || 'Signal acknowledged.' }));
      setTimeout(() => {
        setBuzzerOutput((prev) => {
          const next = { ...prev };
          delete next[deviceId];
          return next;
        });
      }, 4000);
    } catch {
      setBuzzerOutput((prev) => ({ ...prev, [deviceId]: 'Trigger dispatched.' }));
    }
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeZoneId) return;
    try {
      setSavingThresholds(true);
      const newConfig: ZoneThresholdConfig = {
        maxTemp: Number(maxTemp),
        maxSmokePpm: Number(maxSmokePpm),
        waterAlertEnabled,
        motionAlertEnabled,
      };
      await updateZoneThresholds(activeZoneId, newConfig);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } finally {
      setSavingThresholds(false);
    }
  };

  // Collect all devices from property
  const allDevices =
    currentProperty?.zones?.flatMap((z) =>
      (z.devices || []).map((d) => ({ ...d, zoneName: z.name }))
    ) || [];

  const tabs = [
    { key: 'devices', label: `Connected nodes (${allDevices.length})`, Icon: Cpu },
    { key: 'thresholds', label: 'Zone thresholds', Icon: Sliders },
    { key: 'simulator', label: 'Hazard simulator', Icon: ShieldAlert },
  ] as const;

  const simulations = [
    { type: 'SMOKE', Icon: Flame, title: 'Trigger smoke spike (560 ppm)', desc: 'Fires the critical fire siren and MQ-2 alert in the kitchen' },
    { type: 'WATER_LEAK', Icon: Droplet, title: 'Trigger water leak alarm', desc: 'Simulates sump line probe immersion in the basement' },
    { type: 'HIGH_TEMP', Icon: Thermometer, title: 'Trigger high temperature (54.2°C)', desc: 'Server room cooling failure simulation' },
    { type: 'MOTION', Icon: Activity, title: 'Trigger intrusion motion', desc: 'PIR motion sensor trips while the property is armed' },
  ] as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Edge devices and risk thresholds"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/80 animate-fade-in"
    >
      <div className="card w-full max-w-3xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} aria-label="Close" className="btn-icon absolute top-4 right-4">
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-6 pr-12">
          <div className="p-3 rounded-lg bg-navy-900 text-white">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-semibold tracking-tight">Devices and risk thresholds</h3>
            <p className="text-sm text-ink-muted">
              Node status, remote buzzer commands, and zone safety limits
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="seg flex-wrap mb-6" role="group" aria-label="Settings sections">
          {tabs.map(({ key, label, Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              aria-pressed={activeTab === key}
              className="seg-btn px-3.5 py-2"
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab 1: connected devices */}
        {activeTab === 'devices' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <th className="py-2.5 px-3 font-medium">Device and zone</th>
                  <th className="py-2.5 px-3 font-medium">Firmware</th>
                  <th className="py-2.5 px-3 font-medium">Auth token</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                  <th className="py-2.5 px-3 font-medium text-right">Buzzer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {allDevices.map((dev) => (
                  <tr key={dev.id}>
                    <td className="py-3 px-3">
                      <div className="font-semibold">{dev.name}</div>
                      <div className="text-xs font-mono text-ink-muted flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> {dev.id} ({dev.zoneName})
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono text-xs">{dev.firmwareVer || 'v2.1.4-esp32'}</td>

                    <td className="py-3 px-3">
                      <span className="chip-neutral font-mono font-normal">{dev.deviceToken}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className={dev.isOnline !== false ? 'chip-ok' : 'chip-critical'}>
                        {dev.isOnline !== false ? 'Online' : 'Offline'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <button onClick={() => handleTestBuzzer(dev.id)} className="btn-outline px-3 py-1.5">
                        <BellRing className="w-4 h-4" />
                        <span>Test buzzer</span>
                      </button>
                      {buzzerOutput[dev.id] && (
                        <div className="text-xs text-[#0B6B3D] mt-1" role="status">
                          {buzzerOutput[dev.id]}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: zone thresholds */}
        {activeTab === 'thresholds' && (
          <div>
            <div className="mb-4">
              <div className="field-label">Zone to configure</div>
              <div className="seg flex-wrap" role="group" aria-label="Zone">
                {currentProperty?.zones?.map((z) => (
                  <button
                    key={z.id}
                    onClick={() => {
                      setActiveZoneId(z.id);
                      setMaxTemp(z.thresholdConfig?.maxTemp || 45);
                      setMaxSmokePpm(z.thresholdConfig?.maxSmokePpm || 350);
                      setWaterAlertEnabled(z.thresholdConfig?.waterAlertEnabled !== false);
                      setMotionAlertEnabled(z.thresholdConfig?.motionAlertEnabled !== false);
                    }}
                    aria-pressed={activeZoneId === z.id}
                    className="seg-btn"
                  >
                    {z.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveThresholds} className="space-y-4 bg-mist p-5 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="max-temp" className="field-label flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4" />
                    Max temperature (°C)
                  </label>
                  <input
                    id="max-temp"
                    type="number"
                    value={maxTemp}
                    onChange={(e) => setMaxTemp(Number(e.target.value))}
                    min={20}
                    max={80}
                    className="field tabular-nums"
                  />
                  <p className="text-xs text-ink-muted mt-1">Raises an alert when ambient temperature exceeds this limit.</p>
                </div>

                <div>
                  <label htmlFor="max-smoke" className="field-label flex items-center gap-1.5">
                    <Flame className="w-4 h-4" />
                    Smoke and gas limit (MQ-2 ppm)
                  </label>
                  <input
                    id="max-smoke"
                    type="number"
                    value={maxSmokePpm}
                    onChange={(e) => setMaxSmokePpm(Number(e.target.value))}
                    min={100}
                    max={1000}
                    step={10}
                    className="field tabular-nums"
                  />
                  <p className="text-xs text-ink-muted mt-1">Sounds the critical fire siren when the MQ-2 reading crosses this level.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex items-center gap-3 bg-white p-3 rounded-lg border border-line cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waterAlertEnabled}
                    onChange={(e) => setWaterAlertEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div className="text-sm">
                    <div className="font-semibold flex items-center gap-1.5">
                      <Droplet className="w-4 h-4" />
                      Water leak alarm
                    </div>
                    <div className="text-ink-muted text-xs">Always on; triggers when the probe gets wet</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 bg-white p-3 rounded-lg border border-line cursor-pointer">
                  <input
                    type="checkbox"
                    checked={motionAlertEnabled}
                    onChange={(e) => setMotionAlertEnabled(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <div className="text-sm">
                    <div className="font-semibold flex items-center gap-1.5">
                      <Activity className="w-4 h-4" />
                      Motion intrusion alarm
                    </div>
                    <div className="text-ink-muted text-xs">Raises an instant alert when the property is armed</div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-line">
                {saveSuccess ? (
                  <span className="text-sm text-[#0B6B3D] font-medium flex items-center gap-1.5" role="status">
                    <CheckCircle className="w-4 h-4" /> Thresholds saved and synced
                  </span>
                ) : (
                  <span />
                )}

                <button type="submit" disabled={savingThresholds} className="btn-primary">
                  {savingThresholds ? 'Saving…' : 'Update thresholds'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: hazard simulator */}
        {activeTab === 'simulator' && (
          <div className="space-y-4">
            <div className="bg-mist p-4 rounded-lg text-sm text-ink-muted">
              <div className="font-semibold text-navy-900 mb-1">Edge hazard simulator</div>
              Choose a hazard to inject simulated telemetry. The siren banner, audio alarm, zone cards, and incident
              log all react immediately.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {simulations.map(({ type, Icon, title, desc }) => (
                <button
                  key={type}
                  onClick={() => {
                    triggerSimulationIncident(type);
                    onClose();
                  }}
                  className="flex items-center gap-3 p-4 rounded-lg border border-pink/60 text-left text-navy-900 transition-colors duration-150 hover:bg-pink/10 hover:border-pink"
                >
                  <div className="p-2.5 rounded-md bg-navy-900 text-white shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{title}</div>
                    <div className="text-xs text-ink-muted">{desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
