import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres_password@localhost:5432/property_risk_db?schema=public',
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  MQTT_PORT: parseInt(process.env.MQTT_PORT || '1883', 10),
  MQTT_WS_PORT: parseInt(process.env.MQTT_WS_PORT || '9001', 10),
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'property-risk-backend',
  EMBEDDED_MQTT: process.env.EMBEDDED_MQTT !== 'false', // Default true for seamless out-of-the-box dev!
  JWT_SECRET: process.env.JWT_SECRET || 'super_secret_property_risk_jwt_key_2026',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
};
