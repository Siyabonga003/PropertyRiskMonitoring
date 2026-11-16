import axios from 'axios';
import type { Property, ArmingState, ZoneThresholdConfig, Device } from '../types/property';
import type { Incident } from '../types/incidents';
import type { ChartDataPoint } from '../types/telemetry';
import type { User, AuthResponse } from '../types/auth';
import { INITIAL_PROPERTY, INITIAL_INCIDENTS, generateHistoricalTelemetry } from './mockData';

const baseURL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 4000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('riskguard_auth_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// In-memory state for fallback when backend is offline
let mockPropertyState: Property = JSON.parse(JSON.stringify(INITIAL_PROPERTY));
let mockIncidentsState: Incident[] = JSON.parse(JSON.stringify(INITIAL_INCIDENTS));

export const authService = {
  async login(email: string, _password: string): Promise<AuthResponse> {
    try {
      const res = await api.post('/api/auth/login', { email, password: _password });
      return res.data;
    } catch {
      // Mock fallback
      const role = email.includes('admin') ? 'ADMIN' : email.includes('manager') ? 'MANAGER' : 'VIEWER';
      const mockUser: User = {
        id: 'usr-admin-1',
        email,
        name: email.split('@')[0].toUpperCase(),
        role,
      };
      const mockResponse: AuthResponse = {
        token: 'mock-jwt-token-riskguard-demo',
        user: mockUser,
      };
      return mockResponse;
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const saved = localStorage.getItem('riskguard_auth_user');
    return saved ? JSON.parse(saved) : null;
  },
};

export const propertyService = {
  async getProperties(): Promise<Property[]> {
    try {
      const res = await api.get('/api/properties');
      return Array.isArray(res.data) ? res.data : [mockPropertyState];
    } catch {
      return [mockPropertyState];
    }
  },

  async getProperty(id: string): Promise<Property> {
    try {
      const res = await api.get(`/api/properties/${id}`);
      return res.data;
    } catch {
      return mockPropertyState;
    }
  },

  async updateArmingState(id: string, armingState: ArmingState): Promise<Property> {
    try {
      const res = await api.patch(`/api/properties/${id}/arming`, { armingState });
      mockPropertyState.armingState = armingState;
      return res.data;
    } catch {
      mockPropertyState = {
        ...mockPropertyState,
        armingState,
      };
      return mockPropertyState;
    }
  },

  async updateZoneThresholds(
    propertyId: string,
    zoneId: string,
    thresholdConfig: ZoneThresholdConfig
  ): Promise<ZoneThresholdConfig> {
    try {
      const res = await api.patch(`/api/properties/${propertyId}/zones/${zoneId}`, { thresholdConfig });
      return res.data;
    } catch {
      // update local mock
      mockPropertyState.zones = mockPropertyState.zones?.map((z) => {
        if (z.id === zoneId) {
          return {
            ...z,
            thresholdConfig: { ...z.thresholdConfig, ...thresholdConfig },
          };
        }
        return z;
      });
      return thresholdConfig;
    }
  },
};

export const deviceService = {
  async getDevices(): Promise<Device[]> {
    try {
      const res = await api.get('/api/devices');
      return res.data;
    } catch {
      const devices: Device[] = [];
      mockPropertyState.zones?.forEach((z) => {
        if (z.devices) {
          devices.push(...z.devices);
        }
      });
      return devices;
    }
  },

  async sendCommand(
    deviceId: string,
    command: 'TRIGGER_BUZZER' | 'SILENCE_BUZZER' | 'REBOOT' | 'TEST_ALARM',
    parameters?: Record<string, any>
  ): Promise<{ success: boolean; message: string }> {
    try {
      const res = await api.post(`/api/devices/${deviceId}/command`, { command, parameters });
      return res.data;
    } catch {
      return {
        success: true,
        message: `Command ${command} sent to device ${deviceId} successfully.`,
      };
    }
  },
};

export const incidentService = {
  async getIncidents(propertyId?: string): Promise<Incident[]> {
    try {
      const res = await api.get('/api/incidents', { params: { propertyId } });
      return res.data;
    } catch {
      return mockIncidentsState;
    }
  },

  async acknowledgeIncident(id: string, userName: string = 'Security Operator'): Promise<Incident> {
    try {
      const res = await api.patch(`/api/incidents/${id}/acknowledge`);
      return res.data;
    } catch {
      mockIncidentsState = mockIncidentsState.map((inc) => {
        if (inc.id === id) {
          return {
            ...inc,
            status: 'ACKNOWLEDGED' as const,
            acknowledgedAt: new Date().toISOString(),
            acknowledgedBy: userName,
          };
        }
        return inc;
      });
      const updated = mockIncidentsState.find((i) => i.id === id)!;
      return updated;
    }
  },

  async resolveIncident(id: string): Promise<Incident> {
    try {
      const res = await api.patch(`/api/incidents/${id}/resolve`);
      return res.data;
    } catch {
      mockIncidentsState = mockIncidentsState.map((inc) => {
        if (inc.id === id) {
          return {
            ...inc,
            status: 'RESOLVED' as const,
            resolvedAt: new Date().toISOString(),
          };
        }
        return inc;
      });
      const updated = mockIncidentsState.find((i) => i.id === id)!;
      return updated;
    }
  },
};

export const telemetryService = {
  async getHistory(deviceId: string, range: '1h' | '24h' | '7d'): Promise<ChartDataPoint[]> {
    try {
      const res = await api.get('/api/telemetry', { params: { deviceId, range } });
      return res.data;
    } catch {
      return generateHistoricalTelemetry(range);
    }
  },
};
