import dotenv from 'dotenv';
import path from 'path';

// Load .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET || 'super_secret_property_risk_jwt_key_2026';
if (nodeEnv === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32 || process.env.JWT_SECRET === 'super_secret_property_risk_jwt_key_2026' || process.env.JWT_SECRET.startsWith('replace-with-'))) {
  throw new Error('JWT_SECRET must be set to a unique value of at least 32 characters in production.');
}

export const env = {
  NODE_ENV: nodeEnv,
  PORT: parseInt(process.env.PORT || '5000', 10),
  DATABASE_URL:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres_password@localhost:5432/property_risk_db?schema=public',
  MQTT_BROKER_URL: process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  MQTT_PORT: parseInt(process.env.MQTT_PORT || '1883', 10),
  MQTT_WS_PORT: parseInt(process.env.MQTT_WS_PORT || '9001', 10),
  MQTT_CLIENT_ID: process.env.MQTT_CLIENT_ID || 'property-risk-backend',
  EMBEDDED_MQTT: process.env.EMBEDDED_MQTT !== 'false', // Default true for seamless out-of-the-box dev!
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
};
