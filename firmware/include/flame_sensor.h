#ifndef FLAME_SENSOR_H
#define FLAME_SENSOR_H

#include <Arduino.h>

/**
 * ============================================================================
 * Optical IR Flame Detection Sensor Driver (KY-026 / 760nm - 1100nm)
 * Supports dual-mode sampling:
 * - Digital comparator pin D0 for sub-millisecond hardware interrupt detection
 * - Analog ADC pin A0 (ADC1 GPIO 32) for proximity and intensity calculation (0-100%)
 * ============================================================================
 */
class FlameSensor {
public:
    FlameSensor();
    void begin();

    // Multi-sample raw ADC reading (0 - 4095)
    // Note: Flame sensors typically pull towards 0V when intense IR radiation is detected
    int readRawADC(uint8_t samples = 8);

    // Approximate flame intensity percentage (0.0% = dark/nominal, 100.0% = direct close flame)
    float readIntensityPct();

    // Check onboard LM393 digital comparator output pin (Active LOW on fire)
    bool isDigitalActive();

    // Comprehensive hazard check combining digital trigger and analog percentage threshold
    bool isFlameDetected(float thresholdIntensityPct = 35.0f);

    // Getters for cached values
    int getCachedRaw() const;
    float getCachedIntensity() const;
    bool getCachedDigital() const;

private:
    int   _cachedRaw;
    float _cachedIntensity;
    bool  _cachedDigital;
    unsigned long _lastSampleTime;
};

extern FlameSensor flameSensor;

#endif // FLAME_SENSOR_H
