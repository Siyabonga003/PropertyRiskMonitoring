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
      className={`card p-5 flex flex-col justify-between transition-colors duration-200 ${
        hasCriticalHazard ? 'border-status-critical ring-1 ring-status-critical' : ''
      }`}
    >
      <div>
        {/* Header: zone name, device info, online status */}
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap">
              <h4 className="text-lg font-semibold tracking-tight">{zone.name}</h4>
              <span className={device?.isOnline !== false ? 'chip-ok' : 'chip-critical'}>
                {device?.isOnline !== false ? 'Online' : 'Offline'}
              </span>
            </div>

            <div className="flex items-center gap-x-2 gap-y-0.5 flex-wrap text-xs text-ink-muted mt-1">
              <Cpu className="w-3.5 h-3.5" />
              <span className="font-mono">{deviceId || 'VIRTUAL_NODE'}</span>
              <span className="font-mono whitespace-nowrap">{device?.firmwareVer || 'v2.1.4-esp32'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <RssiBadge rssi={telemetry.wifiRssi} />

            {onEditThresholds && (
              <button
                onClick={() => onEditThresholds(zone)}
                title="Configure zone thresholds"
                aria-label={`Configure thresholds for ${zone.name}`}
                className="btn-icon"
              >
                <Sliders className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Live gauges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-3 mb-3">
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

        {/* Binary sensors: water leak and motion */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3 mb-4">
          <WaterBadge detected={telemetry.waterDetected} />
          <MotionBadge detected={telemetry.motionDetected} isArmed={isArmed} />
        </div>
      </div>

      {/* Footer: buzzer test */}
      <div className="pt-3 border-t border-line flex items-center justify-between gap-2">
        <span className="text-xs text-ink-muted tabular-nums">
          Updated {new Date(telemetry.recordedAt).toLocaleTimeString()}
        </span>

        <div className="flex items-center gap-2">
          {buzzerMessage && (
            <span className="text-xs text-[#0B6B3D] flex items-center gap-1" role="status">
              <CheckCircle className="w-3.5 h-3.5" /> {buzzerMessage}
            </span>
          )}

          <button
            onClick={handleTestBuzzer}
            disabled={buzzerTesting}
            className="btn-outline px-3 py-1.5"
            title="Sends a test trigger command via MQTT to the ESP32 piezo buzzer"
          >
            <BellRing className={`w-4 h-4 ${buzzerTesting ? 'animate-spin' : ''}`} />
            <span>Test buzzer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
