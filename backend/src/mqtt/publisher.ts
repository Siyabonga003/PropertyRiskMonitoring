import { TOPICS, COMMANDS } from '../config/constants';
import { getMqttClient } from './client';

export interface CommandPayload {
  command: string;
  parameters?: Record<string, any>;
  timestamp?: number;
}

export class MqttPublisher {
  /**
   * Publishes an actuator command to an ESP32 device
   */
  public async sendCommand(deviceId: string, command: string, parameters: Record<string, any> = {}): Promise<boolean> {
    const client = getMqttClient();
    if (!client || !client.connected) {
      console.warn(`[MQTT Publisher] Cannot send command to ${deviceId}: MQTT client not connected.`);
      return false;
    }

    const topic = TOPICS.COMMAND_TEMPLATE(deviceId);
    const payload: CommandPayload = {
      command,
      parameters,
      timestamp: Math.floor(Date.now() / 1000),
    };

    return new Promise((resolve) => {
      client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
          console.error(`[MQTT Publisher] Failed to publish command to ${topic}:`, err);
          resolve(false);
        } else {
          console.log(`📡 [MQTT Publisher] Published [${command}] to ${topic}`);
          resolve(true);
        }
      });
    });
  }

  /**
   * Triggers audible buzzer on the device (e.g. for emergency hazard alerts)
   */
  public async triggerBuzzer(deviceId: string, durationMs = 30000, pattern = 'PULSE'): Promise<boolean> {
    return this.sendCommand(deviceId, COMMANDS.TRIGGER_BUZZER, { durationMs, pattern });
  }

  /**
   * Silences audible buzzer on the device
   */
  public async silenceBuzzer(deviceId: string): Promise<boolean> {
    return this.sendCommand(deviceId, COMMANDS.SILENCE_BUZZER);
  }

  /**
   * Dispatches configuration parameters to an ESP32 node
   */
  public async sendConfig(deviceId: string, config: Record<string, any>): Promise<boolean> {
    const client = getMqttClient();
    if (!client || !client.connected) return false;

    const topic = TOPICS.CONFIG_TEMPLATE(deviceId);
    return new Promise((resolve) => {
      client.publish(topic, JSON.stringify(config), { qos: 1, retain: true }, (err) => {
        if (err) {
          console.error(`[MQTT Publisher] Failed to publish config to ${topic}:`, err);
          resolve(false);
        } else {
          console.log(`⚙ [MQTT Publisher] Published config to ${topic}`);
          resolve(true);
        }
      });
    });
  }
}

export const mqttPublisher = new MqttPublisher();
