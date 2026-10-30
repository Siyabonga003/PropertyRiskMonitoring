#include "status_led.h"
#include "pins.h"

StatusLED statusLed;

StatusLED::StatusLED()
    : _mode(LED_MODE_DISCONNECTED),
      _ledState(false),
      _lastToggleTime(0),
      _singlePulseUntil(0) {}

void StatusLED::begin() {
    pinMode(PIN_STATUS_LED, OUTPUT);
    writeHardware(false);
    Serial.printf("[Status LED] Initialized on GPIO %d\n", PIN_STATUS_LED);
}

void StatusLED::writeHardware(bool state) {
    _ledState = state;
    digitalWrite(PIN_STATUS_LED, state ? HIGH : LOW);
}

void StatusLED::setMode(LedMode mode) {
    if (_mode != mode) {
        _mode = mode;
        _lastToggleTime = millis();
        if (_mode == LED_MODE_OFF) {
            writeHardware(false);
        } else if (_mode == LED_MODE_CONNECTED) {
            writeHardware(true);
        }
    }
}

LedMode StatusLED::getMode() const {
    return _mode;
}

void StatusLED::flashOnce(uint16_t durationMs) {
    writeHardware(true);
    _singlePulseUntil = millis() + durationMs;
}

void StatusLED::update() {
    unsigned long now = millis();

    // Handle temporary single pulse flash
    if (_singlePulseUntil > 0) {
        if (now >= _singlePulseUntil) {
            _singlePulseUntil = 0;
            // Restore previous mode steady state
            if (_mode == LED_MODE_CONNECTED) {
                writeHardware(true);
            } else {
                writeHardware(false);
            }
        }
        return;
    }

    switch (_mode) {
        case LED_MODE_OFF:
            if (_ledState) writeHardware(false);
            break;

        case LED_MODE_DISCONNECTED:
            // Slow blink: 500ms ON, 500ms OFF
            if (now - _lastToggleTime >= 500) {
                _lastToggleTime = now;
                writeHardware(!_ledState);
            }
            break;

        case LED_MODE_CONNECTING:
            // Fast blink: 120ms ON, 120ms OFF
            if (now - _lastToggleTime >= 120) {
                _lastToggleTime = now;
                writeHardware(!_ledState);
            }
            break;

        case LED_MODE_CONNECTED:
            // Steady ON with short heartbeat tick every 3 seconds
            {
                uint32_t cycle = now % 3000;
                bool shouldBeOn = (cycle < 2900); // 100ms off tick at end of 3s
                if (_ledState != shouldBeOn) {
                    writeHardware(shouldBeOn);
                }
            }
            break;

        case LED_MODE_ALARM:
            // High-frequency emergency strobe: 45ms ON, 45ms OFF
            if (now - _lastToggleTime >= 45) {
                _lastToggleTime = now;
                writeHardware(!_ledState);
            }
            break;
    }
}
