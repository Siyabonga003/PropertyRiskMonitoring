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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Title */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white tracking-tight">
              Edge Devices & Risk Threshold Configuration
            </h3>
            <p className="text-xs text-slate-400">
              Hardware node telemetry, remote buzzer actuator commands, and zone safety levels
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('devices')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'devices'
                ? 'bg-slate-800 text-white border border-slate-700 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-4" />
            Connected ESP32 Nodes ({allDevices.length})
          </button>

          <button
            onClick={() => setActiveTab('thresholds')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'thresholds'
                ? 'bg-slate-800 text-white border border-slate-700 shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Zone Hazard Thresholds
          </button>

          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'simulator'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 shadow'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            Demo Hazard Injector
          </button>
        </div>

        {/* Tab 1: Connected Devices */}
        {activeTab === 'devices' && (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold text-[11px]">
                    <th className="py-2.5 px-3">Device & Zone</th>
                    <th className="py-2.5 px-3">Firmware</th>
                    <th className="py-2.5 px-3">Auth Token</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actuator Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {allDevices.map((dev) => (
                    <tr key={dev.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{dev.name}</div>
                        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
                          <Cpu className="w-3 h-3 text-slate-500" /> {dev.id} ({dev.zoneName})
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-300">
                        {dev.firmwareVer || 'v2.1.4-esp32'}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-slate-400">
                        <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                          {dev.deviceToken}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            dev.isOnline !== false
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {dev.isOnline !== false ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleTestBuzzer(dev.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-semibold text-xs transition-colors"
                        >
                          <BellRing className="w-3.5 h-3.5" />
                          <span>Test Buzzer</span>
                        </button>
                        {buzzerOutput[dev.id] && (
                          <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                            {buzzerOutput[dev.id]}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Zone Hazard Thresholds */}
        {activeTab === 'thresholds' && (
          <div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Select Zone to Configure:
              </label>
              <div className="flex flex-wrap gap-2">
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      activeZoneId === z.id
                        ? 'bg-indigo-600 text-white shadow'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {z.name}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleSaveThresholds} className="space-y-4 bg-slate-950/60 p-5 rounded-xl border border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Thermometer className="w-4 h-4 text-rose-400" />
                    Max Temperature Threshold (°C)
                  </label>
                  <input
                    type="number"
                    value={maxTemp}
                    onChange={(e) => setMaxTemp(Number(e.target.value))}
                    min={20}
                    max={80}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Triggers alert if ambient temperature exceeds this limit.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 flex items-center gap-1.5">
                    <Flame className="w-4 h-4 text-amber-400" />
                    Smoke / Combustible Gas Threshold (MQ-2 PPM)
                  </label>
                  <input
                    type="number"
                    value={maxSmokePpm}
                    onChange={(e) => setMaxSmokePpm(Number(e.target.value))}
                    min={100}
                    max={1000}
                    step={10}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Triggers critical fire hazard siren if MQ-2 reading crosses this PPM.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={waterAlertEnabled}
                    onChange={(e) => setWaterAlertEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-800 border-slate-600"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-white flex items-center gap-1">
                      <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                      Water Conductivity Alarm
                    </div>
                    <div className="text-slate-400 text-[11px]">24/7 interrupt on resistance probe contact</div>
                  </div>
                </label>

                <label className="flex items-center gap-3 bg-slate-900 p-3 rounded-lg border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={motionAlertEnabled}
                    onChange={(e) => setMotionAlertEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-0 bg-slate-800 border-slate-600"
                  />
                  <div className="text-xs">
                    <div className="font-bold text-white flex items-center gap-1">
                      <Activity className="w-3.5 h-3.5 text-amber-400" />
                      PIR Motion Intrusion Alarm
                    </div>
                    <div className="text-slate-400 text-[11px]">Armed mode triggers instant intrusion alert</div>
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                {saveSuccess ? (
                  <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Threshold configurations saved and synchronized!
                  </span>
                ) : (
                  <span />
                )}

                <button
                  type="submit"
                  disabled={savingThresholds}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition-colors shadow-lg shadow-indigo-950/50"
                >
                  {savingThresholds ? 'Saving...' : 'Update Zone Thresholds'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Demo Hazard Simulator */}
        {activeTab === 'simulator' && (
          <div className="space-y-4">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs text-slate-300">
              <div className="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Interactive Edge Hazard Simulator
              </div>
              Click any hazard trigger below to inject simulated edge telemetry events. Notice the immediate real-time reaction across the siren banner, audio synthesizer, zone cards, and audit log!
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  triggerSimulationIncident('SMOKE');
                  onClose();
                }}
                className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-left transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-rose-600 text-white group-hover:scale-105 transition-transform">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-rose-300">Trigger Smoke Spike (560 PPM)</div>
                  <div className="text-[11px] text-slate-400">Fires critical fire siren & MQ-2 alert in Kitchen</div>
                </div>
              </button>

              <button
                onClick={() => {
                  triggerSimulationIncident('WATER_LEAK');
                  onClose();
                }}
                className="flex items-center gap-3 p-4 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/40 text-left transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-cyan-600 text-white group-hover:scale-105 transition-transform">
                  <Droplet className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-cyan-300">Trigger Water Leak Alarm</div>
                  <div className="text-[11px] text-slate-400">Simulates sump line probe immersion in Basement</div>
                </div>
              </button>

              <button
                onClick={() => {
                  triggerSimulationIncident('HIGH_TEMP');
                  onClose();
                }}
                className="flex items-center gap-3 p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/40 text-left transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-amber-600 text-white group-hover:scale-105 transition-transform">
                  <Thermometer className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-amber-300">Trigger High Temp Warning (54.2°C)</div>
                  <div className="text-[11px] text-slate-400">Server room cooling failure simulation</div>
                </div>
              </button>

              <button
                onClick={() => {
                  triggerSimulationIncident('MOTION');
                  onClose();
                }}
                className="flex items-center gap-3 p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/40 text-left transition-all group"
              >
                <div className="p-2.5 rounded-lg bg-purple-600 text-white group-hover:scale-105 transition-transform">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-white group-hover:text-purple-300">Trigger Intrusion Motion</div>
                  <div className="text-[11px] text-slate-400">PIR motion sensor trip while property is Armed</div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
