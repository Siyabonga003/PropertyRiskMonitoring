import React from 'react';
import { Thermometer, Droplets, Wind } from 'lucide-react';

type Level = 'normal' | 'warn' | 'critical';

const BAR: Record<Level, string> = {
  normal: 'bg-navy-600',
  warn: 'bg-status-warn',
  critical: 'bg-status-critical',
};

const Unavailable: React.FC<{ label: string }> = ({ label }) => (
  <div className="bg-mist rounded-lg p-3.5 text-center">
    <span className="text-sm text-ink-muted">{label}: not available</span>
  </div>
);

const Bar: React.FC<{ percent: number; level: Level }> = ({ percent, level }) => (
  <div className="mt-3 w-full bg-line rounded-full h-1.5 overflow-hidden">
    <div className={`h-full transition-[width] duration-500 ${BAR[level]}`} style={{ width: `${percent}%` }} />
  </div>
);

interface TempGaugeProps {
  temperature: number | null;
  maxThreshold?: number;
}

export const TemperatureGauge: React.FC<TempGaugeProps> = ({ temperature, maxThreshold = 50 }) => {
  if (temperature === null || temperature === undefined) return <Unavailable label="Temperature" />;

  const isCritical = temperature >= maxThreshold;
  const isWarning = !isCritical && temperature > 30;
  const level: Level = isCritical ? 'critical' : isWarning ? 'warn' : 'normal';
  const percentage = Math.min(100, Math.max(0, (temperature / 60) * 100));

  return (
    <div className="bg-mist rounded-lg p-3.5">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <Thermometer className="w-4 h-4" />
          Temperature
        </span>
        <span className="text-xs">Max {maxThreshold}°C</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {temperature.toFixed(1)}
          <span className="text-base font-normal text-ink-muted ml-0.5">°C</span>
        </div>
        <span className={isCritical ? 'chip-solid-critical' : isWarning ? 'chip-warn' : 'chip-ok'}>
          {isCritical ? 'Critical' : isWarning ? 'Warm' : 'Normal'}
        </span>
      </div>

      <Bar percent={percentage} level={level} />
    </div>
  );
};

interface HumidityGaugeProps {
  humidity: number | null;
}

export const HumidityGauge: React.FC<HumidityGaugeProps> = ({ humidity }) => {
  if (humidity === null || humidity === undefined) return <Unavailable label="Humidity" />;

  const percentage = Math.min(100, Math.max(0, humidity));

  return (
    <div className="bg-mist rounded-lg p-3.5">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <Droplets className="w-4 h-4" />
          Humidity
        </span>
        <span className="text-xs">Optimal 30–60%</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {humidity.toFixed(1)}
          <span className="text-base font-normal text-ink-muted ml-0.5">%</span>
        </div>
        <span className="chip-neutral">RH</span>
      </div>

      <Bar percent={percentage} level="normal" />
    </div>
  );
};

interface SmokeGaugeProps {
  smokePpm: number | null;
  maxThreshold?: number;
}

export const SmokeGauge: React.FC<SmokeGaugeProps> = ({ smokePpm, maxThreshold = 350 }) => {
  if (smokePpm === null || smokePpm === undefined) return <Unavailable label="Smoke" />;

  const isCritical = smokePpm >= maxThreshold;
  const isWarning = !isCritical && smokePpm > 150;
  const level: Level = isCritical ? 'critical' : isWarning ? 'warn' : 'normal';
  const percentage = Math.min(100, Math.max(0, (smokePpm / (maxThreshold * 1.5)) * 100));

  return (
    <div className="bg-mist rounded-lg p-3.5">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span className="flex items-center gap-1.5 font-medium">
          <Wind className="w-4 h-4" />
          Smoke and gas
        </span>
        <span className="text-xs">Limit {maxThreshold} ppm</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-semibold tabular-nums">
          {Math.round(smokePpm)}
          <span className="text-xs font-normal text-ink-muted ml-1">ppm</span>
        </div>
        <span className={isCritical ? 'chip-solid-critical' : isWarning ? 'chip-warn' : 'chip-ok'}>
          {isCritical ? 'Smoke spike' : isWarning ? 'Elevated' : 'Clear'}
        </span>
      </div>

      <Bar percent={percentage} level={level} />
    </div>
  );
};
