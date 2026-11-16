#ifndef SMOKE_SENSOR_H
#define SMOKE_SENSOR_H

#include <Arduino.h>

/**
 * ============================================================================
 * MQ-2 Multi-Gas & Smoke Dual Sensor Driver
 * ADC sampling with multi-sample filtering, baseline Ro clean-air calibration,
 * and dual analog log curves for:
 * 1) Smoke / Fire aerosol (PPM)
 * 2) Combustible Gas / LPG / Propane / Methane (PPM)
 * Includes LM393 digital comparator threshold detection.
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
    float readSmokePPM();

    // Approximate combustible gas / LPG concentration in Parts Per Million (PPM)
    float readGasPPM();

    // Legacy alias for readSmokePPM
    float readPPM();

    // Check onboard LM393 digital comparator output pin
    bool isDigitalAlarmActive();

    // Check if smoke reading exceeds threshold
    bool isSmokeHazard(float thresholdPpm = 300.0f);

    // Check if combustible gas reading exceeds threshold
    bool isGasHazard(float thresholdPpm = 200.0f);

    // General hazard check (smoke or gas or digital alarm)
    bool isHazard(float thresholdPpm = 300.0f);

    // Calibration helper: compute baseline Ro in clean air
    void calibrateRo(uint8_t sampleCount = 20);

    // Setters / Getters for calibration & cached readings
    void setRo(float ro);
    float getRo() const;
    float getCachedSmokePpm() const;
    float getCachedGasPpm() const;

private:
    float _ro;               // Baseline resistance in clean air (kOhms)
    float _rl;               // Load resistance on breakout board (typically 5kOhms)
    float _cachedSmokePpm;
    float _cachedGasPpm;
    int   _cachedRaw;
    bool  _cachedDigital;
    unsigned long _lastSampleTime;
};

extern SmokeSensor smokeSensor;

#endif // SMOKE_SENSOR_H
