export type HazardType =
  | 'SMOKE'
  | 'WATER_LEAK'
  | 'HIGH_TEMP'
  | 'LOW_TEMP'
  | 'MOTION'
  | 'DEVICE_OFFLINE';

export type IncidentSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type IncidentStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Incident {
  id: string;
  propertyId: string;
  deviceId: string;
  hazardType: HazardType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  readingValue?: number | null;
  details?: string | null;
  startedAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  device?: {
    id: string;
    name: string;
    zoneId?: string;
    zone?: {
      id: string;
      name: string;
    };
  };
}
