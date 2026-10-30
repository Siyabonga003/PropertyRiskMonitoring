#include "smoke_sensor.h"
#include "pins.h"
#include <math.h>

// MQ-2 standard curves constants for Smoke/LPG
// Formula: PPM = A * (Rs/Ro)^B
static constexpr float MQ2_SMOKE_CURVE_A = 658.71f;
static constexpr float MQ2_SMOKE_CURVE_B = -2.168f;
static constexpr float MQ2_CLEAN_AIR_RATIO = 9.83f; // Rs / Ro in fresh air
static constexpr float DEFAULT_RL_KOHMS = 5.0f;     // 5kOhm potentiometer load resistor

SmokeSensor smokeSensor;

SmokeSensor::SmokeSensor()
    : _ro(10.0f),
      _rl(DEFAULT_RL_KOHMS),
      _cachedPpm(0.0f),
      _cachedRaw(0),
      _cachedDigital(false),
      _lastSampleTime(0) {}

void SmokeSensor::begin() {
    pinMode(PIN_SMOKE_DIGITAL, INPUT_PULLUP);
    
    // ESP32 ADC configuration for GPIO 34 (ADC1)
    analogReadResolution(12);               // 12-bit (0 - 4095)
    analogSetAttenuation(ADC_11db);         // Full 0 - 3.3V range

    Serial.printf("[MQ-2] Initialized on Analog GPIO %d, Digital GPIO %d\n",
                  PIN_SMOKE_ANALOG, PIN_SMOKE_DIGITAL);

    // Initial clean-air baseline calibration check
    calibrateRo(10);
}

void SmokeSensor::calibrateRo(uint8_t sampleCount) {
    Serial.println("[MQ-2] Calibrating baseline resistance Ro in clean air...");
    float totalRs = 0.0f;
    uint8_t validSamples = 0;

    for (uint8_t i = 0; i < sampleCount; ++i) {
        int raw = readRawADC(5);
        float rs = readRs(raw);
        if (rs > 0.1f) {
            totalRs += rs;
            validSamples++;
        }
        delay(50);
    }

    if (validSamples > 0) {
        float avgRs = totalRs / validSamples;
        _ro = avgRs / MQ2_CLEAN_AIR_RATIO;
        if (_ro < 0.5f) _ro = 10.0f; // Sanity fallback if sensor was unheated
        Serial.printf("[MQ-2] Calibration completed. Avg Rs = %.2f kOhm, Baseline Ro = %.2f kOhm\n",
                      avgRs, _ro);
    } else {
        _ro = 10.0f; // Default factory baseline fallback
        Serial.println("[MQ-2] Calibration warning: Using default Ro = 10.0 kOhm");
    }
}

int SmokeSensor::readRawADC(uint8_t samples) {
    uint32_t sum = 0;
    for (uint8_t i = 0; i < samples; ++i) {
        sum += analogRead(PIN_SMOKE_ANALOG);
        delayMicroseconds(200);
    }
    _cachedRaw = sum / samples;
    return _cachedRaw;
}

float SmokeSensor::readRs(int rawAdc) {
    if (rawAdc < 0) {
        rawAdc = readRawADC(5);
    }

    // Safety checks for ADC limits
    if (rawAdc <= 5) return 1000.0f; // Sensor resistance very high (clean)
    if (rawAdc >= 4090) return 0.01f; // High gas saturation

    // Sensor resistance calculation:
    // Vout = Vcc * (RL / (Rs + RL))
    // Rs = RL * (4095.0 - ADC) / ADC
    float rs = _rl * ((4095.0f - (float)rawAdc) / (float)rawAdc);
    return rs;
}

float SmokeSensor::readPPM() {
    int raw = readRawADC(10);
    float rs = readRs(raw);

    if (_ro <= 0.01f) _ro = 10.0f;

    float ratio = rs / _ro;
    if (ratio <= 0.001f) ratio = 0.001f;

    // PPM calculation from log curve
    float ppm = MQ2_SMOKE_CURVE_A * powf(ratio, MQ2_SMOKE_CURVE_B);

    // Clamp to realistic bounds for MQ-2
    if (ppm < 10.0f) ppm = 10.0f;
    if (ppm > 10000.0f) ppm = 10000.0f;

    _cachedPpm = ppm;
    _lastSampleTime = millis();
    return _cachedPpm;
}

bool SmokeSensor::isDigitalAlarmActive() {
    // Digital pin on LM393 module is active LOW when threshold exceeded
    _cachedDigital = (digitalRead(PIN_SMOKE_DIGITAL) == LOW);
    return _cachedDigital;
}

bool SmokeSensor::isHazard(float thresholdPpm) {
    float ppm = readPPM();
    bool digitalActive = isDigitalAlarmActive();
    return (ppm >= thresholdPpm) || digitalActive;
}

void SmokeSensor::setRo(float ro) {
    if (ro > 0.1f) _ro = ro;
}

float SmokeSensor::getRo() const {
    return _ro;
}
