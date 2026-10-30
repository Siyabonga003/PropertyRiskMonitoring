import { db } from '../database/db';
import { socketEmitter } from '../sockets/emitter';
import { mqttPublisher } from '../mqtt/publisher';

export class DeviceService {
  public async getDevices() {
    return db.getDevices();
  }

  public async getDeviceById(id: string) {
    return db.getDeviceById(id);
  }

  public async registerDevice(data: {
    id: string;
    name?: string;
    zoneId: string;
    deviceToken?: string;
    firmwareVer?: string;
  }) {
    return db.upsertDevice(data);
  }

  public async updateOnlineStatus(deviceId: string, isOnline: boolean) {
    const device = await db.setDeviceOnlineStatus(deviceId, isOnline);
    if (device) {
      console.log(`📶 [DeviceService] Device ${deviceId} status changed: isOnline=${isOnline}`);
      socketEmitter.emitDeviceStatus(deviceId, isOnline);
    }
    return device;
  }

  public async sendCommand(deviceId: string, command: string, parameters: Record<string, any> = {}) {
    return mqttPublisher.sendCommand(deviceId, command, parameters);
  }
}

export const deviceService = new DeviceService();
