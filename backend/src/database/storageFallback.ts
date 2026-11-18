import { Role, ArmingState, HazardType, IncidentSeverity, IncidentStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

export interface IUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProperty {
  id: string;
  name: string;
  address: string | null;
  armingState: ArmingState;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IZone {
  id: string;
  propertyId: string;
  name: string;
  thresholdConfig: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDevice {
  id: string;
  name: string;
  zoneId: string;
  deviceToken: string;
  isOnline: boolean;
  lastSeenAt: Date | null;
  firmwareVer: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITelemetryReading {
  id: string;
  deviceId: string;
  recordedAt: Date;
  temperature: number | null;
  humidity: number | null;
  smokePpm: number | null;
  gasPpm: number | null;
  flameDetected: boolean;
  waterDetected: boolean;
  motionDetected: boolean;
  wifiRssi: number | null;
}

export interface ITelemetryRollup {
  id: string;
  deviceId: string;
  bucketStart: Date;
  avgTemp: number | null;
  minTemp: number | null;
  maxTemp: number | null;
  avgHumidity: number | null;
  avgSmokePpm: number | null;
  maxSmokePpm: number | null;
  avgGasPpm: number | null;
  maxGasPpm: number | null;
  flameEvents: number;
  waterEvents: number;
  motionEvents: number;
}

export interface IIncident {
  id: string;
  propertyId: string;
  deviceId: string;
  hazardType: HazardType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  readingValue: number | null;
  details: string | null;
  startedAt: Date;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
  resolvedAt: Date | null;
}

class StorageFallback {
  public users: Map<string, IUser> = new Map();
  public properties: Map<string, IProperty> = new Map();
  public zones: Map<string, IZone> = new Map();
  public devices: Map<string, IDevice> = new Map();
  public telemetryReadings: ITelemetryReading[] = [];
  public rollups: Map<string, ITelemetryRollup> = new Map();
  public incidents: Map<string, IIncident> = new Map();
  public propertyMembers: Map<string, Set<string>> = new Map();
  public enrollments: Map<string, { deviceId: string; name: string; deviceToken: string; pairingTokenHash: string; firmwareVer: string | null; expiresAt: Date; claimedAt: Date | null }> = new Map();
  public pushTokens: Map<string, { id: string; userId: string; token: string; platform: string; enabled: boolean }> = new Map();

  private readingCounter = 1;

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData() {
    // 1. Admin User
    const adminId = 'user_admin_001';
    const passwordHash = bcrypt.hashSync('admin123', 10);
    this.users.set(adminId, {
      id: adminId,
      email: 'admin@example.com',
      name: 'System Administrator',
      passwordHash,
      role: Role.ADMIN,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 2. Demo Property Owner
    // The demo property needs a real owner: only PROPERTY_OWNER accounts may arm
    // or disarm it, and an ADMIN-only login would be refused by the access policy.
    const ownerId = 'user_owner_001';
    this.users.set(ownerId, {
      id: ownerId,
      email: 'owner@example.com',
      name: 'SET Facilities Owner',
      passwordHash: bcrypt.hashSync('owner123', 10),
      role: Role.PROPERTY_OWNER,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 3. Demo Property
    const propertyId = 'prop_sunset_villa_001';
    this.properties.set(propertyId, {
      id: propertyId,
      name: 'School of Engineering and Technology (SET)',
      address: 'School of Engineering and Technology, Great East Road Campus',
      armingState: ArmingState.DISARMED,
      ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.propertyMembers.set(propertyId, new Set([ownerId, adminId]));

    // 4. Zones
    const kitchenZoneId = 'zone_kitchen_001';
    this.zones.set(kitchenZoneId, {
      id: kitchenZoneId,
      propertyId,
      name: 'Kitchen',
      thresholdConfig: {
        max_temp: 50.0,
        min_temp: 5.0,
        smoke_ppm_critical: 300.0,
        water_leak_enabled: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const serverRoomZoneId = 'zone_server_001';
    this.zones.set(serverRoomZoneId, {
      id: serverRoomZoneId,
      propertyId,
      name: 'Server Room',
      thresholdConfig: {
        max_temp: 35.0,
        min_temp: 10.0,
        smoke_ppm_critical: 150.0,
        water_leak_enabled: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const basementZoneId = 'zone_basement_001';
    this.zones.set(basementZoneId, {
      id: basementZoneId,
      propertyId,
      name: 'Basement',
      thresholdConfig: {
        max_temp: 45.0,
        min_temp: 2.0,
        smoke_ppm_critical: 250.0,
        water_leak_enabled: true,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 5. Demo Device: ESP32_A1B2C3
    const deviceId = 'ESP32_A1B2C3';
    this.devices.set(deviceId, {
      id: deviceId,
      name: 'Main Kitchen Multi-Sensor Node',
      zoneId: kitchenZoneId,
      deviceToken: 'tok_esp32_dev_secret_001',
      isOnline: true,
      lastSeenAt: new Date(),
      firmwareVer: 'v1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Seed initial reading
    this.telemetryReadings.push({
      id: String(this.readingCounter++),
      deviceId,
      recordedAt: new Date(),
      temperature: 22.5,
      humidity: 45.0,
      smokePpm: 25.0,
      gasPpm: 18.0,
      flameDetected: false,
      waterDetected: false,
      motionDetected: false,
      wifiRssi: -65,
    });
  }

  // User queries
  async findUserByEmail(email: string): Promise<IUser | null> {
    for (const user of this.users.values()) {
      if (user.email.toLowerCase() === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<IUser | null> {
    return this.users.get(id) || null;
  }

  async getUsersSafe() {
    return Array.from(this.users.values()).map(({ id, email, name, role, createdAt, updatedAt }) => ({ id, email, name, role, createdAt, updatedAt }));
  }

  async setUserRole(userId: string, role: Role): Promise<void> {
    const user = this.users.get(userId);
    if (user) { user.role = role; user.updatedAt = new Date(); }
  }

  async syncPropertyRole(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user || user.role === Role.ADMIN) return;
    const owns = [...this.properties.values()].some((property) => property.ownerId === userId);
    const delegated = [...this.propertyMembers.values()].some((members) => members.has(userId));
    await this.setUserRole(userId, owns ? Role.PROPERTY_OWNER : delegated ? Role.AUTHORIZED_DELEGATE : Role.PROPERTY_OWNER);
  }

  async upsertPushToken(data: { userId: string; token: string; platform: string; enabled?: boolean }) {
    const existing = Array.from(this.pushTokens.values()).find((row) => row.token === data.token);
    const id = existing?.id || `push_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const record = { id, userId: data.userId, token: data.token, platform: data.platform, enabled: data.enabled ?? true };
    this.pushTokens.set(id, record);
    return record;
  }

  async removePushToken(userId: string, token: string): Promise<void> {
    for (const [id, row] of this.pushTokens) if (row.userId === userId && row.token === token) this.pushTokens.delete(id);
  }

  async getEnabledPushTokens(userId: string) {
    return Array.from(this.pushTokens.values()).filter((row) => row.userId === userId && row.enabled);
  }

  async createUser(data: Omit<IUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<IUser> {
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const user: IUser = {
      ...data,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  // Property queries
  async getProperties(): Promise<IProperty[]> {
    return Array.from(this.properties.values());
  }

  async getPropertiesForUser(userId: string, isAdmin = false): Promise<IProperty[]> {
    if (isAdmin) return this.getProperties();
    return Array.from(this.properties.values()).filter((property) =>
      property.ownerId === userId || this.propertyMembers.get(property.id)?.has(userId) === true,
    );
  }

  async canAccessProperty(propertyId: string, userId: string, isAdmin = false): Promise<boolean> {
    if (isAdmin) return this.properties.has(propertyId);
    return this.properties.get(propertyId)?.ownerId === userId || this.propertyMembers.get(propertyId)?.has(userId) === true;
  }

  async isPropertyOwner(propertyId: string, userId: string): Promise<boolean> {
    return this.properties.get(propertyId)?.ownerId === userId;
  }

  async setPropertyOwner(propertyId: string, userId: string): Promise<{ previousOwnerId: string | null } | null> {
    const property = this.properties.get(propertyId);
    if (!property || !this.users.has(userId)) return null;
    const previousOwner = property.ownerId;
    if (previousOwner && previousOwner !== userId) this.propertyMembers.get(propertyId)?.delete(previousOwner);
    property.ownerId = userId;
    property.updatedAt = new Date();
    this.properties.set(propertyId, property);
    return { previousOwnerId: previousOwner };
  }

  async getPropertyUserIds(propertyId: string): Promise<string[]> {
    if (!this.properties.has(propertyId)) return [];
    const ids = new Set(this.propertyMembers.get(propertyId) || []);
    const ownerId = this.properties.get(propertyId)?.ownerId;
    if (ownerId) ids.add(ownerId);
    for (const user of this.users.values()) if (user.role === Role.ADMIN) ids.add(user.id);
    return Array.from(ids);
  }

  async getDelegates(propertyId: string): Promise<Array<Pick<IUser, 'id' | 'email' | 'name'>>> {
    const ownerId = this.properties.get(propertyId)?.ownerId;
    return Array.from(this.propertyMembers.get(propertyId) || [])
      .filter((id) => id !== ownerId)
      .map((id) => this.users.get(id))
      .filter((user): user is IUser => Boolean(user))
      .map(({ id, email, name }) => ({ id, email, name }));
  }

  async addDelegate(propertyId: string, userId: string): Promise<void> {
    const members = this.propertyMembers.get(propertyId) || new Set<string>();
    members.add(userId);
    this.propertyMembers.set(propertyId, members);
  }

  async removeDelegate(propertyId: string, userId: string): Promise<void> {
    this.propertyMembers.get(propertyId)?.delete(userId);
  }

  async getPropertyById(id: string): Promise<IProperty | null> {
    return this.properties.get(id) || null;
  }

  async createProperty(data: { name: string; address?: string | null; armingState?: ArmingState; ownerId?: string | null }): Promise<IProperty> {
    const id = `prop_${Date.now()}`;
    const property: IProperty = {
      id,
      name: data.name,
      address: data.address || null,
      armingState: data.armingState || ArmingState.DISARMED,
      ownerId: data.ownerId || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.properties.set(id, property);
    return property;
  }

  async updatePropertyArming(id: string, armingState: ArmingState): Promise<IProperty | null> {
    const property = this.properties.get(id);
    if (!property) return null;
    property.armingState = armingState;
    property.updatedAt = new Date();
    this.properties.set(id, property);
    return property;
  }

  // Zone queries
  async getZonesByPropertyId(propertyId: string): Promise<IZone[]> {
    return Array.from(this.zones.values()).filter((z) => z.propertyId === propertyId);
  }

  async getZoneById(id: string): Promise<IZone | null> {
    return this.zones.get(id) || null;
  }

  async createZone(data: { propertyId: string; name: string; thresholdConfig?: any }): Promise<IZone> {
    const id = `zone_${Date.now()}`;
    const zone: IZone = {
      id,
      propertyId: data.propertyId,
      name: data.name,
      thresholdConfig: data.thresholdConfig || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.zones.set(id, zone);
    return zone;
  }

  async updateZoneThresholds(id: string, thresholdConfig: any): Promise<IZone | null> {
    const zone = this.zones.get(id);
    if (!zone) return null;
    zone.thresholdConfig = thresholdConfig;
    zone.updatedAt = new Date();
    this.zones.set(id, zone);
    return zone;
  }

  // Device queries
  async getDevices(): Promise<IDevice[]> {
    return Array.from(this.devices.values());
  }

  async getDevicesForUser(userId: string, isAdmin = false): Promise<IDevice[]> {
    if (isAdmin) return this.getDevices();
    const devices: IDevice[] = [];
    for (const device of this.devices.values()) {
      const propertyId = await this.getPropertyIdForDevice(device.id);
      if (propertyId && await this.canAccessProperty(propertyId, userId)) devices.push(device);
    }
    return devices;
  }

  async getDeviceById(id: string): Promise<IDevice | null> {
    return this.devices.get(id) || null;
  }

  async upsertDevice(data: {
    id: string;
    name?: string;
    zoneId: string;
    deviceToken?: string;
    isOnline?: boolean;
    firmwareVer?: string;
  }): Promise<IDevice> {
    const existing = this.devices.get(data.id);
    if (existing) {
      if (data.name) existing.name = data.name;
      if (data.zoneId) existing.zoneId = data.zoneId;
      if (data.deviceToken) existing.deviceToken = data.deviceToken;
      if (data.isOnline !== undefined) existing.isOnline = data.isOnline;
      if (data.firmwareVer) existing.firmwareVer = data.firmwareVer;
      existing.lastSeenAt = new Date();
      existing.updatedAt = new Date();
      this.devices.set(data.id, existing);
      return existing;
    }
    const created: IDevice = {
      id: data.id,
      name: data.name || `Sensor Node ${data.id}`,
      zoneId: data.zoneId,
      deviceToken: data.deviceToken || `token_${data.id}`,
      isOnline: data.isOnline !== undefined ? data.isOnline : true,
      lastSeenAt: new Date(),
      firmwareVer: data.firmwareVer || 'v1.0.0',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.devices.set(data.id, created);
    return created;
  }

  async createDeviceEnrollment(data: { deviceId: string; name: string; deviceToken: string; pairingTokenHash: string; firmwareVer?: string | null; expiresAt: Date }): Promise<{ deviceId: string; name: string; deviceToken: string; pairingTokenHash: string; firmwareVer: string | null; expiresAt: Date; claimedAt: Date | null }> {
    if (this.devices.has(data.deviceId) || this.enrollments.has(data.deviceId)) throw new Error('Device ID already exists.');
    const record = { ...data, firmwareVer: data.firmwareVer || null, claimedAt: null };
    this.enrollments.set(data.deviceId, record);
    return record;
  }

  async getEnrollmentByPairingHash(pairingTokenHash: string) {
    return Array.from(this.enrollments.values()).find((item) =>
      item.pairingTokenHash === pairingTokenHash && item.claimedAt === null && item.expiresAt > new Date(),
    ) || null;
  }

  async claimDeviceEnrollment(deviceId: string, zoneId: string): Promise<IDevice | null> {
    const enrollment = this.enrollments.get(deviceId);
    if (!enrollment || enrollment.claimedAt || enrollment.expiresAt <= new Date()) return null;
    enrollment.claimedAt = new Date();
    this.enrollments.set(deviceId, enrollment);
    try {
      return await this.upsertDevice({
        id: enrollment.deviceId, name: enrollment.name, zoneId,
        deviceToken: enrollment.deviceToken, firmwareVer: enrollment.firmwareVer || undefined, isOnline: false,
      });
    } catch (error) {
      enrollment.claimedAt = null;
      this.enrollments.set(deviceId, enrollment);
      throw error;
    }
  }

  async getPropertyIdForDevice(deviceId: string): Promise<string | null> {
    const device = this.devices.get(deviceId);
    return device ? this.zones.get(device.zoneId)?.propertyId || null : null;
  }

  async getPropertyIdForZone(zoneId: string): Promise<string | null> {
    return this.zones.get(zoneId)?.propertyId || null;
  }

  async findDeviceByToken(deviceToken: string): Promise<IDevice | null> {
    return Array.from(this.devices.values()).find((device) => device.deviceToken === deviceToken) || null;
  }

  async setDeviceOnlineStatus(id: string, isOnline: boolean): Promise<IDevice | null> {
    const device = this.devices.get(id);
    if (!device) return null;
    device.isOnline = isOnline;
    device.lastSeenAt = new Date();
    device.updatedAt = new Date();
    this.devices.set(id, device);
    return device;
  }

  // Telemetry queries
  async addTelemetryReading(reading: Omit<ITelemetryReading, 'id' | 'recordedAt'> & { recordedAt?: Date }): Promise<ITelemetryReading> {
    const newReading: ITelemetryReading = {
      id: String(this.readingCounter++),
      deviceId: reading.deviceId,
      recordedAt: reading.recordedAt || new Date(),
      temperature: reading.temperature,
      humidity: reading.humidity,
      smokePpm: reading.smokePpm,
      gasPpm: reading.gasPpm ?? null,
      flameDetected: reading.flameDetected ?? false,
      waterDetected: reading.waterDetected,
      motionDetected: reading.motionDetected,
      wifiRssi: reading.wifiRssi,
    };
    this.telemetryReadings.push(newReading);
    // Keep last 5000 in memory
    if (this.telemetryReadings.length > 5000) {
      this.telemetryReadings.shift();
    }
    return newReading;
  }

  async getLatestTelemetry(deviceId?: string): Promise<ITelemetryReading | null> {
    if (deviceId) {
      for (let i = this.telemetryReadings.length - 1; i >= 0; i--) {
        if (this.telemetryReadings[i].deviceId === deviceId) {
          return this.telemetryReadings[i];
        }
      }
      return null;
    }
    return this.telemetryReadings[this.telemetryReadings.length - 1] || null;
  }

  async getTelemetryHistory(deviceId?: string, limit = 100): Promise<ITelemetryReading[]> {
    let filtered = this.telemetryReadings;
    if (deviceId) {
      filtered = filtered.filter((r) => r.deviceId === deviceId);
    }
    return filtered.slice(-limit);
  }

  // Rollups
  async getRollups(deviceId?: string): Promise<ITelemetryRollup[]> {
    const list = Array.from(this.rollups.values());
    if (deviceId) {
      return list.filter((r) => r.deviceId === deviceId);
    }
    return list;
  }

  async saveRollup(rollup: Omit<ITelemetryRollup, 'id'>): Promise<ITelemetryRollup> {
    const key = `${rollup.deviceId}_${rollup.bucketStart.toISOString()}`;
    const item: ITelemetryRollup = {
      ...rollup,
      id: key,
    };
    this.rollups.set(key, item);
    return item;
  }

  // Incidents
  async createIncident(data: {
    propertyId: string;
    deviceId: string;
    hazardType: HazardType;
    severity: IncidentSeverity;
    readingValue?: number | null;
    details?: string | null;
  }): Promise<IIncident> {
    const id = `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const incident: IIncident = {
      id,
      propertyId: data.propertyId,
      deviceId: data.deviceId,
      hazardType: data.hazardType,
      severity: data.severity,
      status: IncidentStatus.ACTIVE,
      readingValue: data.readingValue ?? null,
      details: data.details ?? null,
      startedAt: new Date(),
      acknowledgedAt: null,
      acknowledgedBy: null,
      resolvedAt: null,
    };
    this.incidents.set(id, incident);
    return incident;
  }

  async getIncidents(filter?: { propertyId?: string; propertyIds?: string[]; status?: IncidentStatus }): Promise<IIncident[]> {
    let list = Array.from(this.incidents.values());
    if (filter?.propertyId) {
      list = list.filter((inc) => inc.propertyId === filter.propertyId);
    }
    if (filter?.propertyIds) {
      const allowed = new Set(filter.propertyIds);
      list = list.filter((inc) => allowed.has(inc.propertyId));
    }
    if (filter?.status) {
      list = list.filter((inc) => inc.status === filter.status);
    }
    return list.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  async getActiveIncidentByHazard(deviceId: string, hazardType: HazardType): Promise<IIncident | null> {
    for (const inc of this.incidents.values()) {
      if (inc.deviceId === deviceId && inc.hazardType === hazardType && inc.status !== IncidentStatus.RESOLVED) {
        return inc;
      }
    }
    return null;
  }

  async getIncidentById(id: string): Promise<IIncident | null> {
    return this.incidents.get(id) || null;
  }

  async acknowledgeIncident(id: string, userId?: string): Promise<IIncident | null> {
    const incident = this.incidents.get(id);
    if (!incident) return null;
    incident.status = IncidentStatus.ACKNOWLEDGED;
    incident.acknowledgedAt = new Date();
    incident.acknowledgedBy = userId || null;
    this.incidents.set(id, incident);
    return incident;
  }

  async resolveIncident(id: string): Promise<IIncident | null> {
    const incident = this.incidents.get(id);
    if (!incident) return null;
    incident.status = IncidentStatus.RESOLVED;
    incident.resolvedAt = new Date();
    this.incidents.set(id, incident);
    return incident;
  }
}

export const storageFallback = new StorageFallback();
