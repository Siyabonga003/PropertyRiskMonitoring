import mqtt, { MqttClient } from 'mqtt';
import { env } from '../config/env';
import { TOPICS } from '../config/constants';
import { mqttTopicHandler } from './topicHandler';
import { embeddedBroker } from './broker';

let mqttClient: MqttClient | null = null;

export function getMqttClient(): MqttClient | null {
  return mqttClient;
}

export async function initializeMqtt(): Promise<MqttClient> {
  // If embedded broker is enabled, start it first so port 1883 is immediately ready
  if (env.EMBEDDED_MQTT) {
    try {
      console.log('⚡ [MQTT] Initializing embedded Aedes broker...');
      await embeddedBroker.start(env.MQTT_PORT);
    } catch (e: any) {
      console.warn('⚠ [MQTT] Could not start embedded broker:', e.message);
    }
  }

  const brokerUrl = env.MQTT_BROKER_URL;
  console.log(`🔌 [MQTT] Connecting client to broker at ${brokerUrl}...`);

  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `${env.MQTT_CLIENT_ID}_${Math.random().toString(16).substring(2, 8)}`,
    clean: true,
    connectTimeout: 5000,
    reconnectPeriod: 3000,
  });

  mqttClient.on('connect', () => {
    console.log(`✔ [MQTT] Successfully connected to broker (${brokerUrl})`);

    const subscriptions = [
      TOPICS.TELEMETRY_WILDCARD,
      TOPICS.ALERT_WILDCARD,
      TOPICS.STATUS_WILDCARD,
    ];

    mqttClient?.subscribe(subscriptions, { qos: 1 }, (err) => {
      if (err) {
        console.error('❌ [MQTT] Failed to subscribe to topics:', err);
      } else {
        console.log(`📡 [MQTT] Subscribed to topic channels:`, subscriptions);
      }
    });
  });

  mqttClient.on('message', async (topic, payload) => {
    await mqttTopicHandler.handleMessage(topic, payload);
  });

  mqttClient.on('error', (err) => {
    console.error('❌ [MQTT Client Error]:', err.message);
  });

  mqttClient.on('offline', () => {
    console.warn('⚠ [MQTT] Client is offline. Attempting reconnect...');
  });

  return mqttClient;
}
