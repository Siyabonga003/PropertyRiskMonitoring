#ifndef WATER_SENSOR_H
#define WATER_SENSOR_H

#include <Arduino.h>

/**
 * ============================================================================
 * Water Leak Probe Driver
 * Analog wetness level percentage calculation and digital interrupt-ready detection.
 * ============================================================================
 */
class WaterSensor {
public:
    WaterSensor();
    void begin();

    // Multi-sample raw ADC reading (0 - 4095)
    int readRawADC(uint8_t samples = 10);

    // Compute estimated wetness percentage (0.0% to 100.0%)
    float readWetnessPct();

    // Check if water leak is detected (evaluates both digital and analog criteria)
    bool isWaterDetected(float analogThresholdPct = 20.0f);

    // Direct digital pin state check (Active LOW on LM393 probe module)
    bool isDigitalActive();

    // Raw digital pin read
    int getDigitalPin() const;

private:
    int   _cachedRaw;
    float _cachedPct;
    bool  _cachedDetected;
};

extern WaterSensor waterSensor;

#endif // WATER_SENSOR_H
