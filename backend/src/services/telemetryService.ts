import { db } from '../database/db';
import { alertEngine } from './alertEngine';
import { socketEmitter } from '../sockets/emitter';

export interface RawTelemetryPacket {
  deviceId: string;
  timestamp?: number;
  metrics: {
    temperature?: number;
    humidity?: number;
    smoke_ppm?: number;
    gas_ppm?: number;
    flame_detected?: boolean;
    water_detected?: boolean;
    motion_detected?: boolean;
  };
  diagnostics?: {
    wifi_rssi?: number;
    uptime_seconds?: number;
    free_heap?: number;
  };
}

export class TelemetryService {
  /**
   * Ingests a new telemetry packet, persists it, triggers risk checks, and broadcasts via sockets
   */
  public async ingestTelemetry(
    propertyId: string,
    zoneId: string,
    deviceId: string,
    packet: RawTelemetryPacket
  ) {
    const recordedAt = packet.timestamp ? new Date(packet.timestamp * 1000) : new Date();

    // The hardware identity must be enrolled and claimed first. Never trust
    // client-supplied routing IDs to reassign a device to another property.
    const device = await db.getDeviceById(deviceId);
    const enrolledPropertyId = await db.getPropertyIdForDevice(deviceId);
    if (!device || !enrolledPropertyId) {
      throw new Error(`Unknown device '${deviceId}'. Enroll and claim it before publishing telemetry.`);
    }
    if (device.zoneId !== zoneId || enrolledPropertyId !== propertyId) {
      // Topic IDs are untrusted input. The enrolled assignment wins, so a node
      // (or simulator) using stale placeholder IDs is still ingested correctly
      // instead of having every packet dropped.
      console.warn(
        `[Telemetry] Topic route ${propertyId}/${zoneId} differs from enrolled assignment ` +
        `${enrolledPropertyId}/${device.zoneId}; using the enrolled assignment.`
      );
      propertyId = enrolledPropertyId;
      zoneId = device.zoneId;
    }
    await db.setDeviceOnlineStatus(deviceId, true);

    // 2. Persist reading
    const reading = await db.addTelemetryReading({
      deviceId,
      recordedAt,
      temperature: packet.metrics.temperature,
      humidity: packet.metrics.humidity,
      smokePpm: packet.metrics.smoke_ppm,
      gasPpm: packet.metrics.gas_ppm,
      flameDetected: !!packet.metrics.flame_detected,
      waterDetected: !!packet.metrics.water_detected,
      motionDetected: !!packet.metrics.motion_detected,
      wifiRssi: packet.diagnostics?.wifi_rssi,
    });

    // 3. Evaluate hazards through AlertEngine
    await alertEngine.evaluateTelemetry(propertyId, zoneId, deviceId, packet.metrics);

    // 4. Broadcast live update to WebSockets
    socketEmitter.emitTelemetryUpdate(propertyId, { ...reading, zoneId });

    return reading;
  }

  public async getLatestReading(deviceId?: string) {
    return db.getLatestTelemetry(deviceId);
  }

  public async getHistory(deviceId?: string, limit = 100) {
    return db.getTelemetryHistory(deviceId, limit);
  }

  public async getRollups(deviceId?: string) {
    return db.getRollups(deviceId);
  }
}

export const telemetryService = new TelemetryService();
