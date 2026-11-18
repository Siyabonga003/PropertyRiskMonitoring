import { HazardType, IncidentSeverity, ArmingState, IncidentStatus } from '@prisma/client';
import { db } from '../database/db';
import { DEFAULT_THRESHOLDS } from '../config/constants';
import { socketEmitter } from '../sockets/emitter';
import { mqttPublisher } from '../mqtt/publisher';
import { notificationService } from './notificationService';

export interface TelemetryPayloadMetrics {
  temperature?: number | null;
  humidity?: number | null;
  smoke_ppm?: number | null;
  gas_ppm?: number | null;
  flame_detected?: boolean;
  water_detected?: boolean;
  motion_detected?: boolean;
}

export interface HazardAlertPayload {
  deviceId: string;
  timestamp?: number;
  hazardType: string;
  severity?: 'INFO' | 'WARNING' | 'CRITICAL';
  value?: number;
  unit?: string;
  message?: string;
}

export class AlertEngine {
  /** Consecutive clear telemetry packets required before an incident is auto-resolved. */
  private static readonly CLEAR_READINGS_TO_RESOLVE = 2;
  private readonly clearStreaks = new Map<string, number>();

  /**
   * Evaluates periodic telemetry readings against safety thresholds and arming state
   */
  public async evaluateTelemetry(
    propertyId: string,
    zoneId: string,
    deviceId: string,
    metrics: TelemetryPayloadMetrics
  ) {
    // 1. Fetch zone configuration and property arming state
    const [zone, property] = await Promise.all([
      db.getZoneById(zoneId),
      db.getPropertyById(propertyId),
    ]);

    const armingState = property?.armingState || ArmingState.DISARMED;
    const zoneThresholds = (zone?.thresholdConfig as any) || {};

    const maxTemp = zoneThresholds.max_temp ?? DEFAULT_THRESHOLDS.TEMP_MAX_CELSIUS;
    const minTemp = zoneThresholds.min_temp ?? DEFAULT_THRESHOLDS.TEMP_MIN_CELSIUS;
    const criticalSmokePpm = zoneThresholds.smoke_ppm_critical ?? DEFAULT_THRESHOLDS.SMOKE_PPM_CRITICAL;
    const warningSmokePpm = zoneThresholds.smoke_ppm_warning ?? DEFAULT_THRESHOLDS.SMOKE_PPM_WARNING;
    const criticalGasPpm = zoneThresholds.gas_ppm_critical ?? DEFAULT_THRESHOLDS.GAS_PPM_CRITICAL;
    const warningGasPpm = zoneThresholds.gas_ppm_warning ?? DEFAULT_THRESHOLDS.GAS_PPM_WARNING;

    // --- CHECK 1: Optical Flame Detection (24/7 Immediate Critical Fire Hazard) ---
    if (metrics.flame_detected === true) {
      await this.handleHazardIncident({
        propertyId,
        deviceId,
        hazardType: HazardType.FLAME,
        severity: IncidentSeverity.CRITICAL,
        readingValue: 1.0,
        details: `Active open flame / fire detected in ${zone?.name || 'zone'}! Immediate fire suppression & evacuation priority.`,
      });
    }

    // --- CHECK 2: Combustible Gas / LPG Concentration (24/7 Priority) ---
    if (metrics.gas_ppm !== undefined && metrics.gas_ppm !== null) {
      if (metrics.gas_ppm >= criticalGasPpm) {
        await this.handleHazardIncident({
          propertyId,
          deviceId,
          hazardType: HazardType.GAS_LEAK,
          severity: IncidentSeverity.CRITICAL,
          readingValue: metrics.gas_ppm,
          details: `Combustible gas concentration (${metrics.gas_ppm.toFixed(1)} ppm) exceeded critical safety threshold (${criticalGasPpm} ppm) in ${zone?.name || 'zone'}. Explosion risk!`,
        });
      } else if (metrics.gas_ppm >= warningGasPpm) {
        await this.handleHazardIncident({
          propertyId,
          deviceId,
          hazardType: HazardType.GAS_LEAK,
          severity: IncidentSeverity.WARNING,
          readingValue: metrics.gas_ppm,
          details: `Elevated combustible gas / LPG detected (${metrics.gas_ppm.toFixed(1)} ppm) in ${zone?.name || 'zone'}.`,
        });
      }
    }

    // --- CHECK 3: Smoke PPM (24/7 Critical/Warning Hazard) ---
    if (metrics.smoke_ppm !== undefined && metrics.smoke_ppm !== null) {
      if (metrics.smoke_ppm >= criticalSmokePpm) {
        await this.handleHazardIncident({
          propertyId,
          deviceId,
          hazardType: HazardType.SMOKE,
          severity: IncidentSeverity.CRITICAL,
          readingValue: metrics.smoke_ppm,
          details: `Smoke PPM level (${metrics.smoke_ppm.toFixed(1)} ppm) exceeded critical safety threshold (${criticalSmokePpm} ppm) in ${zone?.name || 'zone'}.`,
        });
      } else if (metrics.smoke_ppm >= warningSmokePpm) {
        await this.handleHazardIncident({
          propertyId,
          deviceId,
          hazardType: HazardType.SMOKE,
          severity: IncidentSeverity.WARNING,
          readingValue: metrics.smoke_ppm,
          details: `Elevated smoke/gas detected (${metrics.smoke_ppm.toFixed(1)} ppm) in ${zone?.name || 'zone'}.`,
        });
      }
    }

    // --- CHECK 4: Water Leak Detected (24/7 Critical Hazard) ---
    if (metrics.water_detected === true) {
      await this.handleHazardIncident({
        propertyId,
        deviceId,
        hazardType: HazardType.WATER_LEAK,
        severity: IncidentSeverity.CRITICAL,
        readingValue: 1.0,
        details: `Active water leak detected on probe in ${zone?.name || 'zone'}! High risk of property water damage.`,
      });
    }

    // --- CHECK 3: Motion Detected (CONDITIONAL on Arming State) ---
    if (metrics.motion_detected === true) {
      if (armingState === ArmingState.ARMED_AWAY) {
        await this.handleHazardIncident({
          propertyId,
          deviceId,
          hazardType: HazardType.MOTION,
          severity: IncidentSeverity.CRITICAL,
          readingValue: 1.0,
          details: `Intrusion Alert: Motion detected while system is ARMED AWAY in ${zone?.name || 'zone'}.`,
        });
      } else if (armingState === ArmingState.ARMED_HOME) {
        await this.handleHazardIncident({
          propertyId,
          deviceId,
          hazardType: HazardType.MOTION,
          severity: IncidentSeverity.WARNING,
          readingValue: 1.0,
          details: `Perimeter motion detected while system is ARMED HOME in ${zone?.name || 'zone'}.`,
        });
      } else {
        // DISARMED: Motion is logged but DOES NOT create an intrusion incident
      }
    }

    // --- CHECK 4: Temperature Extremes (High / Freezing) ---
    if (metrics.temperature !== undefined && metrics.temperature !== null) {
      if (metrics.temperature >= maxTemp) {
        const isFireRisk = metrics.temperature > maxTemp + 15;
        await this.handleHazardIncident({
          propertyId,
          deviceId,
          hazardType: HazardType.HIGH_TEMP,
          severity: isFireRisk ? IncidentSeverity.CRITICAL : IncidentSeverity.WARNING,
          readingValue: metrics.temperature,
          details: `High temperature anomaly: ${metrics.temperature.toFixed(1)}°C exceeds limit (${maxTemp}°C) in ${zone?.name || 'zone'}.`,
        });
      } else if (metrics.temperature <= minTemp) {
        await this.handleHazardIncident({
          propertyId,
          deviceId,
          hazardType: HazardType.LOW_TEMP,
          severity: metrics.temperature <= 0 ? IncidentSeverity.CRITICAL : IncidentSeverity.WARNING,
          readingValue: metrics.temperature,
          details: `Freezing temperature hazard: ${metrics.temperature.toFixed(1)}°C is below freeze threshold (${minTemp}°C). Pipe burst hazard.`,
        });
      }
    }

    // --- RECONCILE: close incidents whose hazard has cleared ---
    // Without this, an incident stays open forever, deduplication suppresses
    // every later spike of the same hazard, and the app looks "stuck" on the
    // first event even after the sensors return to a safe baseline.
    await this.reconcileClearedHazards(deviceId, {
      [HazardType.FLAME]: metrics.flame_detected === true,
      [HazardType.GAS_LEAK]: metrics.gas_ppm != null && metrics.gas_ppm >= warningGasPpm,
      [HazardType.SMOKE]: metrics.smoke_ppm != null && metrics.smoke_ppm >= warningSmokePpm,
      [HazardType.WATER_LEAK]: metrics.water_detected === true,
      [HazardType.HIGH_TEMP]: metrics.temperature != null && metrics.temperature >= maxTemp,
      [HazardType.LOW_TEMP]: metrics.temperature != null && metrics.temperature <= minTemp,
    });
  }

  /**
   * Evaluates explicit hazard alerts published on the interrupt topic (.../alert)
   */
  public async evaluateExplicitAlert(
    propertyId: string,
    zoneId: string,
    deviceId: string,
    alertPayload: HazardAlertPayload
  ) {
    const device = await db.getDeviceById(deviceId);
    const enrolledPropertyId = await db.getPropertyIdForDevice(deviceId);
    if (!device || !enrolledPropertyId) {
      throw new Error(`Unknown device '${deviceId}'. Enroll and claim it before publishing alerts.`);
    }
    if (device.zoneId !== zoneId || enrolledPropertyId !== propertyId) {
      // Routing IDs from the wire are advisory only: the enrolled assignment is
      // authoritative, so a simulator or re-flashed node with stale IDs still
      // reaches the right property instead of being silently dropped.
      console.warn(
        `[Alert Engine] Alert topic route ${propertyId}/${zoneId} differs from enrolled assignment ` +
        `${enrolledPropertyId}/${device.zoneId}; using the enrolled assignment.`
      );
      propertyId = enrolledPropertyId;
      zoneId = device.zoneId;
    }
    let hazardType: HazardType;
    const rawType = (alertPayload.hazardType || '').toUpperCase();

    if (rawType.includes('FLAME') || rawType.includes('FIRE')) {
      hazardType = HazardType.FLAME;
    } else if (rawType.includes('GAS') || rawType.includes('LPG')) {
      hazardType = HazardType.GAS_LEAK;
    } else if (rawType.includes('WATER') || rawType.includes('LEAK')) {
      hazardType = HazardType.WATER_LEAK;
    } else if (rawType.includes('SMOKE')) {
      hazardType = HazardType.SMOKE;
    } else if (rawType.includes('MOTION') || rawType.includes('PIR')) {
      hazardType = HazardType.MOTION;
    } else if (rawType.includes('TEMP_HIGH')) {
      hazardType = HazardType.HIGH_TEMP;
    } else if (rawType.includes('TEMP_LOW') || rawType.includes('FREEZE')) {
      hazardType = HazardType.LOW_TEMP;
    } else if (rawType.includes('OFFLINE')) {
      hazardType = HazardType.DEVICE_OFFLINE;
    } else {
      throw new Error(`Unsupported hazard type '${alertPayload.hazardType}'.`);
    }

    let severity: IncidentSeverity = IncidentSeverity.CRITICAL;
    if (alertPayload.severity === 'WARNING') {
      severity = IncidentSeverity.WARNING;
    } else if (alertPayload.severity === 'INFO') {
      severity = IncidentSeverity.INFO;
    }

    // Motion alert check with arming state
    if (hazardType === HazardType.MOTION) {
      const property = await db.getPropertyById(propertyId);
      if (property?.armingState === ArmingState.DISARMED) {
        console.log(`[Alert Engine] Motion interrupt ignored because property is DISARMED.`);
        return;
      }
    }

    await this.handleHazardIncident({
      propertyId,
      deviceId,
      hazardType,
      severity,
      readingValue: alertPayload.value,
      details: alertPayload.message || `Interrupt alert triggered for ${hazardType}`,
    });
  }

  /**
   * Resolves open incidents for environmental hazards that are no longer present.
   * A hazard must read clear for consecutive packets before an incident is closed
   * so that one glitched packet cannot silently clear a genuine alarm.
   */
  private async reconcileClearedHazards(
    deviceId: string,
    activeHazards: Partial<Record<HazardType, boolean>>
  ) {
    for (const [hazardType, active] of Object.entries(activeHazards) as [HazardType, boolean][]) {
      const streakKey = `${deviceId}:${hazardType}`;
      if (active) {
        this.clearStreaks.delete(streakKey);
        continue;
      }

      const streak = (this.clearStreaks.get(streakKey) ?? 0) + 1;
      this.clearStreaks.set(streakKey, streak);
      if (streak < AlertEngine.CLEAR_READINGS_TO_RESOLVE) continue;

      const open = await db.getActiveIncidentByHazard(deviceId, hazardType);
      if (!open) {
        this.clearStreaks.delete(streakKey);
        continue;
      }

      const resolved = await db.resolveIncident(open.id);
      this.clearStreaks.delete(streakKey);
      if (!resolved) continue;

      console.log(
        `✅ [ALERT ENGINE] Auto-resolved ${resolved.hazardType} incident ${resolved.id} ` +
        `on device ${deviceId} — readings back within safe limits.`
      );
      socketEmitter.emitIncidentResolved(resolved.propertyId, resolved);
      if (resolved.severity === IncidentSeverity.CRITICAL) {
        await mqttPublisher.silenceBuzzer(deviceId).catch(() => false);
      }
    }
  }

  /**
   * Internal deduplication and dispatch handler
   */
  private async handleHazardIncident(params: {
    propertyId: string;
    deviceId: string;
    hazardType: HazardType;
    severity: IncidentSeverity;
    readingValue?: number | null;
    details?: string | null;
  }) {
    // Check if there is already an ACTIVE incident for this device and hazard type
    const existing = await db.getActiveIncidentByHazard(params.deviceId, params.hazardType);
    if (existing) {
      // Incident is already active/acknowledged, avoid duplicate spam
      return existing;
    }

    // 1. Persist new Incident in Database
    const incident = await db.createIncident(params);
    console.log(
      `🔥 [ALERT ENGINE] NEW INCIDENT CREATED: [${incident.severity}] ${incident.hazardType} (ID: ${incident.id}) on device ${incident.deviceId}`
    );

    // 2. Out-of-band notification
    const property = await db.getPropertyById(params.propertyId);
    notificationService.dispatchAlert(incident, property?.name);

    // 3. Emit real-time Socket.IO notification to dashboard rooms
    socketEmitter.emitNewIncident(params.propertyId, incident);

    // 4. If CRITICAL, trigger audible hardware buzzer via MQTT
    if (incident.severity === IncidentSeverity.CRITICAL) {
      console.log(`📢 [ALERT ENGINE] Triggering audible siren on device ${incident.deviceId} via MQTT!`);
      await mqttPublisher.triggerBuzzer(incident.deviceId, 30000, 'PULSE');
    }

    return incident;
  }
}

export const alertEngine = new AlertEngine();
