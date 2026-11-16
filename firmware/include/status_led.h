#ifndef STATUS_LED_H
#define STATUS_LED_H

#include <Arduino.h>
#include "types.h"

/**
 * ============================================================================
 * Status LED Driver
 * Visual state indicator using onboard or external LED on GPIO 2.
 * Modes: Disconnected, Connecting, Normal Connected, and Alarm Strobe.
 * ============================================================================
 */
class StatusLED {
public:
    StatusLED();
    void begin();

    // Set LED operational mode
    void setMode(LedMode mode);

    // Get current mode
    LedMode getMode() const;

    // Single pulse for event confirmation
    void flashOnce(uint16_t durationMs = 80);

    // Non-blocking state update
    void update();

private:
    void writeHardware(bool state);

    LedMode  _mode;
    bool     _ledState;
    uint32_t _lastToggleTime;
    uint32_t _singlePulseUntil;
};

extern StatusLED statusLed;

#endif // STATUS_LED_H
