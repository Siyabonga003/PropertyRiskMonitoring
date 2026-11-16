import type { Incident } from './incidents';
import type { TelemetryReading } from './telemetry';

export type ArmingState = 'DISARMED' | 'ARMED_HOME' | 'ARMED_AWAY';

export interface ZoneThresholdConfig {
  maxTemp?: number;
  minTemp?: number;
  maxSmokePpm?: number;
  waterAlertEnabled?: boolean;
  motionAlertEnabled?: boolean;
}

export interface Device {
  id: string;
  name: string;
  zoneId: string;
  deviceToken: string;
  isOnline: boolean;
  lastSeenAt?: string | null;
  firmwareVer?: string | null;
  zone?: {
    id: string;
    name: string;
  };
  latestReading?: TelemetryReading;
}

export interface Zone {
  id: string;
  propertyId: string;
  name: string;
  thresholdConfig?: ZoneThresholdConfig | null;
  devices?: Device[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Property {
  id: string;
  name: string;
  address?: string | null;
  armingState: ArmingState;
  zones?: Zone[];
  incidents?: Incident[];
  createdAt?: string;
  updatedAt?: string;
}
