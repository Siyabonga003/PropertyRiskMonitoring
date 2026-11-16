#include "flame_sensor.h"
#include "pins.h"

FlameSensor flameSensor;

FlameSensor::FlameSensor()
    : _cachedRaw(4095),
      _cachedIntensity(0.0f),
      _cachedDigital(false),
      _lastSampleTime(0) {}

void FlameSensor::begin() {
    // Configure digital pin as INPUT_PULLUP
    pinMode(PIN_FLAME_DIGITAL, INPUT_PULLUP);

    // Configure analog pin on ADC1 (safe with Wi-Fi)
    analogReadResolution(12);       // 12-bit (0 - 4095)
    analogSetAttenuation(ADC_11db); // Full 0 - 3.3V range

    Serial.printf("[FlameSensor] Initialized on Analog GPIO %d, Digital GPIO %d\n",
                  PIN_FLAME_ANALOG, PIN_FLAME_DIGITAL);
}

int FlameSensor::readRawADC(uint8_t samples) {
    if (samples == 0) samples = 1;
    uint32_t sum = 0;
    for (uint8_t i = 0; i < samples; ++i) {
        sum += analogRead(PIN_FLAME_ANALOG);
        delayMicroseconds(100);
    }
    _cachedRaw = sum / samples;
    return _cachedRaw;
}

float FlameSensor::readIntensityPct() {
    int raw = readRawADC(8);

    // Standard flame sensor breakout boards:
    // Dark / Ambient: ADC is near maximum (3800 - 4095)
    // Flame / Strong IR: ADC drops toward 0
    // We invert so that 0% = dark/normal, 100% = max flame radiation
    float normalized = 1.0f - ((float)raw / 4095.0f);
    if (normalized < 0.0f) normalized = 0.0f;
    if (normalized > 1.0f) normalized = 1.0f;

    _cachedIntensity = normalized * 100.0f;
    _lastSampleTime = millis();
    return _cachedIntensity;
}

bool FlameSensor::isDigitalActive() {
    // Breakout LM393 comparator outputs LOW when flame threshold is breached
    _cachedDigital = (digitalRead(PIN_FLAME_DIGITAL) == LOW);
    return _cachedDigital;
}

bool FlameSensor::isFlameDetected(float thresholdIntensityPct) {
    bool digitalActive = isDigitalActive();
    float intensity = readIntensityPct();
    return digitalActive || (intensity >= thresholdIntensityPct);
}

int FlameSensor::getCachedRaw() const {
    return _cachedRaw;
}

float FlameSensor::getCachedIntensity() const {
    return _cachedIntensity;
}

bool FlameSensor::getCachedDigital() const {
    return _cachedDigital;
}
