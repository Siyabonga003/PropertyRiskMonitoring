#ifndef BUZZER_H
#define BUZZER_H

#include <Arduino.h>
#include "types.h"

/**
 * ============================================================================
 * Active Buzzer Driver
 * Non-blocking state machine generating distinct audible cadences for smoke,
 * water leaks, motion intrusion, and test beeps with auto-timeout.
 * ============================================================================
 */
class Buzzer {
public:
    Buzzer();
    void begin();

    // Set buzzer to a predefined cadence pattern with an optional max duration
    void trigger(BuzzerPattern pattern, uint32_t durationMs = 30000);

    // Trigger custom pulse pattern
    void triggerCustom(uint32_t onTimeMs, uint32_t offTimeMs, uint32_t totalDurationMs);

    // Play a single short confirmation chirp
    void beep(uint16_t durationMs = 150);

    // Immediate non-blocking silence
    void silence();

    // State machine update called inside main loop / FreeRTOS task
    void update();

    // State queries
    bool isSounding() const;
    BuzzerPattern getCurrentPattern() const;

private:
    void setHardware(bool high);

    BuzzerPattern _pattern;
    bool     _currentState;
    uint32_t _onTimeMs;
    uint32_t _offTimeMs;
    uint32_t _stepStartTime;
    uint32_t _patternStartTime;
    uint32_t _totalDurationMs;
    uint8_t  _motionStep;
};

extern Buzzer buzzer;

#endif // BUZZER_H
