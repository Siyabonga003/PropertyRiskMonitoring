export interface TelemetryReading {
  id?: number | string;
  deviceId: string;
  recordedAt: string;
  temperature: number | null;
  humidity: number | null;
  smokePpm: number | null;
  waterDetected: boolean;
  motionDetected: boolean;
  wifiRssi: number | null;
}

export interface TelemetryPacket {
  deviceId: string;
  timestamp: number | string;
  metrics: {
    temperature: number;
    humidity: number;
    smoke_ppm: number;
    water_detected: boolean;
    motion_detected: boolean;
  };
  diagnostics?: {
    wifi_rssi?: number;
    uptime_seconds?: number;
    free_heap?: number;
  };
}

export interface ChartDataPoint {
  timestamp: string;
  timeFormatted: string;
  temperature: number | null;
  humidity: number | null;
  smokePpm: number | null;
}
