import { db } from '../database/db';
import { socketEmitter } from '../sockets/emitter';
import { mqttPublisher } from '../mqtt/publisher';
import { IncidentStatus, HazardType, IncidentSeverity } from '@prisma/client';

export class IncidentService {
  public async getIncidents(filter?: { propertyId?: string; status?: IncidentStatus }) {
    return db.getIncidents(filter);
  }

  public async getIncidentById(id: string) {
    return db.getIncidentById(id);
  }

  public async acknowledge(id: string, userId?: string) {
    const updated = await db.acknowledgeIncident(id, userId);
    if (updated) {
      console.log(`[IncidentService] Incident ${id} acknowledged by user ${userId || 'anonymous'}`);
      socketEmitter.emitIncidentAcknowledged(updated.propertyId, updated);
    }
    return updated;
  }

  public async resolve(id: string) {
    const updated = await db.resolveIncident(id);
    if (updated) {
      console.log(`[IncidentService] Incident ${id} marked as RESOLVED`);
      // Also silence device siren
      await mqttPublisher.silenceBuzzer(updated.deviceId);
      socketEmitter.emitIncidentResolved(updated.propertyId, updated);
    }
    return updated;
  }

  public async ingestDirectIncident(data: {
    propertyId: string;
    deviceId: string;
    hazardType: HazardType;
    severity?: IncidentSeverity;
    readingValue?: number;
    details?: string;
  }) {
    const incident = await db.createIncident({
      propertyId: data.propertyId,
      deviceId: data.deviceId,
      hazardType: data.hazardType,
      severity: data.severity || IncidentSeverity.CRITICAL,
      readingValue: data.readingValue,
      details: data.details,
    });

    socketEmitter.emitNewIncident(data.propertyId, incident);

    if (incident.severity === IncidentSeverity.CRITICAL) {
      await mqttPublisher.triggerBuzzer(data.deviceId);
    }

    return incident;
  }
}

export const incidentService = new IncidentService();
