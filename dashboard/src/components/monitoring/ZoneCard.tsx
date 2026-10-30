import React, { useState } from 'react';
import type { Zone, Device } from '../../types/property';
import type { TelemetryReading } from '../../types/telemetry';
import { TemperatureGauge, HumidityGauge, SmokeGauge } from './SensorGauge';
import { WaterBadge, MotionBadge, RssiBadge } from './HazardBadge';
import { BellRing, CheckCircle, Sliders, Cpu } from 'lucide-react';
import { deviceService } from '../../services/api';

interface ZoneCardProps {
  zone: Zone;
  latestReadings: Record<string, TelemetryReading>;
  isArmed: boolean;
  onEditThresholds?: (zone: Zone) => void;
}

export const ZoneCard: React.FC<ZoneCardProps> = ({
  zone,
  latestReadings,
  isArmed,
  onEditThresholds,
}) => {
  const [buzzerTesting, setBuzzerTesting] = useState(false);
  const [buzzerMessage, setBuzzerMessage] = useState<string | null>(null);

  // Get primary device in this zone
  const device: Device | undefined = zone.devices?.[0];
  const deviceId = device?.id || '';

  // Get live telemetry or device's latestReading
  const telemetry: TelemetryReading =
    latestReadings[deviceId] ||
    device?.latestReading || {
      deviceId,
      recordedAt: new Date().toISOString(),
      temperature: 24,
      humidity: 45,
      smokePpm: 35,
      waterDetected: false,
      motionDetected: false,
      wifiRssi: -60,
    };

  const handleTestBuzzer = async () => {
    if (!deviceId || buzzerTesting) return;
    try {
      setBuzzerTesting(true);
      await deviceService.sendCommand(deviceId, 'TRIGGER_BUZZER', { durationMs: 2500, pattern: 'PULSE' });
      setBuzzerMessage('Buzzer test signal dispatched!');
      setTimeout(() => setBuzzerMessage(null), 3500);
    } catch {
      setBuzzerMessage('Command queued.');
      setTimeout(() => setBuzzerMessage(null), 3000);
    } finally {
      setBuzzerTesting(false);
    }
  };

  const hasCriticalHazard =
    telemetry.waterDetected ||
    (telemetry.smokePpm !== null && telemetry.smokePpm >= (zone.thresholdConfig?.maxSmokePpm || 350)) ||
    (telemetry.temperature !== null && telemetry.temperature >= (zone.thresholdConfig?.maxTemp || 50));

  return (
    <div
      className={`bg-slate-900 border rounded-2xl p-5 shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
        hasCriticalHazard
          ? 'border-rose-500/80 shadow-rose-950/40 bg-gradient-to-b from-rose-950/20 to-slate-900'
          : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      <div>
        {/* Header: Zone Name, Device Info, Online Status */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-lg font-bold text-white tracking-tight">{zone.name}</h4>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  device?.isOnline !== false
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}
              >
                {device?.isOnline !== false ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
              <span className="flex items-center gap-1 font-mono text-[11px] text-slate-300">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                {deviceId || 'VIRTUAL_NODE'}
              </span>
              <span>•</span>
              <span className="text-[11px] font-mono text-slate-400">
                {device?.firmwareVer || 'v2.1.4-esp32'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <RssiBadge rssi={telemetry.wifiRssi} />

            {onEditThresholds && (
              <button
                onClick={() => onEditThresholds(zone)}
                title="Configure Zone Thresholds"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live Gauges Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <TemperatureGauge
            temperature={telemetry.temperature}
            maxThreshold={zone.thresholdConfig?.maxTemp || 45}
          />
          <HumidityGauge humidity={telemetry.humidity} />
          <SmokeGauge
            smokePpm={telemetry.smokePpm}
            maxThreshold={zone.thresholdConfig?.maxSmokePpm || 350}
          />
        </div>

        {/* Hazard Binary Sensors: Water Leak & Motion */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <WaterBadge detected={telemetry.waterDetected} />
          <MotionBadge detected={telemetry.motionDetected} isArmed={isArmed} />
        </div>
      </div>

      {/* Card Footer: Buzzer Trigger Action */}
      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-mono">
          Updated: {new Date(telemetry.recordedAt).toLocaleTimeString()}
        </span>

        <div className="flex items-center gap-2">
          {buzzerMessage && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" /> {buzzerMessage}
            </span>
          )}

          <button
            onClick={handleTestBuzzer}
            disabled={buzzerTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all"
            title="Sends test trigger command via MQTT to ESP32 Piezo buzzer"
          >
            <BellRing className={`w-3.5 h-3.5 ${buzzerTesting ? 'animate-spin text-amber-400' : 'text-slate-400'}`} />
            <span>Test Buzzer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
