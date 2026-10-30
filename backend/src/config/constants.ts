export const TOPICS = {
  TELEMETRY_WILDCARD: 'properties/+/zones/+/devices/+/telemetry',
  ALERT_WILDCARD: 'properties/+/zones/+/devices/+/alert',
  STATUS_WILDCARD: 'devices/+/status',
  COMMAND_TEMPLATE: (deviceId: string) => `devices/${deviceId}/commands`,
  CONFIG_TEMPLATE: (deviceId: string) => `devices/${deviceId}/config`,
} as const;

export const DEFAULT_THRESHOLDS = {
  TEMP_MIN_CELSIUS: 2.0,
  TEMP_MAX_CELSIUS: 50.0,
  SMOKE_PPM_WARNING: 150.0,
  SMOKE_PPM_CRITICAL: 300.0,
  HEARTBEAT_TIMEOUT_MS: 45000, // 45s heartbeat timeout
};

export const COMMANDS = {
  TRIGGER_BUZZER: 'TRIGGER_BUZZER',
  SILENCE_BUZZER: 'SILENCE_BUZZER',
  REBOOT: 'REBOOT',
  SET_CONFIG: 'SET_CONFIG',
} as const;

export const SOCKET_EVENTS = {
  // Client to server
  JOIN_PROPERTY: 'property:join',
  LEAVE_PROPERTY: 'property:leave',
  ACKNOWLEDGE_INCIDENT: 'incident:ack',
  RESOLVE_INCIDENT: 'incident:resolve',
  TRIGGER_BUZZER: 'device:trigger_buzzer',
  SILENCE_BUZZER: 'device:silence_buzzer',

  // Server to client broadcasts
  TELEMETRY_UPDATE: 'telemetry:update',
  INCIDENT_NEW: 'incident:new',
  INCIDENT_ACKNOWLEDGED: 'incident:acknowledged',
  INCIDENT_RESOLVED: 'incident:resolved',
  DEVICE_STATUS: 'device:status',
  ARMING_CHANGED: 'property:arming_changed',
} as const;
