import type { Property } from '../types/property';
import type { Incident } from '../types/incidents';
import type { ChartDataPoint } from '../types/telemetry';

export const INITIAL_PROPERTY: Property = {
  id: 'prop-sunset-hq',
  name: 'School of Engineering and Technology (SET)',
  address: 'School of Engineering and Technology, Great East Road Campus',
  armingState: 'ARMED_AWAY',
  zones: [
    {
      id: 'zone-kitchen',
      propertyId: 'prop-sunset-hq',
      name: 'Kitchen & Pantry',
      thresholdConfig: {
        maxTemp: 45,
        minTemp: 5,
        maxSmokePpm: 350,
        waterAlertEnabled: true,
        motionAlertEnabled: true,
      },
      devices: [
        {
          id: 'ESP32_KITCHEN_01',
          name: 'Kitchen Sensor Node 1',
          zoneId: 'zone-kitchen',
          deviceToken: 'tok_esp32_k1t99z',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          firmwareVer: 'v2.1.4-esp32',
          latestReading: {
            deviceId: 'ESP32_KITCHEN_01',
            recordedAt: new Date().toISOString(),
            temperature: 24.6,
            humidity: 48.2,
            smokePpm: 42,
            waterDetected: false,
            motionDetected: false,
            wifiRssi: -58,
          },
        },
      ],
    },
    {
      id: 'zone-server',
      propertyId: 'prop-sunset-hq',
      name: 'Server Room & IT Rack',
      thresholdConfig: {
        maxTemp: 32,
        minTemp: 10,
        maxSmokePpm: 250,
        waterAlertEnabled: true,
        motionAlertEnabled: true,
      },
      devices: [
        {
          id: 'ESP32_SERVER_02',
          name: 'Rack 1 Environmental Pod',
          zoneId: 'zone-server',
          deviceToken: 'tok_esp32_s8v21x',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          firmwareVer: 'v2.1.4-esp32',
          latestReading: {
            deviceId: 'ESP32_SERVER_02',
            recordedAt: new Date().toISOString(),
            temperature: 28.1,
            humidity: 39.5,
            smokePpm: 31,
            waterDetected: false,
            motionDetected: false,
            wifiRssi: -48,
          },
        },
      ],
    },
    {
      id: 'zone-basement',
      propertyId: 'prop-sunset-hq',
      name: 'Basement & Utility Vault',
      thresholdConfig: {
        maxTemp: 40,
        minTemp: 2,
        maxSmokePpm: 400,
        waterAlertEnabled: true,
        motionAlertEnabled: true,
      },
      devices: [
        {
          id: 'ESP32_BASEMENT_03',
          name: 'Sump Pump & Main Line Probe',
          zoneId: 'zone-basement',
          deviceToken: 'tok_esp32_b4m33q',
          isOnline: true,
          lastSeenAt: new Date().toISOString(),
          firmwareVer: 'v2.0.9-esp32',
          latestReading: {
            deviceId: 'ESP32_BASEMENT_03',
            recordedAt: new Date().toISOString(),
            temperature: 18.2,
            humidity: 62.8,
            smokePpm: 28,
            waterDetected: false,
            motionDetected: false,
            wifiRssi: -72,
          },
        },
      ],
    },
  ],
};

export const INITIAL_INCIDENTS: Incident[] = [
  {
    id: 'inc-9921',
    propertyId: 'prop-sunset-hq',
    deviceId: 'ESP32_SERVER_02',
    hazardType: 'HIGH_TEMP',
    severity: 'WARNING',
    status: 'ACTIVE',
    readingValue: 33.4,
    details: 'Ambient temperature reached 33.4°C exceeding threshold of 32°C',
    startedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    device: {
      id: 'ESP32_SERVER_02',
      name: 'Rack 1 Environmental Pod',
      zoneId: 'zone-server',
      zone: {
        id: 'zone-server',
        name: 'Server Room & IT Rack',
      },
    },
  },
  {
    id: 'inc-9918',
    propertyId: 'prop-sunset-hq',
    deviceId: 'ESP32_BASEMENT_03',
    hazardType: 'WATER_LEAK',
    severity: 'CRITICAL',
    status: 'ACKNOWLEDGED',
    readingValue: 1.0,
    details: 'Water sensor resistance probe triggered near secondary sump line',
    startedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    acknowledgedBy: 'Admin Operator',
    device: {
      id: 'ESP32_BASEMENT_03',
      name: 'Sump Pump & Main Line Probe',
      zoneId: 'zone-basement',
      zone: {
        id: 'zone-basement',
        name: 'Basement & Utility Vault',
      },
    },
  },
  {
    id: 'inc-9890',
    propertyId: 'prop-sunset-hq',
    deviceId: 'ESP32_KITCHEN_01',
    hazardType: 'SMOKE',
    severity: 'CRITICAL',
    status: 'RESOLVED',
    readingValue: 480,
    details: 'MQ-2 detected smoke spike at 480 PPM during cooking cycle',
    startedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 2.8 * 3600 * 1000).toISOString(),
    acknowledgedBy: 'Admin Operator',
    resolvedAt: new Date(Date.now() - 2.5 * 3600 * 1000).toISOString(),
    device: {
      id: 'ESP32_KITCHEN_01',
      name: 'Kitchen Sensor Node 1',
      zoneId: 'zone-kitchen',
      zone: {
        id: 'zone-kitchen',
        name: 'Kitchen & Pantry',
      },
    },
  },
];

export function generateHistoricalTelemetry(range: '1h' | '24h' | '7d'): ChartDataPoint[] {
  const points: ChartDataPoint[] = [];
  const now = Date.now();
  const count = range === '1h' ? 20 : range === '24h' ? 24 : 28;
  const stepMs = range === '1h' ? 3 * 60 * 1000 : range === '24h' ? 60 * 60 * 1000 : 6 * 60 * 60 * 1000;

  for (let i = count; i >= 0; i--) {
    const timestampMs = now - i * stepMs;
    const date = new Date(timestampMs);

    const timeFormatted =
      range === '1h'
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : range === '24h'
        ? `${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;

    // Realistic variation
    const baseTemp = 24.0 + Math.sin(i * 0.4) * 2.5 + (Math.random() - 0.5);
    const baseHumidity = 48.0 + Math.cos(i * 0.3) * 6 + (Math.random() - 0.5) * 2;
    const baseSmoke = 35 + Math.floor(Math.random() * 15) + (i === 5 && range === '1h' ? 120 : 0);

    points.push({
      timestamp: date.toISOString(),
      timeFormatted,
      temperature: Number(baseTemp.toFixed(1)),
      humidity: Number(baseHumidity.toFixed(1)),
      smokePpm: Math.round(baseSmoke),
    });
  }

  return points;
}
