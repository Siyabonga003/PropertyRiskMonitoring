#ifndef MOTION_SENSOR_H
#define MOTION_SENSOR_H

#include <Arduino.h>

/**
 * ============================================================================
 * PIR Motion Sensor Driver
 * Interrupt-driven detection with software debouncing and hold-time management.
 * ============================================================================
 */
class MotionSensor {
public:
    MotionSensor();
    void begin();

    // Check if motion is currently active (with debounce filter)
    bool isMotionDetected();

    // Called from ISR or event loop to update state
    void onMotionInterrupt();

    // Reset latch after event has been dispatched
    void clearMotionFlag();

    // Check raw GPIO state
    bool readRawPin();

    int getPin() const;

private:
    volatile bool _motionFlag;
    volatile unsigned long _lastTriggerTime;
    unsigned long _debounceMs;
};

extern MotionSensor motionSensor;

#endif // MOTION_SENSOR_H
