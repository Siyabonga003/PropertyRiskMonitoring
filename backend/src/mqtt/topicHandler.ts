import { telemetryService, RawTelemetryPacket } from '../services/telemetryService';
import { alertEngine, HazardAlertPayload } from '../services/alertEngine';
import { deviceService } from '../services/deviceService';
import { db } from '../database/db';

export class MqttTopicHandler {
  public async handleMessage(topic: string, messageBuffer: Buffer) {
    const messageStr = messageBuffer.toString('utf-8');
    const topicParts = topic.split('/');
    try {
      if (topicParts.length === 3 && topicParts[0] === 'devices' && topicParts[2] === 'status') {
        const deviceId = topicParts[1];
        if (!(await db.getDeviceById(deviceId))) return;
        let isOnline = false;
        try {
          const parsed = JSON.parse(messageStr);
          isOnline = parsed.status === 'online' || parsed.online === true;
        } catch { isOnline = messageStr.trim().toLowerCase() === 'online'; }
        await deviceService.updateOnlineStatus(deviceId, isOnline);
        return;
      }

      if (topicParts.length !== 7 || topicParts[0] !== 'properties' || topicParts[2] !== 'zones' || topicParts[4] !== 'devices') return;
      const propertyId = topicParts[1];
      const zoneId = topicParts[3];
      const deviceId = topicParts[5];
      const messageType = topicParts[6];
      if (messageType !== 'telemetry' && messageType !== 'alert') return;

      const device = await db.getDeviceById(deviceId);
      const actualPropertyId = await db.getPropertyIdForDevice(deviceId);
      if (!device || device.zoneId !== zoneId || actualPropertyId !== propertyId) {
        console.warn(`[MQTT Handler] Dropped packet with unassigned topic route: ${topic}`);
        return;
      }
      const payload = JSON.parse(messageStr);
      if (payload.deviceId && payload.deviceId !== deviceId) {
        console.warn(`[MQTT Handler] Dropped packet whose payload deviceId differs from topic: ${topic}`);
        return;
      }
      if (messageType === 'telemetry') {
        await telemetryService.ingestTelemetry(propertyId, zoneId, deviceId, payload as RawTelemetryPacket);
      } else {
        await alertEngine.evaluateExplicitAlert(propertyId, zoneId, deviceId, payload as HazardAlertPayload);
      }
    } catch (err: any) {
      console.error(`❌ [MQTT Handler] Error processing message on ${topic}:`, err.message);
    }
  }
}
export const mqttTopicHandler = new MqttTopicHandler();
