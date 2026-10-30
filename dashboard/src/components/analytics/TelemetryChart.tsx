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
import { Activity, Clock, Flame, Droplets, Thermometer, RefreshCw } from 'lucide-react';

interface Props {
  deviceId?: string;
  latestTelemetry?: Record<string, TelemetryReading>;
}

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

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
      {/* Chart Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white tracking-tight">
              Environmental & Risk Telemetry Streams
            </h3>
            {isLoading && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multi-sensor telemetry graph with live WebSockets stream
          </p>
        </div>

        {/* Metric Switcher & Time Range Selector */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Selector */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveMetric('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                activeMetric === 'all' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              All Signals
            </button>
            <button
              onClick={() => setActiveMetric('temperature')}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                activeMetric === 'temperature'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <Thermometer className="w-3.5 h-3.5" />
              Temp
            </button>
            <button
              onClick={() => setActiveMetric('smoke')}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                activeMetric === 'smoke' ? 'bg-amber-500 text-slate-950 shadow' : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              Smoke
            </button>
            <button
              onClick={() => setActiveMetric('humidity')}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                activeMetric === 'humidity' ? 'bg-cyan-500 text-slate-950 shadow' : 'text-slate-400 hover:text-cyan-400'
              }`}
            >
              <Droplets className="w-3.5 h-3.5" />
              Humidity
            </button>
          </div>

          {/* Time Range Selector */}
          <div className="flex items-center bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 text-slate-500 ml-1.5 mr-0.5" />
            <button
              onClick={() => setRange('1h')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                range === '1h' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              1 Hour
            </button>
            <button
              onClick={() => setRange('24h')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                range === '24h' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              24 Hours
            </button>
            <button
              onClick={() => setRange('7d')}
              className={`px-2.5 py-1 rounded-lg transition-colors ${
                range === '7d' ? 'bg-slate-700 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {activeMetric === 'smoke' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="smokeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timeFormatted" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} unit=" ppm" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Area
                type="monotone"
                dataKey="smokePpm"
                name="Smoke & Combustible Gas (PPM)"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#smokeGradient)"
              />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="timeFormatted" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '0.75rem',
                  fontSize: '12px',
                  color: '#f8fafc',
                }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />

              {(activeMetric === 'all' || activeMetric === 'temperature') && (
                <Line
                  type="monotone"
                  dataKey="temperature"
                  name="Temperature (°C)"
                  stroke="#f43f5e"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}

              {(activeMetric === 'all' || activeMetric === 'humidity') && (
                <Line
                  type="monotone"
                  dataKey="humidity"
                  name="Humidity (% RH)"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}

              {activeMetric === 'all' && (
                <Line
                  type="monotone"
                  dataKey="smokePpm"
                  name="Smoke (MQ-2 PPM)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
