import test from 'node:test';
import assert from 'node:assert/strict';
import { ArmingState, HazardType, IncidentSeverity, IncidentStatus } from '@prisma/client';
import { storageFallback, IIncident } from '../database/storageFallback';
import { db } from '../database/db';
import { telemetryService } from './telemetryService';
import { alertEngine } from './alertEngine';
import { mqttTopicHandler } from '../mqtt/topicHandler';

/**
 * End-to-end sensor simulation tests.
 *
 * These drive the real ingestion path (telemetry service -> alert engine ->
 * in-memory storage) exactly like the MQTT topic handler does, so the behaviour
 * the simulator exercises on a phone can be verified without a broker or
 * PostgreSQL: every sensor raises an incident, normalising clears it, and a
 * later spike raises a fresh incident instead of being swallowed by
 * deduplication.
 */

const PROPERTY_ID = 'prop_sunset_villa_001';
const ZONE_ID = 'zone_kitchen_001';
const DEVICE_ID = 'ESP32_A1B2C3';

const BASELINE = {
  temperature: 22,
  humidity: 45,
  smoke_ppm: 25,
  gas_ppm: 18,
  flame_detected: false,
  water_detected: false,
  motion_detected: false,
};

let clockOffset = 0;

function sendTelemetry(
  metrics: Partial<typeof BASELINE>,
  route: { propertyId: string; zoneId: string } = { propertyId: PROPERTY_ID, zoneId: ZONE_ID }
) {
  clockOffset += 1;
  return telemetryService.ingestTelemetry(route.propertyId, route.zoneId, DEVICE_ID, {
    deviceId: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000) + clockOffset,
    metrics: { ...BASELINE, ...metrics },
  });
}

function sendExplicitAlert(hazardType: string, severity: 'INFO' | 'WARNING' | 'CRITICAL', value: number) {
  return alertEngine.evaluateExplicitAlert(PROPERTY_ID, ZONE_ID, DEVICE_ID, {
    deviceId: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000) + clockOffset,
    hazardType,
    severity,
    value,
    message: `Simulated ${hazardType}`,
  });
}

function openIncidents(hazardType?: HazardType): IIncident[] {
  return [...storageFallback.incidents.values()].filter(
    (incident) =>
      incident.status !== IncidentStatus.RESOLVED &&
      (hazardType === undefined || incident.hazardType === hazardType)
  );
}

/** Two consecutive safe packets are required before an incident auto-resolves. */
async function normalizeAll() {
  await sendTelemetry({});
  await sendTelemetry({});
}

async function arm(state: ArmingState) {
  await db.updatePropertyArming(PROPERTY_ID, state);
}

test('every sensor raises an incident, normalising clears it, and a later spike raises a new one', async () => {
  const hazards: Array<{
    name: string;
    hazardType: HazardType;
    trigger: () => Promise<unknown>;
  }> = [
    { name: 'flame', hazardType: HazardType.FLAME, trigger: () => sendExplicitAlert('FLAME_DETECTED', 'CRITICAL', 95) },
    { name: 'gas', hazardType: HazardType.GAS_LEAK, trigger: () => sendExplicitAlert('GAS_LEAK', 'CRITICAL', 380) },
    { name: 'smoke', hazardType: HazardType.SMOKE, trigger: () => sendExplicitAlert('SMOKE_DETECTED', 'CRITICAL', 680) },
    { name: 'water', hazardType: HazardType.WATER_LEAK, trigger: () => sendExplicitAlert('WATER_LEAK', 'CRITICAL', 1) },
  ];

  for (const hazard of hazards) {
    await normalizeAll();
    assert.equal(openIncidents(hazard.hazardType).length, 0, `${hazard.name}: expected a clean slate`);

    await hazard.trigger();
    const raised = openIncidents(hazard.hazardType);
    assert.equal(raised.length, 1, `${hazard.name}: expected one open incident`);
    assert.equal(raised[0].severity, IncidentSeverity.CRITICAL, `${hazard.name}: expected CRITICAL`);
    const firstId = raised[0].id;

    // Pressing the same key again must not duplicate an already-open incident.
    await hazard.trigger();
    assert.equal(openIncidents(hazard.hazardType).length, 1, `${hazard.name}: duplicate incident created`);

    // Normalising closes the incident.
    await normalizeAll();
    assert.equal(openIncidents(hazard.hazardType).length, 0, `${hazard.name}: incident did not auto-resolve`);

    // ...and the next spike is visible again instead of being deduplicated away.
    await hazard.trigger();
    const raisedAgain = openIncidents(hazard.hazardType);
    assert.equal(raisedAgain.length, 1, `${hazard.name}: spike after normalising was ignored`);
    assert.notEqual(raisedAgain[0].id, firstId, `${hazard.name}: expected a new incident id`);
  }

  await normalizeAll();
});

test('metric-based telemetry alarms also raise and clear', async () => {
  await normalizeAll();

  await sendTelemetry({ smoke_ppm: 680 });
  assert.equal(openIncidents(HazardType.SMOKE).length, 1, 'smoke spike telemetry should raise SMOKE');

  await sendTelemetry({ gas_ppm: 380 });
  assert.equal(openIncidents(HazardType.GAS_LEAK).length, 1, 'gas spike telemetry should raise GAS_LEAK');

  await sendTelemetry({ flame_detected: true });
  assert.equal(openIncidents(HazardType.FLAME).length, 1, 'flame telemetry should raise FLAME');

  await sendTelemetry({ water_detected: true });
  assert.equal(openIncidents(HazardType.WATER_LEAK).length, 1, 'water telemetry should raise WATER_LEAK');

  await normalizeAll();
  assert.equal(openIncidents().length, 0, 'all environmental incidents should clear on normalise');
});

test('telemetry from stale topic IDs is routed to the enrolled property', async () => {
  await normalizeAll();

  // A simulator or re-flashed node with placeholder IDs must still be ingested.
  await sendTelemetry({ smoke_ppm: 680 }, { propertyId: 'prop_placeholder', zoneId: 'zone_placeholder' });

  const raised = openIncidents(HazardType.SMOKE);
  assert.equal(raised.length, 1, 'packet with stale routing IDs was dropped');
  assert.equal(raised[0].propertyId, PROPERTY_ID, 'incident was not attached to the enrolled property');

  const latest = await db.getLatestTelemetry(DEVICE_ID);
  assert.ok(latest, 'telemetry from stale routing IDs was not persisted');

  await normalizeAll();
});

test('motion only raises incidents while the property is armed', async () => {
  await arm(ArmingState.DISARMED);
  await normalizeAll();
  await sendTelemetry({ motion_detected: true });
  await sendExplicitAlert('MOTION', 'WARNING', 1);
  assert.equal(openIncidents(HazardType.MOTION).length, 0, 'motion must be ignored while DISARMED');

  await arm(ArmingState.ARMED_HOME);
  await sendTelemetry({ motion_detected: true });
  const home = openIncidents(HazardType.MOTION);
  assert.equal(home.length, 1, 'motion should raise an incident in ARMED_HOME');
  assert.equal(home[0].severity, IncidentSeverity.WARNING, 'ARMED_HOME motion should be a warning');
  await db.resolveIncident(home[0].id);

  await arm(ArmingState.ARMED_AWAY);
  await sendTelemetry({ motion_detected: true });
  const away = openIncidents(HazardType.MOTION);
  assert.equal(away.length, 1, 'motion should raise an incident in ARMED_AWAY');
  assert.equal(away[0].severity, IncidentSeverity.CRITICAL, 'ARMED_AWAY motion should be critical');
  await db.resolveIncident(away[0].id);

  // Motion is a momentary event and is not auto-resolved by safe telemetry.
  await sendTelemetry({});
  await sendTelemetry({});
  await arm(ArmingState.DISARMED);
  await normalizeAll();
});

test('acknowledged incidents still block duplicates until the hazard clears', async () => {
  await normalizeAll();
  await sendExplicitAlert('WATER_LEAK', 'CRITICAL', 1);
  const [incident] = openIncidents(HazardType.WATER_LEAK);
  assert.ok(incident);

  await db.acknowledgeIncident(incident.id);
  await sendExplicitAlert('WATER_LEAK', 'CRITICAL', 1);
  assert.equal(openIncidents(HazardType.WATER_LEAK).length, 1, 'acked incident should not duplicate');

  await normalizeAll();
  assert.equal(openIncidents(HazardType.WATER_LEAK).length, 0, 'acked incident should auto-resolve');
});

test('arming state changes are persisted for the app to read back', async () => {
  for (const state of [ArmingState.ARMED_AWAY, ArmingState.ARMED_HOME, ArmingState.DISARMED]) {
    const updated = await db.updatePropertyArming(PROPERTY_ID, state);
    assert.equal(updated?.armingState, state);
    const stored = await db.getPropertyById(PROPERTY_ID);
    assert.equal(stored?.armingState, state);
  }
});

test('MQTT topic handler accepts stale topic routes and rejects unknown devices', async () => {
  await normalizeAll();

  const alertTopic = `properties/prop_placeholder/zones/zone_placeholder/devices/${DEVICE_ID}/alert`;
  await mqttTopicHandler.handleMessage(
    alertTopic,
    Buffer.from(JSON.stringify({ deviceId: DEVICE_ID, hazardType: 'GAS_LEAK', severity: 'CRITICAL', value: 380 }))
  );
  assert.equal(openIncidents(HazardType.GAS_LEAK).length, 1, 'alert on a stale topic route was dropped');

  const telemetryTopic = `properties/prop_placeholder/zones/zone_placeholder/devices/${DEVICE_ID}/telemetry`;
  clockOffset += 1;
  await mqttTopicHandler.handleMessage(
    telemetryTopic,
    Buffer.from(JSON.stringify({
      deviceId: DEVICE_ID,
      timestamp: Math.floor(Date.now() / 1000) + clockOffset,
      metrics: { temperature: 22, humidity: 45, smoke_ppm: 680, gas_ppm: 18, flame_detected: false, water_detected: false, motion_detected: false },
    }))
  );
  assert.equal(openIncidents(HazardType.SMOKE).length, 1, 'telemetry on a stale topic route was dropped');

  await mqttTopicHandler.handleMessage(
    'properties/prop_placeholder/zones/zone_placeholder/devices/UNKNOWN_DEVICE/alert',
    Buffer.from(JSON.stringify({ deviceId: 'UNKNOWN_DEVICE', hazardType: 'FLAME_DETECTED', severity: 'CRITICAL' }))
  );
  assert.equal(openIncidents(HazardType.FLAME).length, 0, 'unknown devices must be rejected');

  await normalizeAll();
});
