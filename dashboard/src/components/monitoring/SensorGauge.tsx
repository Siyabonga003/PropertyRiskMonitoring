import React from 'react';
import { Thermometer, Droplets, Wind } from 'lucide-react';

interface TempGaugeProps {
  temperature: number | null;
  maxThreshold?: number;
}

export const TemperatureGauge: React.FC<TempGaugeProps> = ({ temperature, maxThreshold = 50 }) => {
  if (temperature === null || temperature === undefined) {
    return (
      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-center">
        <span className="text-xs text-slate-500">Temp: N/A</span>
      </div>
    );
  }

  const isCritical = temperature >= maxThreshold;
  const isWarning = !isCritical && temperature > 30;

  const colorClass = isCritical
    ? 'text-rose-400 border-rose-500/40 bg-rose-950/20'
    : isWarning
    ? 'text-amber-400 border-amber-500/40 bg-amber-950/20'
    : 'text-emerald-400 border-emerald-500/40 bg-emerald-950/20';

  const barColor = isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';

  const percentage = Math.min(100, Math.max(0, (temperature / 60) * 100));

  return (
    <div className={`rounded-xl p-3.5 border ${colorClass} transition-all`}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Thermometer className="w-4 h-4 text-slate-300" />
          Temperature
        </span>
        <span className="text-[11px] font-mono">Max: {maxThreshold}°C</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-black tracking-tight text-white font-mono">
          {temperature.toFixed(1)}
          <span className="text-base font-normal text-slate-400 ml-0.5">°C</span>
        </div>
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
            isCritical
              ? 'bg-rose-500 text-white animate-pulse'
              : isWarning
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-emerald-500/20 text-emerald-300'
          }`}
        >
          {isCritical ? 'CRITICAL' : isWarning ? 'WARM' : 'NORMAL'}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mt-2.5 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface HumidityGaugeProps {
  humidity: number | null;
}

export const HumidityGauge: React.FC<HumidityGaugeProps> = ({ humidity }) => {
  if (humidity === null || humidity === undefined) {
    return (
      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-center">
        <span className="text-xs text-slate-500">Humidity: N/A</span>
      </div>
    );
  }

  const percentage = Math.min(100, Math.max(0, humidity));

  return (
    <div className="rounded-xl p-3.5 border border-cyan-500/30 bg-cyan-950/20 transition-all">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Droplets className="w-4 h-4 text-cyan-300" />
          Humidity
        </span>
        <span className="text-[11px] font-mono">Optimal 30-60%</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-black tracking-tight text-white font-mono">
          {humidity.toFixed(1)}
          <span className="text-base font-normal text-slate-400 ml-0.5">%</span>
        </div>
        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
          RH
        </span>
      </div>

      {/* Bar */}
      <div className="mt-2.5 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-cyan-500 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface SmokeGaugeProps {
  smokePpm: number | null;
  maxThreshold?: number;
}

export const SmokeGauge: React.FC<SmokeGaugeProps> = ({ smokePpm, maxThreshold = 350 }) => {
  if (smokePpm === null || smokePpm === undefined) {
    return (
      <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800 text-center">
        <span className="text-xs text-slate-500">Smoke: N/A</span>
      </div>
    );
  }

  const isCritical = smokePpm >= maxThreshold;
  const isWarning = !isCritical && smokePpm > 150;

  const colorClass = isCritical
    ? 'text-rose-400 border-rose-500/40 bg-rose-950/20'
    : isWarning
    ? 'text-amber-400 border-amber-500/40 bg-amber-950/20'
    : 'text-slate-300 border-slate-800 bg-slate-950/40';

  const barColor = isCritical ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500';

  const percentage = Math.min(100, Math.max(0, (smokePpm / (maxThreshold * 1.5)) * 100));

  return (
    <div className={`rounded-xl p-3.5 border ${colorClass} transition-all`}>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5 font-medium">
          <Wind className="w-4 h-4 text-slate-300" />
          Smoke & Gas (MQ-2)
        </span>
        <span className="text-[11px] font-mono">Limit: {maxThreshold} PPM</span>
      </div>

      <div className="mt-2 flex items-baseline justify-between">
        <div className="text-2xl font-black tracking-tight text-white font-mono">
          {Math.round(smokePpm)}
          <span className="text-xs font-normal text-slate-400 ml-1">PPM</span>
        </div>
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded ${
            isCritical
              ? 'bg-rose-600 text-white animate-pulse'
              : isWarning
              ? 'bg-amber-500/20 text-amber-300'
              : 'bg-slate-800 text-slate-400'
          }`}
        >
          {isCritical ? 'SMOKE SPIKE!' : isWarning ? 'ELEVATED' : 'CLEAR'}
        </span>
      </div>

      <div className="mt-2.5 w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};
