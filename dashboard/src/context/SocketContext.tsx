import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { Property, ArmingState, ZoneThresholdConfig } from '../types/property';
import type { Incident } from '../types/incidents';
import type { TelemetryReading } from '../types/telemetry';
import { propertyService, incidentService } from '../services/api';
import { soundAlert } from '../services/soundAlert';

export type SocketConnectionState = 'connected' | 'reconnecting' | 'disconnected';

interface SocketContextType {
  socket: Socket | null;
  connectionState: SocketConnectionState;
  properties: Property[];
  currentProperty: Property | null;
  setCurrentProperty: (property: Property) => void;
  incidents: Incident[];
  activeCriticalCount: number;
  latestReadings: Record<string, TelemetryReading>;
  updateArmingState: (newState: ArmingState) => Promise<void>;
  updateZoneThresholds: (zoneId: string, thresholds: ZoneThresholdConfig) => Promise<void>;
  acknowledgeIncident: (incidentId: string) => Promise<void>;
  resolveIncident: (incidentId: string) => Promise<void>;
  triggerSimulationIncident: (hazardType: 'SMOKE' | 'WATER_LEAK' | 'MOTION' | 'HIGH_TEMP') => void;
  refreshData: () => Promise<void>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>('disconnected');
  const [properties, setProperties] = useState<Property[]>([]);
  const [currentProperty, setCurrentProperty] = useState<Property | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [latestReadings, setLatestReadings] = useState<Record<string, TelemetryReading>>({});

  const socketRef = useRef<Socket | null>(null);

  // Calculate active critical incidents
  const activeCriticalCount = incidents.filter(
    (inc) => inc.status === 'ACTIVE' && inc.severity === 'CRITICAL'
  ).length;

  // Sync sound alert with active critical count
  useEffect(() => {
    soundAlert.updateAlarmState(activeCriticalCount);
  }, [activeCriticalCount]);

  // Load initial data from REST API (or fallback mock)
  const refreshData = useCallback(async () => {
    try {
      const [props, incs] = await Promise.all([
        propertyService.getProperties(),
        incidentService.getIncidents(),
      ]);

      if (props.length > 0) {
        setProperties(props);
        setCurrentProperty((prev) => {
          if (!prev) return props[0];
          const found = props.find((p) => p.id === prev.id);
          return found || props[0];
        });

        // Initialize latest readings from property devices
        const initialReadings: Record<string, TelemetryReading> = {};
        props.forEach((prop) => {
          prop.zones?.forEach((zone) => {
            zone.devices?.forEach((dev) => {
              if (dev.latestReading) {
                initialReadings[dev.id] = dev.latestReading;
              }
            });
          });
        });
        setLatestReadings((prev) => ({ ...initialReadings, ...prev }));
      }

      setIncidents(incs);
    } catch (err) {
      console.warn('Initial data load fallback:', err);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Connect to Socket.IO backend
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
    const newSocket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      timeout: 5000,
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setConnectionState('connected');
      if (currentProperty) {
        newSocket.emit('join:property', { propertyId: currentProperty.id });
      }
    });

    newSocket.on('disconnect', () => {
      setConnectionState('disconnected');
    });

    newSocket.on('connect_error', () => {
      setConnectionState('reconnecting');
    });

    // 1. Telemetry updates
    newSocket.on('telemetry:update', (data: { deviceId: string; reading: TelemetryReading }) => {
      if (data && data.deviceId && data.reading) {
        setLatestReadings((prev) => ({
          ...prev,
          [data.deviceId]: data.reading,
        }));
      }
    });

    // 2. Incident created
    newSocket.on('incident:new', (newIncident: Incident) => {
      setIncidents((prev) => {
        // Prevent duplicate IDs
        const exists = prev.some((i) => i.id === newIncident.id);
        if (exists) return prev;
        return [newIncident, ...prev];
      });
    });

    // 3. Incident acknowledged
    newSocket.on('incident:acknowledged', (ackIncident: Incident) => {
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === ackIncident.id ? ackIncident : inc))
      );
    });

    // 4. Incident resolved
    newSocket.on('incident:resolved', (resIncident: Incident) => {
      setIncidents((prev) =>
        prev.map((inc) => (inc.id === resIncident.id ? resIncident : inc))
      );
    });

    // 5. Device online / offline status
    newSocket.on('device:status', (data: { deviceId: string; isOnline: boolean }) => {
      setProperties((prev) =>
        prev.map((prop) => ({
          ...prop,
          zones: prop.zones?.map((z) => ({
            ...z,
            devices: z.devices?.map((d) =>
              d.id === data.deviceId ? { ...d, isOnline: data.isOnline } : d
            ),
          })),
        }))
      );
    });

    // 6. Property arming changed
    newSocket.on('property:arming_changed', (data: { propertyId: string; armingState: ArmingState }) => {
      setProperties((prev) =>
        prev.map((p) => (p.id === data.propertyId ? { ...p, armingState: data.armingState } : p))
      );
      setCurrentProperty((prev) =>
        prev && prev.id === data.propertyId ? { ...prev, armingState: data.armingState } : prev
      );
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Update arming state
  const updateArmingState = async (newState: ArmingState) => {
    if (!currentProperty) return;
    try {
      const updated = await propertyService.updateArmingState(currentProperty.id, newState);
      setCurrentProperty(updated);
      setProperties((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    } catch (err) {
      console.error('Failed to change arming state:', err);
    }
  };

  // Update zone thresholds
  const updateZoneThresholds = async (zoneId: string, thresholds: ZoneThresholdConfig) => {
    if (!currentProperty) return;
    try {
      await propertyService.updateZoneThresholds(currentProperty.id, zoneId, thresholds);
      setCurrentProperty((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          zones: prev.zones?.map((z) =>
            z.id === zoneId ? { ...z, thresholdConfig: { ...z.thresholdConfig, ...thresholds } } : z
          ),
        };
      });
    } catch (err) {
      console.error('Failed to update thresholds:', err);
    }
  };

  // Acknowledge incident
  const acknowledgeIncident = async (incidentId: string) => {
    try {
      const updated = await incidentService.acknowledgeIncident(incidentId);
      setIncidents((prev) => prev.map((inc) => (inc.id === incidentId ? updated : inc)));
    } catch (err) {
      console.error('Failed to acknowledge incident:', err);
    }
  };

  // Resolve incident
  const resolveIncident = async (incidentId: string) => {
    try {
      const updated = await incidentService.resolveIncident(incidentId);
      setIncidents((prev) => prev.map((inc) => (inc.id === incidentId ? updated : inc)));
    } catch (err) {
      console.error('Failed to resolve incident:', err);
    }
  };

  // UI simulation helper for demoing alerts
  const triggerSimulationIncident = (hazardType: 'SMOKE' | 'WATER_LEAK' | 'MOTION' | 'HIGH_TEMP') => {
    const isCritical = hazardType === 'SMOKE' || hazardType === 'WATER_LEAK';
    const severity = isCritical ? 'CRITICAL' : 'WARNING';
    const id = `inc-sim-${Date.now().toString().slice(-4)}`;

    const zoneMap = {
      SMOKE: {
        zoneId: 'zone-kitchen',
        zoneName: 'Kitchen & Pantry',
        deviceId: 'ESP32_KITCHEN_01',
        readingValue: 560,
        details: 'MQ-2 detected intense smoke concentration (560 PPM)',
      },
      WATER_LEAK: {
        zoneId: 'zone-basement',
        zoneName: 'Basement & Utility Vault',
        deviceId: 'ESP32_BASEMENT_03',
        readingValue: 1.0,
        details: 'Water conductivity probe triggered near main utility pipe',
      },
      MOTION: {
        zoneId: 'zone-server',
        zoneName: 'Server Room & IT Rack',
        deviceId: 'ESP32_SERVER_02',
        readingValue: 1.0,
        details: 'HC-SR501 PIR motion sensor triggered while property Armed',
      },
      HIGH_TEMP: {
        zoneId: 'zone-server',
        zoneName: 'Server Room & IT Rack',
        deviceId: 'ESP32_SERVER_02',
        readingValue: 54.2,
        details: 'DHT22 temperature sensor logged 54.2°C critical spike',
      },
    };

    const target = zoneMap[hazardType];

    const newSimIncident: Incident = {
      id,
      propertyId: currentProperty?.id || 'prop-sunset-hq',
      deviceId: target.deviceId,
      hazardType,
      severity,
      status: 'ACTIVE',
      readingValue: target.readingValue,
      details: target.details,
      startedAt: new Date().toISOString(),
      device: {
        id: target.deviceId,
        name: target.deviceId,
        zoneId: target.zoneId,
        zone: {
          id: target.zoneId,
          name: target.zoneName,
        },
      },
    };

    setIncidents((prev) => [newSimIncident, ...prev]);

    // Update telemetry state to reflect the hazard
    setLatestReadings((prev) => {
      const current = prev[target.deviceId] || {
        deviceId: target.deviceId,
        recordedAt: new Date().toISOString(),
        temperature: 24,
        humidity: 50,
        smokePpm: 30,
        waterDetected: false,
        motionDetected: false,
        wifiRssi: -60,
      };

      return {
        ...prev,
        [target.deviceId]: {
          ...current,
          recordedAt: new Date().toISOString(),
          temperature: hazardType === 'HIGH_TEMP' ? 54.2 : current.temperature,
          smokePpm: hazardType === 'SMOKE' ? 560 : current.smokePpm,
          waterDetected: hazardType === 'WATER_LEAK' ? true : current.waterDetected,
          motionDetected: hazardType === 'MOTION' ? true : current.motionDetected,
        },
      };
    });
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        connectionState,
        properties,
        currentProperty,
        setCurrentProperty,
        incidents,
        activeCriticalCount,
        latestReadings,
        updateArmingState,
        updateZoneThresholds,
        acknowledgeIncident,
        resolveIncident,
        triggerSimulationIncident,
        refreshData,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
