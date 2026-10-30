import { telemetryService, RawTelemetryPacket } from '../services/telemetryService';
import { alertEngine, HazardAlertPayload } from '../services/alertEngine';
import { deviceService } from '../services/deviceService';

export class MqttTopicHandler {
  /**
   * Routes incoming MQTT messages based on topic hierarchy
   */
  public async handleMessage(topic: string, messageBuffer: Buffer) {
    const messageStr = messageBuffer.toString('utf-8');
    const topicParts = topic.split('/');

    try {
      // 1. Device LWT status: devices/{deviceId}/status
      if (topicParts.length === 3 && topicParts[0] === 'devices' && topicParts[2] === 'status') {
        const deviceId = topicParts[1];
        let isOnline = false;
        try {
          const parsed = JSON.parse(messageStr);
          isOnline = parsed.status === 'online' || parsed.online === true;
        } catch {
          isOnline = messageStr.trim().toLowerCase() === 'online';
        }
        await deviceService.updateOnlineStatus(deviceId, isOnline);
        return;
      }

      // 2. Telemetry and Alert topics:
      // properties/{propertyId}/zones/{zoneId}/devices/{deviceId}/telemetry
      // properties/{propertyId}/zones/{zoneId}/devices/{deviceId}/alert
      if (topicParts.length === 6 && topicParts[0] === 'properties' && topicParts[2] === 'zones' && topicParts[4] === 'devices') {
        const propertyId = topicParts[1];
        const zoneId = topicParts[3];
        const deviceId = topicParts[5];
        const action = topicParts[6] || topicParts[5]; // handling length indexing

        // Wait! Let's check topicParts length:
        // 'properties' (0) / propertyId (1) / 'zones' (2) / zoneId (3) / 'devices' (4) / deviceId (5) / 'telemetry'|'alert' (6)
        // Length is 7! Let's handle topicParts.length === 7.
      }

      if (topicParts.length >= 7 && topicParts[0] === 'properties') {
        const propertyId = topicParts[1];
        const zoneId = topicParts[3];
        const deviceId = topicParts[5];
        const messageType = topicParts[6];

        const payload = JSON.parse(messageStr);

        if (messageType === 'telemetry') {
          await telemetryService.ingestTelemetry(propertyId, zoneId, deviceId, payload as RawTelemetryPacket);
        } else if (messageType === 'alert') {
          await alertEngine.evaluateExplicitAlert(propertyId, zoneId, deviceId, payload as HazardAlertPayload);
        } else {
          console.log(`[MQTT Handler] Unhandled message type: ${messageType} on topic ${topic}`);
        }
      }
    } catch (err: any) {
      console.error(`❌ [MQTT Handler] Error parsing/processing message on ${topic}:`, err.message);
    }
  }
}

export const mqttTopicHandler = new MqttTopicHandler();
