/**
 * ============================================================================
 * IoT Property Risk Monitoring System - ESP32 Edge Firmware
 * ============================================================================
 * 
 * Features:
 * - Multi-hazard sensing: DHT22, MQ-2 Smoke, Water Leak probe, HC-SR501 PIR.
 * - Hardware Interrupt Service Routines (ISRs) for instant critical hazard dispatch.
 * - Non-blocking Wi-Fi state machine with auto-reconnection and NTP sync.
 * - PubSubClient MQTT with LWT (Last Will & Testament) and QoS 1 alerts.
 * - HTTP REST ingestion fallback when MQTT broker is unreachable.
 * - Multi-cadence active buzzer tones & status LED indications.
 * - Dynamic telemetry reporting interval configuration.
 * ============================================================================
 */

#include <Arduino.h>
#include "config.h"
#include "pins.h"
#include "types.h"
#include "dht_sensor.h"
#include "smoke_sensor.h"
#include "flame_sensor.h"
#include "water_sensor.h"
#include "motion_sensor.h"
#include "buzzer.h"
#include "status_led.h"
#include "wifi_manager.h"
#include "mqtt_manager.h"
#include "http_client.h"

// FreeRTOS ISR synchronization primitives
static portMUX_TYPE isrMux = portMUX_INITIALIZER_UNLOCKED;

// Volatile ISR hazard flags & debounce timestamps
static volatile bool s_waterInterruptFlag = false;
static volatile unsigned long s_waterInterruptTime = 0;

static volatile bool s_motionInterruptFlag = false;
static volatile unsigned long s_motionInterruptTime = 0;

static volatile bool s_smokeInterruptFlag = false;
static volatile unsigned long s_smokeInterruptTime = 0;

static volatile bool s_flameInterruptFlag = false;
static volatile unsigned long s_flameInterruptTime = 0;

// Runtime state & timers
static uint32_t s_telemetryIntervalMs = TELEMETRY_INTERVAL_MS;
static unsigned long s_lastTelemetryTime = 0;
static unsigned long s_lastSensorSampleTime = 0;

// Alert debounce timestamps to prevent alert flooding
static unsigned long s_lastWaterAlertTime = 0;
static unsigned long s_lastSmokeAlertTime = 0;
static unsigned long s_lastGasAlertTime = 0;
static unsigned long s_lastFlameAlertTime = 0;
static unsigned long s_lastMotionAlertTime = 0;
static unsigned long s_lastTempAlertTime = 0;

// ============================================================================
// Hardware Interrupt Service Routines (IRAM_ATTR)
// ============================================================================

void IRAM_ATTR isrFlameDetected() {
    portENTER_CRITICAL_ISR(&isrMux);
    s_flameInterruptFlag = true;
    s_flameInterruptTime = millis();
    portEXIT_CRITICAL_ISR(&isrMux);
}

void IRAM_ATTR isrWaterLeak() {
    portENTER_CRITICAL_ISR(&isrMux);
    s_waterInterruptFlag = true;
    s_waterInterruptTime = millis();
    portEXIT_CRITICAL_ISR(&isrMux);
}

void IRAM_ATTR isrMotionDetected() {
    portENTER_CRITICAL_ISR(&isrMux);
    s_motionInterruptFlag = true;
    s_motionInterruptTime = millis();
    portEXIT_CRITICAL_ISR(&isrMux);
}

void IRAM_ATTR isrSmokeThreshold() {
    portENTER_CRITICAL_ISR(&isrMux);
    s_smokeInterruptFlag = true;
    s_smokeInterruptTime = millis();
    portEXIT_CRITICAL_ISR(&isrMux);
}

// ============================================================================
// Forward Declarations
// ============================================================================

void handleHazardAlerts(const SensorMetrics &metrics);
void dispatchHazardAlert(const AlertEvent &alert);
void sendTelemetry(const SensorMetrics &metrics);
void onTelemetryIntervalChanged(uint32_t newIntervalMs);

// ============================================================================
// Setup
// ============================================================================

void setup() {
    Serial.begin(115200);
    delay(500);

    Serial.println("\n========================================================");
    Serial.println("  IoT Property Risk Monitoring System - Edge Firmware   ");
    Serial.printf("  Device ID:  %s\n", DEVICE_ID);
    Serial.printf("  Firmware:   v%s\n", FIRMWARE_VERSION);
    Serial.printf("  Property:   %s | Zone: %s\n", PROPERTY_ID, ZONE_ID);
    Serial.println("========================================================\n");

    // Initialize actuators first for clear status feedback
    statusLed.begin();
    buzzer.begin();

    // Confirmation startup chirp
    buzzer.beep(120);

    // Initialize modular sensor drivers
    dhtSensor.begin();
    smokeSensor.begin();
    flameSensor.begin();
    waterSensor.begin();
    motionSensor.begin();

    // Configure and attach Hardware Interrupts
    // Optical flame sensor D0 is active LOW (falling edge when IR flame sensed)
    attachInterrupt(digitalPinToInterrupt(PIN_FLAME_DIGITAL), isrFlameDetected, FALLING);

    // Water probe D0 is active LOW (falling edge when submerged)
    attachInterrupt(digitalPinToInterrupt(PIN_WATER_DIGITAL), isrWaterLeak, FALLING);

    // PIR motion sensor is active HIGH (rising edge when movement sensed)
    attachInterrupt(digitalPinToInterrupt(PIN_PIR_MOTION), isrMotionDetected, RISING);

    // MQ-2 digital comparator D0 is active LOW on threshold breach
    attachInterrupt(digitalPinToInterrupt(PIN_SMOKE_DIGITAL), isrSmokeThreshold, FALLING);

    Serial.println("[ISR] Hardware interrupts attached for Flame, Water, PIR, and Smoke pins.");

    // Initialize Network Managers
    wifiManager.begin(WIFI_SSID, WIFI_PASSWORD);
    mqttManager.begin(MQTT_BROKER_HOST, MQTT_BROKER_PORT, MQTT_USERNAME, MQTT_PASSWORD);
    mqttManager.onIntervalChange(onTelemetryIntervalChanged);
    httpClient.begin(HTTP_BACKEND_BASE_URL, DEVICE_TOKEN);

    Serial.println("[System] Setup completed successfully. Entering main operational loop.");
}

// ============================================================================
// Main Loop
// ============================================================================

void loop() {
    unsigned long now = millis();

    // 1. Maintain background network connections and actuator state machines
    wifiManager.update();
    mqttManager.update();
    buzzer.update();
    statusLed.update();

    // Update LED mode when not in local alarm mode
    if (buzzer.getCurrentPattern() == BUZZER_IDLE) {
        if (!wifiManager.isConnected()) {
            statusLed.setMode(LED_MODE_DISCONNECTED);
        } else if (!mqttManager.isConnected()) {
            statusLed.setMode(LED_MODE_CONNECTING);
        } else {
            statusLed.setMode(LED_MODE_CONNECTED);
        }
    } else {
        statusLed.setMode(LED_MODE_ALARM);
    }

    // 2. Fetch sensor readings (periodic local sampling)
    SensorMetrics metrics = {};
    if (now - s_lastSensorSampleTime >= SENSOR_SAMPLE_INTERVAL_MS || s_lastSensorSampleTime == 0) {
        s_lastSensorSampleTime = now;

        // Sample DHT22
        metrics.dht_valid = dhtSensor.read(metrics.temperature, metrics.humidity);

        // Sample MQ-2 Dual Gas (Smoke and Combustible Gas/LPG)
        metrics.smoke_ppm = smokeSensor.readSmokePPM();
        metrics.gas_ppm = smokeSensor.readGasPPM();
        metrics.smoke_raw_adc = smokeSensor.readRawADC(5);
        metrics.smoke_digital_alarm = smokeSensor.isDigitalAlarmActive();

        // Sample Optical Flame Sensor
        metrics.flame_detected = flameSensor.isFlameDetected(FLAME_THRESHOLD_PCT);
        metrics.flame_intensity_pct = flameSensor.readIntensityPct();
        metrics.flame_raw_adc = flameSensor.getCachedRaw();

        // Sample Water Leak
        metrics.water_raw_adc = waterSensor.readRawADC(5);
        metrics.water_level_pct = waterSensor.readWetnessPct();
        metrics.water_detected = waterSensor.isWaterDetected(WATER_THRESHOLD_PCT);

        // Sample PIR Motion
        metrics.motion_detected = motionSensor.isMotionDetected();
    } else {
        // Use cached metrics for fast interrupt loop cycles
        metrics.temperature = dhtSensor.getTemperature();
        metrics.humidity = dhtSensor.getHumidity();
        metrics.dht_valid = dhtSensor.isValid();
        metrics.smoke_ppm = smokeSensor.getCachedSmokePpm();
        metrics.gas_ppm = smokeSensor.getCachedGasPpm();
        metrics.smoke_raw_adc = smokeSensor.readRawADC(2);
        metrics.smoke_digital_alarm = smokeSensor.isDigitalAlarmActive();
        metrics.flame_detected = flameSensor.getCachedDigital() || (flameSensor.getCachedIntensity() >= FLAME_THRESHOLD_PCT);
        metrics.flame_intensity_pct = flameSensor.getCachedIntensity();
        metrics.flame_raw_adc = flameSensor.getCachedRaw();
        metrics.water_raw_adc = waterSensor.readRawADC(2);
        metrics.water_level_pct = waterSensor.readWetnessPct();
        metrics.water_detected = waterSensor.isWaterDetected(WATER_THRESHOLD_PCT);
        metrics.motion_detected = motionSensor.isMotionDetected();
    }

    // 3. Evaluate immediate hazard interrupts and risk conditions
    handleHazardAlerts(metrics);

    // 4. Send periodic telemetry
    if (now - s_lastTelemetryTime >= s_telemetryIntervalMs || s_lastTelemetryTime == 0) {
        s_lastTelemetryTime = now;
        sendTelemetry(metrics);
    }

    // Small yield to allow FreeRTOS background tasks (Wi-Fi/IP stack) to run smoothly
    vTaskDelay(pdMS_TO_TICKS(10));
}

// ============================================================================
// Hazard Alert Processing & Immediate Dispatch
// ============================================================================

void handleHazardAlerts(const SensorMetrics &metrics) {
    unsigned long now = millis();

    // Copy and reset ISR flags inside critical section
    bool waterFlag = false;
    bool motionFlag = false;
    bool smokeFlag = false;
    bool flameFlag = false;

    portENTER_CRITICAL(&isrMux);
    if (s_flameInterruptFlag) {
        flameFlag = true;
        s_flameInterruptFlag = false;
    }
    if (s_waterInterruptFlag) {
        waterFlag = true;
        s_waterInterruptFlag = false;
    }
    if (s_motionInterruptFlag) {
        motionFlag = true;
        s_motionInterruptFlag = false;
    }
    if (s_smokeInterruptFlag) {
        smokeFlag = true;
        s_smokeInterruptFlag = false;
    }
    portEXIT_CRITICAL(&isrMux);

    // ------------------------------------------------------------------------
    // 1. OPTICAL FLAME HAZARD (CRITICAL - 24/7 Highest Priority)
    // ------------------------------------------------------------------------
    bool flameActive = flameFlag || metrics.flame_detected || flameSensor.isDigitalActive();
    if (flameActive && (now - s_lastFlameAlertTime >= SENSOR_DEBOUNCE_TIME_MS)) {
        s_lastFlameAlertTime = now;
        Serial.printf("\n[ALERT] *** CRITICAL: ACTIVE FLAME / FIRE DETECTED (%.1f%% IR)! ***\n",
                      metrics.flame_intensity_pct);

        // Sound rapid high-priority fire siren & flash alarm strobe
        buzzer.trigger(BUZZER_PATTERN_FLAME, 30000);
        statusLed.setMode(LED_MODE_ALARM);

        AlertEvent alert = {
            .hazard = HAZARD_FLAME,
            .severity = SEV_CRITICAL,
            .value = metrics.flame_intensity_pct,
            .unit = "%",
            .message = "CRITICAL: Open flame or fire source detected!",
            .timestamp = wifiManager.getEpochTime()
        };
        dispatchHazardAlert(alert);
    }

    // ------------------------------------------------------------------------
    // 2. COMBUSTIBLE GAS / LPG LEAK HAZARD (CRITICAL - 24/7 Priority)
    // ------------------------------------------------------------------------
    bool gasActive = (metrics.gas_ppm >= GAS_THRESHOLD_PPM);
    if (gasActive && (now - s_lastGasAlertTime >= SENSOR_DEBOUNCE_TIME_MS)) {
        s_lastGasAlertTime = now;
        Serial.printf("\n[ALERT] *** CRITICAL: COMBUSTIBLE GAS / LPG LEAK (%.1f PPM)! ***\n", metrics.gas_ppm);

        buzzer.trigger(BUZZER_PATTERN_GAS, 30000);
        statusLed.setMode(LED_MODE_ALARM);

        AlertEvent alert = {
            .hazard = HAZARD_GAS_LEAK,
            .severity = SEV_CRITICAL,
            .value = metrics.gas_ppm,
            .unit = "ppm",
            .message = "Dangerous combustible gas (LPG/Methane) leak concentration detected!",
            .timestamp = wifiManager.getEpochTime()
        };
        dispatchHazardAlert(alert);
    }

    // ------------------------------------------------------------------------
    // 3. WATER LEAK HAZARD (CRITICAL - 24/7 Priority)
    // ------------------------------------------------------------------------
    bool waterActive = waterFlag || metrics.water_detected || waterSensor.isDigitalActive();
    if (waterActive && (now - s_lastWaterAlertTime >= SENSOR_DEBOUNCE_TIME_MS)) {
        s_lastWaterAlertTime = now;
        Serial.println("\n[ALERT] *** CRITICAL: WATER LEAK DETECTED! ***");

        // Sound emergency water tone & flash alarm strobe
        buzzer.trigger(BUZZER_PATTERN_WATER, 30000);
        statusLed.setMode(LED_MODE_ALARM);

        AlertEvent alert = {
            .hazard = HAZARD_WATER_LEAK,
            .severity = SEV_CRITICAL,
            .value = metrics.water_level_pct,
            .unit = "%",
            .message = "Critical water leak detected at probe sensor!",
            .timestamp = wifiManager.getEpochTime()
        };
        dispatchHazardAlert(alert);
    }

    // ------------------------------------------------------------------------
    // B. SMOKE & COMBUSTIBLE GAS HAZARD (CRITICAL - 24/7 Priority)
    // ------------------------------------------------------------------------
    bool smokeActive = smokeFlag || metrics.smoke_digital_alarm || (metrics.smoke_ppm >= SMOKE_THRESHOLD_PPM);
    if (smokeActive && (now - s_lastSmokeAlertTime >= SENSOR_DEBOUNCE_TIME_MS)) {
        s_lastSmokeAlertTime = now;
        Serial.printf("\n[ALERT] *** CRITICAL: SMOKE DETECTED (%.1f PPM)! ***\n", metrics.smoke_ppm);

        // Sound rapid urgent smoke tone & flash alarm strobe
        buzzer.trigger(BUZZER_PATTERN_SMOKE, 30000);
        statusLed.setMode(LED_MODE_ALARM);

        AlertEvent alert = {
            .hazard = HAZARD_SMOKE,
            .severity = SEV_CRITICAL,
            .value = metrics.smoke_ppm,
            .unit = "ppm",
            .message = "Dangerous smoke concentration threshold exceeded!",
            .timestamp = wifiManager.getEpochTime()
        };
        dispatchHazardAlert(alert);
    }

    // ------------------------------------------------------------------------
    // C. PIR MOTION DETECTION (WARNING - Arming evaluation done by backend)
    // ------------------------------------------------------------------------
    bool motionActive = motionFlag || metrics.motion_detected;
    if (motionActive && (now - s_lastMotionAlertTime >= (SENSOR_DEBOUNCE_TIME_MS * 2))) {
        s_lastMotionAlertTime = now;
        Serial.println("[ALERT] Motion detected in monitored zone.");

        // Quick chirp
        buzzer.trigger(BUZZER_PATTERN_MOTION, 1500);

        AlertEvent alert = {
            .hazard = HAZARD_MOTION,
            .severity = SEV_WARNING,
            .value = 1.0f,
            .unit = "event",
            .message = "Motion detected in monitored zone",
            .timestamp = wifiManager.getEpochTime()
        };
        dispatchHazardAlert(alert);

        motionSensor.clearMotionFlag();
    }

    // ------------------------------------------------------------------------
    // D. TEMPERATURE HAZARDS (HIGH / LOW)
    // ------------------------------------------------------------------------
    if (metrics.dht_valid && (now - s_lastTempAlertTime >= 60000)) { // 1 min debounce
        if (metrics.temperature >= TEMP_HIGH_THRESHOLD_C) {
            s_lastTempAlertTime = now;
            Serial.printf("[ALERT] High temperature warning: %.1f C\n", metrics.temperature);
            buzzer.trigger(BUZZER_PATTERN_SMOKE, 5000);

            AlertEvent alert = {
                .hazard = HAZARD_HIGH_TEMP,
                .severity = SEV_CRITICAL,
                .value = metrics.temperature,
                .unit = "C",
                .message = "Critical high temperature detected!",
                .timestamp = wifiManager.getEpochTime()
            };
            dispatchHazardAlert(alert);
        } else if (metrics.temperature <= TEMP_LOW_THRESHOLD_C) {
            s_lastTempAlertTime = now;
            Serial.printf("[ALERT] Freezing temperature warning: %.1f C\n", metrics.temperature);

            AlertEvent alert = {
                .hazard = HAZARD_LOW_TEMP,
                .severity = SEV_WARNING,
                .value = metrics.temperature,
                .unit = "C",
                .message = "Pipe freeze risk: low temperature detected",
                .timestamp = wifiManager.getEpochTime()
            };
            dispatchHazardAlert(alert);
        }
    }
}

// ============================================================================
// Alert Dispatcher (MQTT QoS 1 with HTTP REST Fallback)
// ============================================================================

void dispatchHazardAlert(const AlertEvent &alert) {
    bool published = false;

    // Primary: Publish via MQTT broker
    if (mqttManager.isConnected()) {
        published = mqttManager.publishAlert(alert);
    }

    // Fallback: If MQTT is disconnected or publish failed, dispatch via HTTP REST
    if (!published && wifiManager.isConnected()) {
        Serial.println("[Alert Dispatch] MQTT unavailable, attempting HTTP REST fallback...");
        published = httpClient.postAlert(alert);
    }

    if (!published) {
        Serial.println("[Alert Dispatch] Warning: Alert could not be delivered to remote backend!");
    }
}

// ============================================================================
// Telemetry Reporting (MQTT with HTTP Fallback)
// ============================================================================

void sendTelemetry(const SensorMetrics &metrics) {
    SystemDiagnostics diag = {
        .wifi_rssi = wifiManager.getRSSI(),
        .uptime_seconds = (uint32_t)(millis() / 1000),
        .free_heap = esp_get_free_heap_size(),
        .min_free_heap = esp_get_minimum_free_heap_size(),
        .wifi_connected = wifiManager.isConnected(),
        .mqtt_connected = mqttManager.isConnected()
    };

    Serial.printf("[Telemetry] Temp: %.1f C | Hum: %.1f%% | Smoke: %.1f ppm | Gas: %.1f ppm | Flame: %s | Water: %s | Motion: %s | FreeHeap: %u B\n",
                  metrics.temperature, metrics.humidity, metrics.smoke_ppm,
                  metrics.gas_ppm,
                  metrics.flame_detected ? "FIRE!" : "Safe",
                  metrics.water_detected ? "YES" : "NO",
                  metrics.motion_detected ? "YES" : "NO",
                  diag.free_heap);

    bool published = false;
    if (mqttManager.isConnected()) {
        published = mqttManager.publishTelemetry(metrics, diag);
    }

    // Fallback: HTTP POST if MQTT is unreachable
    if (!published && wifiManager.isConnected()) {
        Serial.println("[Telemetry] MQTT offline, submitting via HTTP REST fallback...");
        httpClient.postTelemetry(metrics, diag);
    }
}

// ============================================================================
// Dynamic Telemetry Interval Configuration Callback
// ============================================================================

void onTelemetryIntervalChanged(uint32_t newIntervalMs) {
    if (newIntervalMs >= 1000 && newIntervalMs <= 300000) {
        s_telemetryIntervalMs = newIntervalMs;
        Serial.printf("[Config] Telemetry interval updated to %u ms\n", s_telemetryIntervalMs);
    }
}
