import { db } from '../database/db';
import { ArmingState } from '@prisma/client';
import { socketEmitter } from '../sockets/emitter';

export class PropertyService {
  public async getProperties() {
    return db.getProperties();
  }

  public async getPropertyById(id: string) {
    return db.getPropertyById(id);
  }

  public async createProperty(data: { name: string; address?: string | null; armingState?: ArmingState }, ownerId: string) {
    return db.createProperty(data, ownerId);
  }

  public async updateArmingState(propertyId: string, armingState: ArmingState) {
    const updated = await db.updatePropertyArming(propertyId, armingState);
    if (updated) {
      console.log(`🛡 [PropertyService] Property ${propertyId} arming state updated to: ${armingState}`);
      socketEmitter.emitArmingStateChanged(propertyId, armingState);
    }
    return updated;
  }

  public async getZones(propertyId: string) {
    return db.getZonesByPropertyId(propertyId);
  }

  public async getZoneById(zoneId: string) {
    return db.getZoneById(zoneId);
  }

  public async createZone(propertyId: string, name: string, thresholdConfig?: any) {
    return db.createZone({ propertyId, name, thresholdConfig });
  }

  public async updateZoneThresholds(zoneId: string, thresholdConfig: any) {
    return db.updateZoneThresholds(zoneId, thresholdConfig);
  }
}

export const propertyService = new PropertyService();
