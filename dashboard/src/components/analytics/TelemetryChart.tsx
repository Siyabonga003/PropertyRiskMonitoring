import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Area,
  AreaChart,
} from 'recharts';
import type { ChartDataPoint, TelemetryReading } from '../../types/telemetry';
import { telemetryService } from '../../services/api';
import { Flame, Droplets, Thermometer, RefreshCw } from 'lucide-react';

interface Props {
  deviceId?: string;
  latestTelemetry?: Record<string, TelemetryReading>;
}

// Series colours stay inside the navy family, plus amber for smoke to match its status chip.
const COLORS = {
  temperature: '#12214A',
  humidity: '#5B84C4',
  smoke: '#E8A100',
  grid: '#E5EAF4',
  axis: '#53607F',
};

const tooltipStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #DCE2EF',
  borderRadius: '0.5rem',
  fontSize: '12px',
  color: '#0B1633',
  boxShadow: '0 4px 16px rgba(6, 12, 31, 0.12)',
};

export const TelemetryChart: React.FC<Props> = ({ deviceId = 'ESP32_KITCHEN_01', latestTelemetry }) => {
  const [range, setRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeMetric, setActiveMetric] = useState<'all' | 'temperature' | 'smoke' | 'humidity'>('all');

  // Load historical data whenever range or deviceId changes
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const history = await telemetryService.getHistory(deviceId, range);
        if (isMounted) setData(history);
      } catch (err) {
        console.warn('Telemetry chart fetch fallback:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [deviceId, range]);

  // Append new real-time points when WebSocket telemetry arrives
  useEffect(() => {
    if (!latestTelemetry || !deviceId) return;
    const live = latestTelemetry[deviceId];
    if (!live) return;

    setData((prev) => {
      if (prev.length === 0) return prev;
      const lastPoint = prev[prev.length - 1];
      const now = new Date();
      const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // If within 15 seconds, update in place; otherwise append
      const lastPointDate = new Date(lastPoint.timestamp).getTime();
      if (Math.abs(now.getTime() - lastPointDate) < 15000) {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...lastPoint,
          temperature: live.temperature,
          humidity: live.humidity,
          smokePpm: live.smokePpm,
        };
        return updated;
      }

      const newPoint: ChartDataPoint = {
        timestamp: now.toISOString(),
        timeFormatted,
        temperature: live.temperature,
        humidity: live.humidity,
        smokePpm: live.smokePpm,
      };

      // Keep fixed length
      return [...prev.slice(1), newPoint];
    });
  }, [latestTelemetry, deviceId]);

  const metrics = [
    { key: 'all', label: 'All signals', Icon: null },
    { key: 'temperature', label: 'Temp', Icon: Thermometer },
    { key: 'smoke', label: 'Smoke', Icon: Flame },
    { key: 'humidity', label: 'Humidity', Icon: Droplets },
  ] as const;

  const ranges = [
    { key: '1h', label: '1 hour' },
    { key: '24h', label: '24 hours' },
    { key: '7d', label: '7 days' },
  ] as const;

  // Live updates replace points frequently, so the line draws once rather than re-animating.
  const lineProps = { type: 'monotone' as const, strokeWidth: 2, dot: false, activeDot: { r: 5 }, isAnimationActive: false };

  return (
    <div className="card p-5">
      {/* Header and controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-line pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight">Environmental telemetry</h3>
            {isLoading && <RefreshCw className="w-3.5 h-3.5 text-ink-muted animate-spin" />}
          </div>
          <p className="text-sm text-ink-muted mt-0.5">Multi-sensor history with a live WebSocket stream</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="seg" role="group" aria-label="Metric">
            {metrics.map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveMetric(key)}
                aria-pressed={activeMetric === key}
                className="seg-btn px-2.5 py-1"
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                {label}
              </button>
            ))}
          </div>

          <div className="seg" role="group" aria-label="Time range">
            {ranges.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setRange(key)}
                aria-pressed={range === key}
                className="seg-btn px-2.5 py-1"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {activeMetric === 'smoke' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="smokeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.smoke} stopOpacity={0.35} />
                  <stop offset="95%" stopColor={COLORS.smoke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="timeFormatted" stroke={COLORS.axis} tick={{ fontSize: 11 }} />
              <YAxis stroke={COLORS.axis} tick={{ fontSize: 11 }} unit=" ppm" />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area
                type="monotone"
                dataKey="smokePpm"
                name="Smoke and combustible gas (ppm)"
                stroke={COLORS.smoke}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#smokeGradient)"
                isAnimationActive={false}
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
              <XAxis dataKey="timeFormatted" stroke={COLORS.axis} tick={{ fontSize: 11 }} />
              <YAxis stroke={COLORS.axis} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: '12px' }} />

              {(activeMetric === 'all' || activeMetric === 'temperature') && (
                <Line {...lineProps} dataKey="temperature" name="Temperature (°C)" stroke={COLORS.temperature} />
              )}

              {(activeMetric === 'all' || activeMetric === 'humidity') && (
                <Line {...lineProps} dataKey="humidity" name="Humidity (% RH)" stroke={COLORS.humidity} />
              )}

              {activeMetric === 'all' && (
                <Line {...lineProps} dataKey="smokePpm" name="Smoke (MQ-2 ppm)" stroke={COLORS.smoke} />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
