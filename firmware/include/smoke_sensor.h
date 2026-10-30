#ifndef SMOKE_SENSOR_H
#define SMOKE_SENSOR_H

#include <Arduino.h>

/**
 * ============================================================================
 * MQ-2 Smoke & Flammable Gas Sensor Driver
 * ADC sampling with multi-sample filtering, baseline Ro calibration,
 * and dual analog curve estimation + digital comparator checking.
 * ============================================================================
 */
class SmokeSensor {
public:
    SmokeSensor();
    void begin();

    // Multi-sample raw ADC reading (0 - 4095)
    int readRawADC(uint8_t samples = 10);

    // Calculate sensor resistance Rs in kOhms
    float readRs(int rawAdc = -1);

    // Approximate smoke concentration in Parts Per Million (PPM)
    float readPPM();

    // Check onboard LM393 digital comparator output pin
    bool isDigitalAlarmActive();

    // Check if current reading exceeds threshold (analog or digital)
    bool isHazard(float thresholdPpm = 300.0f);

    // Calibration helper: compute baseline Ro in clean air
    void calibrateRo(uint8_t sampleCount = 20);

    // Setters / Getters for calibration
    void setRo(float ro);
    float getRo() const;

private:
    float _ro;               // Baseline resistance in clean air (kOhms)
    float _rl;               // Load resistance on breakout board (typically 5kOhms)
    float _cachedPpm;
    int   _cachedRaw;
    bool  _cachedDigital;
    unsigned long _lastSampleTime;
};

extern SmokeSensor smokeSensor;

#endif // SMOKE_SENSOR_H
