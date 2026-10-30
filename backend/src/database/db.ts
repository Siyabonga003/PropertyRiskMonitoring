import { prisma, getPrismaStatus } from './prisma';
import { storageFallback, IUser, IProperty, IZone, IDevice, ITelemetryReading, ITelemetryRollup, IIncident } from './storageFallback';
import { Role, ArmingState, HazardType, IncidentSeverity, IncidentStatus } from '@prisma/client';

export class DatabaseAdapter {
  // --- USERS ---
  async findUserByEmail(email: string): Promise<IUser | null> {
    if (getPrismaStatus()) {
      try {
        const u = await prisma.user.findUnique({ where: { email } });
        if (u) return u;
      } catch (e) {
        console.warn('[DB] Prisma findUserByEmail error, falling back:', e);
      }
    }
    return storageFallback.findUserByEmail(email);
  }

  async findUserById(id: string): Promise<IUser | null> {
    if (getPrismaStatus()) {
      try {
        const u = await prisma.user.findUnique({ where: { id } });
        if (u) return u;
      } catch (e) {
        console.warn('[DB] Prisma findUserById error, falling back:', e);
      }
    }
    return storageFallback.findUserById(id);
  }

  async createUser(data: { email: string; name: string; passwordHash: string; role?: Role }): Promise<IUser> {
    if (getPrismaStatus()) {
      try {
        const u = await prisma.user.create({
          data: {
            email: data.email,
            name: data.name,
            passwordHash: data.passwordHash,
            role: data.role || Role.VIEWER,
          },
        });
        return u;
      } catch (e) {
        console.warn('[DB] Prisma createUser error, falling back:', e);
      }
    }
    return storageFallback.createUser({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role || Role.VIEWER,
    });
  }

  // --- PROPERTIES ---
  async getProperties(): Promise<IProperty[]> {
    if (getPrismaStatus()) {
      try {
        return await prisma.property.findMany({
          include: { zones: { include: { devices: true } } },
        });
      } catch (e) {
        console.warn('[DB] Prisma getProperties error, falling back:', e);
      }
    }
    return storageFallback.getProperties();
  }

  async getPropertyById(id: string): Promise<IProperty | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.property.findUnique({
          where: { id },
          include: { zones: { include: { devices: true } }, incidents: true },
        });
      } catch (e) {
        console.warn('[DB] Prisma getPropertyById error, falling back:', e);
      }
    }
    return storageFallback.getPropertyById(id);
  }

  async createProperty(data: { name: string; address?: string | null; armingState?: ArmingState }): Promise<IProperty> {
    if (getPrismaStatus()) {
      try {
        return await prisma.property.create({ data });
      } catch (e) {
        console.warn('[DB] Prisma createProperty error, falling back:', e);
      }
    }
    return storageFallback.createProperty(data);
  }

  async updatePropertyArming(id: string, armingState: ArmingState): Promise<IProperty | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.property.update({
          where: { id },
          data: { armingState },
        });
      } catch (e) {
        console.warn('[DB] Prisma updatePropertyArming error, falling back:', e);
      }
    }
    return storageFallback.updatePropertyArming(id, armingState);
  }

  // --- ZONES ---
  async getZonesByPropertyId(propertyId: string): Promise<IZone[]> {
    if (getPrismaStatus()) {
      try {
        return await prisma.zone.findMany({
          where: { propertyId },
          include: { devices: true },
        });
      } catch (e) {
        console.warn('[DB] Prisma getZonesByPropertyId error, falling back:', e);
      }
    }
    return storageFallback.getZonesByPropertyId(propertyId);
  }

  async getZoneById(id: string): Promise<IZone | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.zone.findUnique({ where: { id }, include: { devices: true } });
      } catch (e) {
        console.warn('[DB] Prisma getZoneById error, falling back:', e);
      }
    }
    return storageFallback.getZoneById(id);
  }

  async createZone(data: { propertyId: string; name: string; thresholdConfig?: any }): Promise<IZone> {
    if (getPrismaStatus()) {
      try {
        return await prisma.zone.create({ data });
      } catch (e) {
        console.warn('[DB] Prisma createZone error, falling back:', e);
      }
    }
    return storageFallback.createZone(data);
  }

  async updateZoneThresholds(id: string, thresholdConfig: any): Promise<IZone | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.zone.update({
          where: { id },
          data: { thresholdConfig },
        });
      } catch (e) {
        console.warn('[DB] Prisma updateZoneThresholds error, falling back:', e);
      }
    }
    return storageFallback.updateZoneThresholds(id, thresholdConfig);
  }

  // --- DEVICES ---
  async getDevices(): Promise<IDevice[]> {
    if (getPrismaStatus()) {
      try {
        return await prisma.device.findMany({
          include: { zone: { include: { property: true } } },
        });
      } catch (e) {
        console.warn('[DB] Prisma getDevices error, falling back:', e);
      }
    }
    return storageFallback.getDevices();
  }

  async getDeviceById(id: string): Promise<IDevice | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.device.findUnique({
          where: { id },
          include: { zone: { include: { property: true } } },
        });
      } catch (e) {
        console.warn('[DB] Prisma getDeviceById error, falling back:', e);
      }
    }
    return storageFallback.getDeviceById(id);
  }

  async upsertDevice(data: {
    id: string;
    name?: string;
    zoneId: string;
    deviceToken?: string;
    isOnline?: boolean;
    firmwareVer?: string;
  }): Promise<IDevice> {
    if (getPrismaStatus()) {
      try {
        return await prisma.device.upsert({
          where: { id: data.id },
          update: {
            name: data.name,
            zoneId: data.zoneId,
            deviceToken: data.deviceToken,
            isOnline: data.isOnline,
            firmwareVer: data.firmwareVer,
            lastSeenAt: new Date(),
          },
          create: {
            id: data.id,
            name: data.name || `Device ${data.id}`,
            zoneId: data.zoneId,
            deviceToken: data.deviceToken || `tok_${data.id}`,
            isOnline: data.isOnline ?? true,
            firmwareVer: data.firmwareVer || 'v1.0.0',
            lastSeenAt: new Date(),
          },
        });
      } catch (e) {
        console.warn('[DB] Prisma upsertDevice error, falling back:', e);
      }
    }
    return storageFallback.upsertDevice(data);
  }

  async setDeviceOnlineStatus(id: string, isOnline: boolean): Promise<IDevice | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.device.update({
          where: { id },
          data: { isOnline, lastSeenAt: new Date() },
        });
      } catch (e) {
        console.warn('[DB] Prisma setDeviceOnlineStatus error, falling back:', e);
      }
    }
    return storageFallback.setDeviceOnlineStatus(id, isOnline);
  }

  // --- TELEMETRY READINGS ---
  async addTelemetryReading(reading: {
    deviceId: string;
    recordedAt?: Date;
    temperature?: number | null;
    humidity?: number | null;
    smokePpm?: number | null;
    waterDetected?: boolean;
    motionDetected?: boolean;
    wifiRssi?: number | null;
  }): Promise<ITelemetryReading> {
    if (getPrismaStatus()) {
      try {
        const row = await prisma.telemetryReading.create({
          data: {
            deviceId: reading.deviceId,
            recordedAt: reading.recordedAt || new Date(),
            temperature: reading.temperature ?? null,
            humidity: reading.humidity ?? null,
            smokePpm: reading.smokePpm ?? null,
            waterDetected: reading.waterDetected || false,
            motionDetected: reading.motionDetected || false,
            wifiRssi: reading.wifiRssi ?? null,
          },
        });
        return {
          id: row.id.toString(),
          deviceId: row.deviceId,
          recordedAt: row.recordedAt,
          temperature: row.temperature,
          humidity: row.humidity,
          smokePpm: row.smokePpm,
          waterDetected: row.waterDetected,
          motionDetected: row.motionDetected,
          wifiRssi: row.wifiRssi,
        };
      } catch (e) {
        console.warn('[DB] Prisma addTelemetryReading error, falling back:', e);
      }
    }
    return storageFallback.addTelemetryReading({
      deviceId: reading.deviceId,
      recordedAt: reading.recordedAt,
      temperature: reading.temperature ?? null,
      humidity: reading.humidity ?? null,
      smokePpm: reading.smokePpm ?? null,
      waterDetected: reading.waterDetected || false,
      motionDetected: reading.motionDetected || false,
      wifiRssi: reading.wifiRssi ?? null,
    });
  }

  async getLatestTelemetry(deviceId?: string): Promise<ITelemetryReading | null> {
    if (getPrismaStatus()) {
      try {
        const row = await prisma.telemetryReading.findFirst({
          where: deviceId ? { deviceId } : {},
          orderBy: { recordedAt: 'desc' },
        });
        if (row) {
          return {
            id: row.id.toString(),
            deviceId: row.deviceId,
            recordedAt: row.recordedAt,
            temperature: row.temperature,
            humidity: row.humidity,
            smokePpm: row.smokePpm,
            waterDetected: row.waterDetected,
            motionDetected: row.motionDetected,
            wifiRssi: row.wifiRssi,
          };
        }
      } catch (e) {
        console.warn('[DB] Prisma getLatestTelemetry error, falling back:', e);
      }
    }
    return storageFallback.getLatestTelemetry(deviceId);
  }

  async getTelemetryHistory(deviceId?: string, limit = 100): Promise<ITelemetryReading[]> {
    if (getPrismaStatus()) {
      try {
        const rows = await prisma.telemetryReading.findMany({
          where: deviceId ? { deviceId } : {},
          orderBy: { recordedAt: 'desc' },
          take: limit,
        });
        return rows.reverse().map((r) => ({
          id: r.id.toString(),
          deviceId: r.deviceId,
          recordedAt: r.recordedAt,
          temperature: r.temperature,
          humidity: r.humidity,
          smokePpm: r.smokePpm,
          waterDetected: r.waterDetected,
          motionDetected: r.motionDetected,
          wifiRssi: r.wifiRssi,
        }));
      } catch (e) {
        console.warn('[DB] Prisma getTelemetryHistory error, falling back:', e);
      }
    }
    return storageFallback.getTelemetryHistory(deviceId, limit);
  }

  // --- ROLLUPS ---
  async getRollups(deviceId?: string): Promise<ITelemetryRollup[]> {
    if (getPrismaStatus()) {
      try {
        const rows = await prisma.telemetryRollup.findMany({
          where: deviceId ? { deviceId } : {},
          orderBy: { bucketStart: 'desc' },
          take: 100,
        });
        return rows.map((r) => ({
          id: r.id.toString(),
          deviceId: r.deviceId,
          bucketStart: r.bucketStart,
          avgTemp: r.avgTemp,
          minTemp: r.minTemp,
          maxTemp: r.maxTemp,
          avgHumidity: r.avgHumidity,
          avgSmokePpm: r.avgSmokePpm,
          maxSmokePpm: r.maxSmokePpm,
          waterEvents: r.waterEvents,
          motionEvents: r.motionEvents,
        }));
      } catch (e) {
        console.warn('[DB] Prisma getRollups error, falling back:', e);
      }
    }
    return storageFallback.getRollups(deviceId);
  }

  async saveRollup(rollup: Omit<ITelemetryRollup, 'id'>): Promise<ITelemetryRollup> {
    if (getPrismaStatus()) {
      try {
        const row = await prisma.telemetryRollup.upsert({
          where: {
            deviceId_bucketStart: {
              deviceId: rollup.deviceId,
              bucketStart: rollup.bucketStart,
            },
          },
          update: {
            avgTemp: rollup.avgTemp,
            minTemp: rollup.minTemp,
            maxTemp: rollup.maxTemp,
            avgHumidity: rollup.avgHumidity,
            avgSmokePpm: rollup.avgSmokePpm,
            maxSmokePpm: rollup.maxSmokePpm,
            waterEvents: rollup.waterEvents,
            motionEvents: rollup.motionEvents,
          },
          create: {
            deviceId: rollup.deviceId,
            bucketStart: rollup.bucketStart,
            avgTemp: rollup.avgTemp,
            minTemp: rollup.minTemp,
            maxTemp: rollup.maxTemp,
            avgHumidity: rollup.avgHumidity,
            avgSmokePpm: rollup.avgSmokePpm,
            maxSmokePpm: rollup.maxSmokePpm,
            waterEvents: rollup.waterEvents,
            motionEvents: rollup.motionEvents,
          },
        });
        return {
          id: row.id.toString(),
          deviceId: row.deviceId,
          bucketStart: row.bucketStart,
          avgTemp: row.avgTemp,
          minTemp: row.minTemp,
          maxTemp: row.maxTemp,
          avgHumidity: row.avgHumidity,
          avgSmokePpm: row.avgSmokePpm,
          maxSmokePpm: row.maxSmokePpm,
          waterEvents: row.waterEvents,
          motionEvents: row.motionEvents,
        };
      } catch (e) {
        console.warn('[DB] Prisma saveRollup error, falling back:', e);
      }
    }
    return storageFallback.saveRollup(rollup);
  }

  // --- INCIDENTS ---
  async createIncident(data: {
    propertyId: string;
    deviceId: string;
    hazardType: HazardType;
    severity: IncidentSeverity;
    readingValue?: number | null;
    details?: string | null;
  }): Promise<IIncident> {
    if (getPrismaStatus()) {
      try {
        return await prisma.incident.create({
          data: {
            propertyId: data.propertyId,
            deviceId: data.deviceId,
            hazardType: data.hazardType,
            severity: data.severity,
            readingValue: data.readingValue,
            details: data.details,
          },
        });
      } catch (e) {
        console.warn('[DB] Prisma createIncident error, falling back:', e);
      }
    }
    return storageFallback.createIncident(data);
  }

  async getIncidents(filter?: { propertyId?: string; status?: IncidentStatus }): Promise<IIncident[]> {
    if (getPrismaStatus()) {
      try {
        return await prisma.incident.findMany({
          where: {
            ...(filter?.propertyId ? { propertyId: filter.propertyId } : {}),
            ...(filter?.status ? { status: filter.status } : {}),
          },
          orderBy: { startedAt: 'desc' },
          include: { device: true, property: true, userAck: true },
        });
      } catch (e) {
        console.warn('[DB] Prisma getIncidents error, falling back:', e);
      }
    }
    return storageFallback.getIncidents(filter);
  }

  async getActiveIncidentByHazard(deviceId: string, hazardType: HazardType): Promise<IIncident | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.incident.findFirst({
          where: {
            deviceId,
            hazardType,
            status: { not: IncidentStatus.RESOLVED },
          },
        });
      } catch (e) {
        console.warn('[DB] Prisma getActiveIncidentByHazard error, falling back:', e);
      }
    }
    return storageFallback.getActiveIncidentByHazard(deviceId, hazardType);
  }

  async getIncidentById(id: string): Promise<IIncident | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.incident.findUnique({
          where: { id },
          include: { device: true, property: true },
        });
      } catch (e) {
        console.warn('[DB] Prisma getIncidentById error, falling back:', e);
      }
    }
    return storageFallback.getIncidentById(id);
  }

  async acknowledgeIncident(id: string, userId?: string): Promise<IIncident | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.incident.update({
          where: { id },
          data: {
            status: IncidentStatus.ACKNOWLEDGED,
            acknowledgedAt: new Date(),
            acknowledgedBy: userId,
          },
        });
      } catch (e) {
        console.warn('[DB] Prisma acknowledgeIncident error, falling back:', e);
      }
    }
    return storageFallback.acknowledgeIncident(id, userId);
  }

  async resolveIncident(id: string): Promise<IIncident | null> {
    if (getPrismaStatus()) {
      try {
        return await prisma.incident.update({
          where: { id },
          data: {
            status: IncidentStatus.RESOLVED,
            resolvedAt: new Date(),
          },
        });
      } catch (e) {
        console.warn('[DB] Prisma resolveIncident error, falling back:', e);
      }
    }
    return storageFallback.resolveIncident(id);
  }
}

export const db = new DatabaseAdapter();
