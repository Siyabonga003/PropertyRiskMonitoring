import { prisma, getPrismaStatus } from './prisma';
import { storageFallback, IUser, IProperty, IZone, IDevice, ITelemetryReading, ITelemetryRollup, IIncident } from './storageFallback';
import { Prisma, Role, ArmingState, HazardType, IncidentSeverity, IncidentStatus } from '@prisma/client';

export class DatabaseAdapter {
  // --- USERS ---
  async findUserByEmail(email: string): Promise<IUser | null> {
    if (getPrismaStatus()) return prisma.user.findUnique({ where: { email } });
    return storageFallback.findUserByEmail(email);
  }

  async getUsersSafe() {
    if (getPrismaStatus()) {
      try { return await prisma.user.findMany({ select: { id: true, email: true, name: true, role: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' } }); }
      catch (e) { console.error('[DB] Admin user list failed:', e); return []; }
    }
    return storageFallback.getUsersSafe();
  }

  async findUserById(id: string): Promise<IUser | null> {
    if (getPrismaStatus()) return prisma.user.findUnique({ where: { id } });
    return storageFallback.findUserById(id);
  }

  async setUserRole(userId: string, role: Role): Promise<void> {
    if (getPrismaStatus()) {
      await prisma.user.update({ where: { id: userId }, data: { role } });
      return;
    }
    await storageFallback.setUserRole(userId, role);
  }

  async syncPropertyRole(userId: string): Promise<void> {
    if (getPrismaStatus()) {
      const [user, ownedCount, memberCount] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
        prisma.property.count({ where: { ownerId: userId } }),
        prisma.property.count({ where: { users: { some: { id: userId } } } }),
      ]);
      if (!user || user.role === Role.ADMIN) return;
      const role = ownedCount > 0 ? Role.PROPERTY_OWNER : memberCount > 0 ? Role.AUTHORIZED_DELEGATE : Role.PROPERTY_OWNER;
      await prisma.user.update({ where: { id: userId }, data: { role } });
      return;
    }
    await storageFallback.syncPropertyRole(userId);
  }

  async upsertPushToken(data: { userId: string; token: string; platform: string; enabled?: boolean }) {
    if (getPrismaStatus()) {
      return prisma.pushToken.upsert({
        where: { token: data.token },
        update: { userId: data.userId, platform: data.platform, enabled: data.enabled ?? true },
        create: data,
      });
    }
    return storageFallback.upsertPushToken(data);
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    if (getPrismaStatus()) { await prisma.pushToken.deleteMany({ where: { userId, token } }); return; }
    await storageFallback.removePushToken(userId, token);
  }

  async getEnabledPushTokens(userId: string) {
    if (getPrismaStatus()) {
      try { return await prisma.pushToken.findMany({ where: { userId, enabled: true } }); }
      catch (e) { console.warn('[DB] getEnabledPushTokens error, falling back:', e); }
    }
    return storageFallback.getEnabledPushTokens(userId);
  }

  async createUser(data: { email: string; name: string; passwordHash: string; role?: Role }): Promise<IUser> {
    if (getPrismaStatus()) {
      return prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
          role: data.role || Role.PROPERTY_OWNER,
        },
      });
    }
    return storageFallback.createUser({
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      role: data.role || Role.PROPERTY_OWNER,
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

  async getPropertiesForUser(userId: string, role: Role): Promise<IProperty[]> {
    if (role === Role.ADMIN) return this.getProperties();
    if (getPrismaStatus()) {
      try {
        return await prisma.property.findMany({
          where: { OR: [{ ownerId: userId }, { users: { some: { id: userId } } }] },
          include: { zones: { include: { devices: true } } },
        });
      } catch (e) { console.error('[DB] Scoped property query failed closed:', e); return []; }
    }
    return storageFallback.getPropertiesForUser(userId, false);
  }

  async canAccessProperty(propertyId: string, userId: string, role: Role): Promise<boolean> {
    if (role === Role.ADMIN) {
      if (getPrismaStatus()) {
        try { return (await prisma.property.count({ where: { id: propertyId } })) > 0; }
        catch (e) { console.error('[DB] Admin property existence check failed closed:', e); return false; }
      }
      return storageFallback.getPropertyById(propertyId).then((property) => property !== null);
    }
    if (getPrismaStatus()) {
      try {
        return (await prisma.property.count({
          where: { id: propertyId, OR: [{ ownerId: userId }, { users: { some: { id: userId } } }] },
        })) > 0;
      } catch (e) { console.error('[DB] Property authorization failed closed:', e); return false; }
    }
    return storageFallback.canAccessProperty(propertyId, userId, false);
  }

  async isPropertyOwner(propertyId: string, userId: string): Promise<boolean> {
    if (getPrismaStatus()) {
      try { return (await prisma.property.count({ where: { id: propertyId, ownerId: userId } })) > 0; }
      catch (e) { console.error('[DB] Owner authorization failed closed:', e); return false; }
    }
    return storageFallback.isPropertyOwner(propertyId, userId);
  }

  async setPropertyOwner(propertyId: string, userId: string): Promise<{ previousOwnerId: string | null } | null> {
    if (getPrismaStatus()) {
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const [property, owner] = await Promise.all([
          tx.property.findUnique({ where: { id: propertyId }, select: { ownerId: true } }),
          tx.user.findUnique({ where: { id: userId }, select: { id: true } }),
        ]);
        if (!property || !owner) return null;
        const disconnectIds = new Set<string>();
        if (property.ownerId && property.ownerId !== userId) disconnectIds.add(property.ownerId);
        disconnectIds.add(userId);
        await tx.property.update({
          where: { id: propertyId },
          data: {
            owner: { connect: { id: userId } },
            users: { disconnect: [...disconnectIds].map((id) => ({ id })) },
          },
        });
        return { previousOwnerId: property.ownerId };
      });
    }
    return storageFallback.setPropertyOwner(propertyId, userId);
  }

  async getPropertyUserIds(propertyId: string): Promise<string[]> {
    if (getPrismaStatus()) {
      try {
        const [property, admins] = await Promise.all([
          prisma.property.findUnique({ where: { id: propertyId }, include: { users: { select: { id: true } } } }),
          prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true } }),
        ]);
        if (!property) return [];
        return Array.from(new Set([...(property.ownerId ? [property.ownerId] : []), ...property.users.map((user) => user.id), ...admins.map((user) => user.id)]));
      } catch (e) { console.error('[DB] Property recipient lookup failed closed:', e); return []; }
    }
    return storageFallback.getPropertyUserIds(propertyId);
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

  async createProperty(data: { name: string; address?: string | null; armingState?: ArmingState }, ownerId: string): Promise<IProperty> {
    if (getPrismaStatus()) return prisma.property.create({ data: { ...data, owner: { connect: { id: ownerId } } } });
    return storageFallback.createProperty({ ...data, ownerId });
  }

  async getDelegates(propertyId: string): Promise<Array<{ id: string; email: string; name: string; role: Role }>> {
    if (getPrismaStatus()) {
      try {
        const property = await prisma.property.findUnique({
          where: { id: propertyId },
          include: { users: { select: { id: true, email: true, name: true, role: true } } },
        });
        if (!property) return [];
        return property.users.filter((user) => user.id !== property.ownerId);
      } catch (e) { console.error('[DB] Delegate query failed closed:', e); return []; }
    }
    return (await storageFallback.getDelegates(propertyId)).map((user) => ({ ...user, role: Role.AUTHORIZED_DELEGATE }));
  }

  async addDelegate(propertyId: string, userId: string): Promise<void> {
    if (getPrismaStatus()) {
      await prisma.property.update({ where: { id: propertyId }, data: { users: { connect: { id: userId } } } });
      return;
    }
    await storageFallback.addDelegate(propertyId, userId);
  }

  async removeDelegate(propertyId: string, userId: string): Promise<void> {
    if (getPrismaStatus()) {
      await prisma.property.update({ where: { id: propertyId }, data: { users: { disconnect: { id: userId } } } });
      return;
    }
    await storageFallback.removeDelegate(propertyId, userId);
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

  async getDevicesForUser(userId: string, role: Role): Promise<IDevice[]> {
    if (role === Role.ADMIN) return this.getDevices();
    if (getPrismaStatus()) {
      try {
        return await prisma.device.findMany({
          where: {
            zone: {
              is: {
                property: { is: { OR: [{ ownerId: userId }, { users: { some: { id: userId } } }] } },
              },
            },
          },
          include: { zone: { include: { property: true } } },
        });
      } catch (e) { console.error('[DB] Scoped device query failed closed:', e); return []; }
    }
    return storageFallback.getDevicesForUser(userId);
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

  async createDeviceEnrollment(data: { deviceId: string; name: string; deviceToken: string; pairingTokenHash: string; firmwareVer?: string | null; expiresAt: Date }) {
    if (getPrismaStatus()) {
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const [device, enrollment] = await Promise.all([
          tx.device.findUnique({ where: { id: data.deviceId }, select: { id: true } }),
          tx.deviceEnrollment.findUnique({ where: { deviceId: data.deviceId }, select: { deviceId: true } }),
        ]);
        if (device || enrollment) throw new Error('Device ID already registered or has a pending enrollment.');
        return tx.deviceEnrollment.create({ data });
      });
    }
    return storageFallback.createDeviceEnrollment(data);
  }

  async getEnrollmentByPairingHash(pairingTokenHash: string) {
    if (getPrismaStatus()) {
      return prisma.deviceEnrollment.findFirst({ where: { pairingTokenHash, claimedAt: null, expiresAt: { gt: new Date() } } });
    }
    return storageFallback.getEnrollmentByPairingHash(pairingTokenHash);
  }

  async claimDeviceEnrollment(deviceId: string, zoneId: string): Promise<IDevice | null> {
    if (getPrismaStatus()) {
      return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const enrollment = await tx.deviceEnrollment.findFirst({ where: { deviceId, claimedAt: null, expiresAt: { gt: new Date() } } });
        if (!enrollment) return null;
        const claimed = await tx.deviceEnrollment.updateMany({ where: { deviceId, claimedAt: null, expiresAt: { gt: new Date() } }, data: { claimedAt: new Date() } });
        if (claimed.count !== 1) return null;
        const device = await tx.device.create({ data: {
          id: enrollment.deviceId, name: enrollment.name, zoneId, deviceToken: enrollment.deviceToken,
          firmwareVer: enrollment.firmwareVer, isOnline: false,
        } });
        return device;
      });
    }
    return storageFallback.claimDeviceEnrollment(deviceId, zoneId);
  }

  async getPropertyIdForDevice(deviceId: string): Promise<string | null> {
    if (getPrismaStatus()) {
      try {
        const device = await prisma.device.findUnique({ where: { id: deviceId }, include: { zone: { select: { propertyId: true } } } });
        return device?.zone.propertyId || null;
      } catch (e) { console.error('[DB] Device ownership lookup failed closed:', e); return null; }
    }
    return storageFallback.getPropertyIdForDevice(deviceId);
  }

  async getPropertyIdForZone(zoneId: string): Promise<string | null> {
    if (getPrismaStatus()) {
      try { return (await prisma.zone.findUnique({ where: { id: zoneId }, select: { propertyId: true } }))?.propertyId || null; }
      catch (e) { console.error('[DB] Zone ownership lookup failed closed:', e); return null; }
    }
    return storageFallback.getPropertyIdForZone(zoneId);
  }

  async findDeviceByToken(deviceToken: string): Promise<IDevice | null> {
    if (getPrismaStatus()) {
      try { return await prisma.device.findUnique({ where: { deviceToken } }); }
      catch (e) { console.error('[DB] Device token verification failed:', e); return null; }
    }
    return storageFallback.findDeviceByToken(deviceToken);
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
    gasPpm?: number | null;
    flameDetected?: boolean;
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
            gasPpm: reading.gasPpm ?? null,
            flameDetected: reading.flameDetected || false,
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
          gasPpm: row.gasPpm,
          flameDetected: row.flameDetected,
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
      gasPpm: reading.gasPpm ?? null,
      flameDetected: reading.flameDetected || false,
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
            gasPpm: row.gasPpm,
            flameDetected: row.flameDetected,
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
          gasPpm: r.gasPpm,
          flameDetected: r.flameDetected,
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
          avgGasPpm: r.avgGasPpm,
          maxGasPpm: r.maxGasPpm,
          flameEvents: r.flameEvents,
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
            avgGasPpm: rollup.avgGasPpm,
            maxGasPpm: rollup.maxGasPpm,
            flameEvents: rollup.flameEvents,
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
            avgGasPpm: rollup.avgGasPpm,
            maxGasPpm: rollup.maxGasPpm,
            flameEvents: rollup.flameEvents,
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
          avgGasPpm: row.avgGasPpm,
          maxGasPpm: row.maxGasPpm,
          flameEvents: row.flameEvents,
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

  async getIncidents(filter?: { propertyId?: string; propertyIds?: string[]; status?: IncidentStatus }): Promise<IIncident[]> {
    if (getPrismaStatus()) {
      try {
        return await prisma.incident.findMany({
          where: {
            ...(filter?.propertyId ? { propertyId: filter.propertyId } : {}),
            ...(filter?.propertyIds ? { propertyId: { in: filter.propertyIds } } : {}),
            ...(filter?.status ? { status: filter.status } : {}),
          },
          orderBy: { startedAt: 'desc' },
          include: {
            device: { select: { id: true, name: true, zoneId: true, isOnline: true, lastSeenAt: true, firmwareVer: true } },
            property: { select: { id: true, name: true, address: true, ownerId: true } },
            userAck: { select: { id: true, name: true, email: true } },
          },
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
          include: {
            device: { select: { id: true, name: true, zoneId: true, isOnline: true, lastSeenAt: true, firmwareVer: true } },
            property: { select: { id: true, name: true, address: true, ownerId: true } },
            userAck: { select: { id: true, name: true, email: true } },
          },
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
