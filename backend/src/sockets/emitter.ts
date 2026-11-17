import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '../config/constants';
import { ITelemetryReading, IIncident } from '../database/storageFallback';
import { ArmingState } from '@prisma/client';
import { db } from '../database/db';

let ioInstance: Server | null = null;
export function setSocketServer(io: Server) { ioInstance = io; }
export function getSocketServer(): Server | null { return ioInstance; }

export class SocketEmitter {
  private async emitToPropertyUsers(propertyId: string, event: string, payload: unknown) {
    if (!ioInstance) return;
    try {
      const userIds = await db.getPropertyUserIds(propertyId);
      // Resolve recipients against current DB membership on every event. Do not
      // emit to the property room: a socket may still occupy that room during
      // an asynchronous delegate/ownership revocation refresh.
      const rooms = userIds.map((id) => `user:${id}`);
      if (rooms.length) ioInstance.to(rooms).emit(event, payload);
    } catch (error) {
      // Fail closed on recipient-resolution problems; never emit globally.
      console.error('[Socket.IO] Failed to resolve property recipients:', error);
    }
  }

  public emitTelemetryUpdate(propertyId: string, reading: ITelemetryReading & { zoneId?: string }) {
    void this.emitToPropertyUsers(propertyId, SOCKET_EVENTS.TELEMETRY_UPDATE, reading);
  }
  public emitNewIncident(propertyId: string, incident: IIncident) {
    void this.emitToPropertyUsers(propertyId, SOCKET_EVENTS.INCIDENT_NEW, incident);
  }
  public emitIncidentAcknowledged(propertyId: string, incident: IIncident) {
    void this.emitToPropertyUsers(propertyId, SOCKET_EVENTS.INCIDENT_ACKNOWLEDGED, incident);
  }
  public emitIncidentResolved(propertyId: string, incident: IIncident) {
    void this.emitToPropertyUsers(propertyId, SOCKET_EVENTS.INCIDENT_RESOLVED, incident);
  }

  public emitDeviceStatus(deviceId: string, isOnline: boolean) {
    void (async () => {
      if (!ioInstance) return;
      const propertyId = await db.getPropertyIdForDevice(deviceId);
      if (!propertyId) return;
      await this.emitToPropertyUsers(propertyId, SOCKET_EVENTS.DEVICE_STATUS, { deviceId, isOnline, timestamp: new Date() });
    })();
  }

  public emitArmingStateChanged(propertyId: string, armingState: ArmingState) {
    void this.emitToPropertyUsers(propertyId, SOCKET_EVENTS.ARMING_CHANGED, { propertyId, armingState, timestamp: new Date() });
  }

  public refreshUserRooms(userId: string) {
    void (async () => {
      if (!ioInstance) return;
      const sockets = await ioInstance.in(`user:${userId}`).fetchSockets();
      const user = await db.findUserById(userId);
      const properties = user ? await db.getPropertiesForUser(userId, user.role) : [];
      const allowed = new Set(properties.map((property) => `property:${property.id}`));
      for (const socket of sockets) {
        for (const room of socket.rooms) {
          if (room.startsWith('property:') && !allowed.has(room)) await socket.leave(room);
        }
        for (const room of allowed) await socket.join(room);
      }
    })().catch((error) => console.error('[Socket.IO] Failed to refresh access rooms:', error));
  }
}
export const socketEmitter = new SocketEmitter();
