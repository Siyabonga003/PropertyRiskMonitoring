import { Server } from 'socket.io';
import { SOCKET_EVENTS } from '../config/constants';
import { ITelemetryReading, IIncident } from '../database/storageFallback';
import { ArmingState } from '@prisma/client';

let ioInstance: Server | null = null;

export function setSocketServer(io: Server) {
  ioInstance = io;
}

export function getSocketServer(): Server | null {
  return ioInstance;
}

export class SocketEmitter {
  /**
   * Broadcasts a new telemetry reading to property room and globally
   */
  public emitTelemetryUpdate(propertyId: string, reading: ITelemetryReading & { zoneId?: string }) {
    if (!ioInstance) return;
    ioInstance.to(`property:${propertyId}`).emit(SOCKET_EVENTS.TELEMETRY_UPDATE, reading);
    ioInstance.emit(SOCKET_EVENTS.TELEMETRY_UPDATE, reading);
  }

  /**
   * Broadcasts a newly triggered hazard incident
   */
  public emitNewIncident(propertyId: string, incident: IIncident) {
    if (!ioInstance) return;
    ioInstance.to(`property:${propertyId}`).emit(SOCKET_EVENTS.INCIDENT_NEW, incident);
    ioInstance.emit(SOCKET_EVENTS.INCIDENT_NEW, incident);
  }

  /**
   * Broadcasts incident acknowledgment
   */
  public emitIncidentAcknowledged(propertyId: string, incident: IIncident) {
    if (!ioInstance) return;
    ioInstance.to(`property:${propertyId}`).emit(SOCKET_EVENTS.INCIDENT_ACKNOWLEDGED, incident);
    ioInstance.emit(SOCKET_EVENTS.INCIDENT_ACKNOWLEDGED, incident);
  }

  /**
   * Broadcasts incident resolution
   */
  public emitIncidentResolved(propertyId: string, incident: IIncident) {
    if (!ioInstance) return;
    ioInstance.to(`property:${propertyId}`).emit(SOCKET_EVENTS.INCIDENT_RESOLVED, incident);
    ioInstance.emit(SOCKET_EVENTS.INCIDENT_RESOLVED, incident);
  }

  /**
   * Broadcasts device online/offline status transition
   */
  public emitDeviceStatus(deviceId: string, isOnline: boolean, propertyId?: string) {
    if (!ioInstance) return;
    const payload = { deviceId, isOnline, timestamp: new Date() };
    if (propertyId) {
      ioInstance.to(`property:${propertyId}`).emit(SOCKET_EVENTS.DEVICE_STATUS, payload);
    }
    ioInstance.emit(SOCKET_EVENTS.DEVICE_STATUS, payload);
  }

  /**
   * Broadcasts property arming state change
   */
  public emitArmingStateChanged(propertyId: string, armingState: ArmingState) {
    if (!ioInstance) return;
    const payload = { propertyId, armingState, timestamp: new Date() };
    ioInstance.to(`property:${propertyId}`).emit(SOCKET_EVENTS.ARMING_CHANGED, payload);
    ioInstance.emit(SOCKET_EVENTS.ARMING_CHANGED, payload);
  }
}

export const socketEmitter = new SocketEmitter();
