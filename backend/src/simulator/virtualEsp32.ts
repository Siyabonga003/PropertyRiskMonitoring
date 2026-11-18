import mqtt, { MqttClient } from 'mqtt';
import readline from 'readline';

// Configuration
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const PROPERTY_ID = process.env.PROPERTY_ID || 'prop_sunset_villa_001';
const ZONE_ID = process.env.ZONE_ID || 'zone_kitchen_001';
const DEVICE_ID = process.env.DEVICE_ID || 'ESP32_A1B2C3';

const TELEMETRY_TOPIC = `properties/${PROPERTY_ID}/zones/${ZONE_ID}/devices/${DEVICE_ID}/telemetry`;
const ALERT_TOPIC = `properties/${PROPERTY_ID}/zones/${ZONE_ID}/devices/${DEVICE_ID}/alert`;
const STATUS_TOPIC = `devices/${DEVICE_ID}/status`;
const COMMAND_TOPIC = `devices/${DEVICE_ID}/commands`;

// Sensors can be driven without a TTY: `npm run simulate -- f n g n` or
// SIMULATE_SEQUENCE=f,g,s,w,n. Each step waits SIMULATE_STEP_MS (default 6s) so
// the 5s telemetry loop reports the new state before the next key runs.
const scriptedSequence = (process.env.SIMULATE_SEQUENCE ?? process.argv.slice(2).join(','))
  .split(',')
  .map((key) => key.trim().toLowerCase())
  .filter((key) => key.length > 0);
const scriptedStepMs = Number(process.env.SIMULATE_STEP_MS ?? 6000);
const keepAliveAfterSequence = process.env.SIMULATE_KEEP_ALIVE === '1';

// Sensor states
let temperature = 22.5;
let humidity = 45.0;
let smokePpm = 25.0;
let gasPpm = 18.0;
let flameDetected = false;
let waterDetected = false;
let motionDetected = false;
let buzzerActive = false;
let buzzerTimer: NodeJS.Timeout | null = null;
let uptimeSeconds = 0;

console.log('='.repeat(65));
console.log('  🌐 VIRTUAL ESP32 SENSOR NODE & ACTUATOR SIMULATOR');
console.log('='.repeat(65));
console.log(`Device ID:    ${DEVICE_ID}`);
console.log(`Property ID:  ${PROPERTY_ID}`);
console.log(`Zone ID:      ${ZONE_ID}`);
console.log(`Broker URL:   ${BROKER_URL}`);
console.log('The backend resolves the property/zone from the enrolled device, so the');
console.log('placeholder IDs above are only fallbacks. Override with PROPERTY_ID, ZONE_ID');
console.log('and DEVICE_ID if this node was paired as a different device.');
console.log('-'.repeat(65));
console.log('Interactive Keystrokes:');
console.log('  [f] -> Trigger Active Open Flame / Fire Incident & Alert');
console.log('  [g] -> Trigger Combustible Gas Leak Spike (350 ppm) & Alert');
console.log('  [s] -> Trigger High Smoke Spike (650 ppm) & Alert');
console.log('  [w] -> Trigger Water Leak Event & Alert');
console.log('  [m] -> Trigger Motion Event & Alert');
console.log('  [n] -> Normalize all sensors to nominal safe levels');
console.log('  [b] -> Test Local Buzzer Trigger');
console.log('  [q] -> Disconnect & Quit');
console.log('-'.repeat(65));
console.log('Motion is an intrusion event: the backend only raises it while the');
console.log('property is ARMED_HOME (warning) or ARMED_AWAY (critical). Arm it from the');
console.log('app first, otherwise [m] is intentionally ignored.');
console.log('After [n], incidents are auto-resolved once two consecutive safe packets');
console.log('arrive (~10s), so the next spike creates a fresh incident.');
console.log('-'.repeat(65));
console.log('Scripted (non-interactive) mode:');
console.log('  npm run simulate -- f n g n s n w n m n');
console.log('  SIMULATE_SEQUENCE=f,g,s,w,n npm run simulate');
console.log('='.repeat(65));

const client: MqttClient = mqtt.connect(BROKER_URL, {
  clientId: `sim_${DEVICE_ID}`,
  clean: true,
  will: {
    topic: STATUS_TOPIC,
    payload: Buffer.from(JSON.stringify({ status: 'offline', deviceId: DEVICE_ID })),
    qos: 1,
    retain: true,
  },
});

client.on('connect', () => {
  console.log(`✔ [Simulator] Connected to MQTT broker: ${BROKER_URL}`);

  // Publish Online LWT status
  client.publish(
    STATUS_TOPIC,
    JSON.stringify({ status: 'online', deviceId: DEVICE_ID }),
    { qos: 1, retain: true }
  );

  // Subscribe to commands
  client.subscribe(COMMAND_TOPIC, { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to subscribe to commands:`, err);
    } else {
      console.log(`👂 Listening for commands on: ${COMMAND_TOPIC}`);
    }
  });

  // Start periodic telemetry reporting (every 5 seconds)
  setInterval(publishTelemetry, 5000);
  publishTelemetry();

  if (scriptedSequence.length > 0) {
    void runScriptedSequence(scriptedSequence);
  }
});

client.on('message', (topic, message) => {
  if (topic === COMMAND_TOPIC) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`\n📥 [ACTUATOR COMMAND RECEIVED] =>`, payload);

      if (payload.command === 'TRIGGER_BUZZER') {
        const duration = payload.parameters?.durationMs || 15000;
        buzzerActive = true;
        console.log(`🚨 [HARDWARE BUZZER] >>> SIREN ACTIVE (Duration: ${duration}ms) <<<`);

        if (buzzerTimer) clearTimeout(buzzerTimer);
        buzzerTimer = setTimeout(() => {
          buzzerActive = false;
          console.log(`🔇 [HARDWARE BUZZER] Siren timed out. Resuming silent standby.`);
        }, duration);
      } else if (payload.command === 'SILENCE_BUZZER') {
        buzzerActive = false;
        if (buzzerTimer) clearTimeout(buzzerTimer);
        console.log(`🔇 [HARDWARE BUZZER] Buzzer silenced by remote command.`);
      }
    } catch (err: any) {
      console.error('Failed to parse command payload:', err.message);
    }
  }
});

function publishTelemetry() {
  uptimeSeconds += 5;

  // Add slight realistic jitter if in normal mode
  if (smokePpm < 100) {
    smokePpm = Math.max(10, Math.min(60, smokePpm + (Math.random() * 4 - 2)));
  }
  if (gasPpm < 80) {
    gasPpm = Math.max(10, Math.min(50, gasPpm + (Math.random() * 3 - 1.5)));
  }
  temperature = Math.max(18, Math.min(28, temperature + (Math.random() * 0.4 - 0.2)));
  humidity = Math.max(35, Math.min(65, humidity + (Math.random() * 0.6 - 0.3)));

  const payload = {
    deviceId: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    metrics: {
      temperature: Number(temperature.toFixed(1)),
      humidity: Number(humidity.toFixed(1)),
      smoke_ppm: Number(smokePpm.toFixed(1)),
      gas_ppm: Number(gasPpm.toFixed(1)),
      flame_detected: flameDetected,
      water_detected: waterDetected,
      motion_detected: motionDetected,
    },
    diagnostics: {
      wifi_rssi: -58 + Math.floor(Math.random() * 6),
      uptime_seconds: uptimeSeconds,
      free_heap: 184500,
      buzzer_active: buzzerActive,
    },
  };

  client.publish(TELEMETRY_TOPIC, JSON.stringify(payload), { qos: 0 }, (err) => {
    if (!err) {
      process.stdout.write(
        `\r📊 [${new Date().toLocaleTimeString()}] Temp: ${payload.metrics.temperature}°C | Hum: ${
          payload.metrics.humidity
        }% | Smoke: ${payload.metrics.smoke_ppm} ppm | Gas: ${payload.metrics.gas_ppm} ppm | Flame: ${
          flameDetected ? '🔥 FIRE!' : 'Safe'
        } | Water: ${
          waterDetected ? '💧 ACTIVE' : 'OK'
        } | Motion: ${motionDetected ? '🚶 DETECTED' : 'None'} | Buzzer: ${
          buzzerActive ? '🔊 ON' : 'OFF'
        }  `
      );
    }
  });
}

function triggerFlameAlert() {
  flameDetected = true;
  console.log(`\n\n🔥 [SIMULATING OPTICAL FLAME HAZARD] Open flame infrared radiation detected!`);
  const alertPayload = {
    deviceId: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    hazardType: 'FLAME_DETECTED',
    severity: 'CRITICAL',
    value: 95.0,
    unit: '%',
    message: 'Active open flame / fire detected in Kitchen zone!',
  };
  client.publish(ALERT_TOPIC, JSON.stringify(alertPayload), { qos: 1 });
  publishTelemetry();
}

function triggerGasAlert() {
  gasPpm = 380.0;
  console.log(`\n\n⚠️ [SIMULATING GAS LEAK] Combustible gas / LPG concentration spiked to ${gasPpm} PPM!`);
  const alertPayload = {
    deviceId: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    hazardType: 'GAS_LEAK',
    severity: 'CRITICAL',
    value: gasPpm,
    unit: 'ppm',
    message: 'Dangerous combustible gas / LPG concentration detected in Kitchen!',
  };
  client.publish(ALERT_TOPIC, JSON.stringify(alertPayload), { qos: 1 });
  publishTelemetry();
}

function triggerSmokeAlert() {
  smokePpm = 680.0;
  console.log(`\n\n🚨 [SIMULATING SMOKE SPIKE] Setting smoke to ${smokePpm} PPM!`);
  const alertPayload = {
    deviceId: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    hazardType: 'SMOKE_DETECTED',
    severity: 'CRITICAL',
    value: smokePpm,
    unit: 'ppm',
    message: 'Dangerous smoke concentration threshold exceeded in Kitchen!',
  };
  client.publish(ALERT_TOPIC, JSON.stringify(alertPayload), { qos: 1 });
  publishTelemetry();
}

function triggerWaterAlert() {
  waterDetected = true;
  console.log(`\n\n💧 [SIMULATING WATER LEAK] Water resistance probe triggered!`);
  const alertPayload = {
    deviceId: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    hazardType: 'WATER_LEAK',
    severity: 'CRITICAL',
    value: 1.0,
    unit: 'binary',
    message: 'Water leak detected on Kitchen floor probe!',
  };
  client.publish(ALERT_TOPIC, JSON.stringify(alertPayload), { qos: 1 });
  publishTelemetry();
}

function triggerMotionAlert() {
  motionDetected = true;
  console.log(`\n\n🚶 [SIMULATING MOTION EVENT] PIR sensor interrupt fired!`);
  const alertPayload = {
    deviceId: DEVICE_ID,
    timestamp: Math.floor(Date.now() / 1000),
    hazardType: 'MOTION',
    severity: 'WARNING',
    value: 1.0,
    unit: 'binary',
    message: 'Motion detected in Kitchen zone.',
  };
  client.publish(ALERT_TOPIC, JSON.stringify(alertPayload), { qos: 1 });
  publishTelemetry();

  // Reset motion after 8 seconds automatically
  setTimeout(() => {
    motionDetected = false;
    console.log(`\n🚶 [Motion] Sensor timed out, cleared.`);
  }, 8000);
}

function normalizeSensors() {
  console.log(`\n\n🌿 [NORMALIZING] Resetting all sensor metrics to safe baseline levels.`);
  flameDetected = false;
  smokePpm = 22.0;
  gasPpm = 18.0;
  waterDetected = false;
  motionDetected = false;
  temperature = 22.0;
  humidity = 45.0;
  buzzerActive = false;
  if (buzzerTimer) clearTimeout(buzzerTimer);
  publishTelemetry();
}

function handleKey(rawKey: string | undefined) {
  switch (rawKey?.toLowerCase()) {
    case 'f':
      triggerFlameAlert();
      return true;
    case 'g':
      triggerGasAlert();
      return true;
    case 's':
      triggerSmokeAlert();
      return true;
    case 'w':
      triggerWaterAlert();
      return true;
    case 'm':
      triggerMotionAlert();
      return true;
    case 'n':
      normalizeSensors();
      return true;
    case 'b':
      buzzerActive = !buzzerActive;
      console.log(`\n🔊 Buzzer manual toggle: ${buzzerActive ? 'ON' : 'OFF'}`);
      return true;
    case 'q':
      cleanupAndExit();
      return true;
    default:
      return false;
  }
}

async function runScriptedSequence(sequence: string[]) {
  console.log(`\n▶ [Simulator] Running scripted sequence: ${sequence.join(' -> ')}`);
  for (const key of sequence) {
    if (key === 'q') {
      cleanupAndExit();
      return;
    }
    const handled = handleKey(key);
    if (!handled) console.warn(`⚠ [Simulator] Ignoring unknown step '${key}'.`);
    await new Promise((resolve) => setTimeout(resolve, scriptedStepMs));
  }

  if (!keepAliveAfterSequence) {
    console.log('✔ [Simulator] Sequence complete. Disconnecting (set SIMULATE_KEEP_ALIVE=1 to stay connected).');
    cleanupAndExit();
  }
}

// Handle interactive keyboard input
if (process.stdin.isTTY) {
  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);

  process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      cleanupAndExit();
      return;
    }
    if (!handleKey(key.name)) {
      if (key.name) console.log(`\n(No simulator action bound to '${key.name}'.)`);
    }
  });
} else if (scriptedSequence.length === 0) {
  console.log('(Running in non-interactive terminal mode. Keystroke triggers disabled.)');
}

function cleanupAndExit() {
  console.log('\n\n🛑 Disconnecting virtual ESP32 and exiting...');
  client.publish(
    STATUS_TOPIC,
    JSON.stringify({ status: 'offline', deviceId: DEVICE_ID }),
    { qos: 1, retain: true },
    () => {
      client.end(true, () => {
        process.exit(0);
      });
    }
  );
}
