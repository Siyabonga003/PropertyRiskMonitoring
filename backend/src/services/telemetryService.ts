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

    // 1. Ensure device exists and update last seen
    await db.upsertDevice({
      id: deviceId,
      zoneId,
      isOnline: true,
    });

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
