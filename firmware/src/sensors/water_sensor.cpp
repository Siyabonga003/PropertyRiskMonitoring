#include "water_sensor.h"
#include "pins.h"

WaterSensor waterSensor;

WaterSensor::WaterSensor()
    : _cachedRaw(4095),
      _cachedPct(0.0f),
      _cachedDetected(false) {}

void WaterSensor::begin() {
    // GPIO 26 has internal pull-up capability
    pinMode(PIN_WATER_DIGITAL, INPUT_PULLUP);

    // GPIO 35 is input-only ADC1 channel
    analogReadResolution(12);
    analogSetAttenuation(ADC_11db);

    Serial.printf("[Water Sensor] Initialized on Analog GPIO %d, Digital GPIO %d\n",
                  PIN_WATER_ANALOG, PIN_WATER_DIGITAL);
}

int WaterSensor::readRawADC(uint8_t samples) {
    uint32_t sum = 0;
    for (uint8_t i = 0; i < samples; ++i) {
        sum += analogRead(PIN_WATER_ANALOG);
        delayMicroseconds(200);
    }
    _cachedRaw = sum / samples;
    return _cachedRaw;
}

float WaterSensor::readWetnessPct() {
    int raw = readRawADC(8);

    // Standard LM393 probe board: 
    // Dry state: Voltage ~ 3.3V (ADC ~ 4095)
    // Fully wet: Voltage drops towards 0V (ADC < 1000)
    // Convert to 0 - 100% wetness scale
    float pct = 0.0f;
    if (raw < 4000) {
        pct = ((4000.0f - (float)raw) / 4000.0f) * 100.0f;
    }
    
    if (pct < 0.0f) pct = 0.0f;
    if (pct > 100.0f) pct = 100.0f;

    _cachedPct = pct;
    return _cachedPct;
}

bool WaterSensor::isDigitalActive() {
    // LM393 comparator pulls D0 LOW when conductivity threshold is tripped
    return (digitalRead(PIN_WATER_DIGITAL) == LOW);
}

bool WaterSensor::isWaterDetected(float analogThresholdPct) {
    bool digitalTriggered = isDigitalActive();
    float pct = readWetnessPct();

    // Triggered if digital comparator tripped OR wetness percentage exceeds safety limit
    _cachedDetected = digitalTriggered || (pct >= analogThresholdPct);
    return _cachedDetected;
}

int WaterSensor::getDigitalPin() const {
    return PIN_WATER_DIGITAL;
}
