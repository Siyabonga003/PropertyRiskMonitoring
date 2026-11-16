#include "buzzer.h"
#include "pins.h"

Buzzer buzzer;

Buzzer::Buzzer()
    : _pattern(BUZZER_IDLE),
      _currentState(false),
      _onTimeMs(0),
      _offTimeMs(0),
      _stepStartTime(0),
      _patternStartTime(0),
      _totalDurationMs(0),
      _motionStep(0) {}

void Buzzer::begin() {
    pinMode(PIN_BUZZER, OUTPUT);
    digitalWrite(PIN_BUZZER, LOW);
    Serial.printf("[Buzzer] Initialized on GPIO %d\n", PIN_BUZZER);
}

void Buzzer::setHardware(bool high) {
    _currentState = high;
    digitalWrite(PIN_BUZZER, high ? HIGH : LOW);
}

void Buzzer::trigger(BuzzerPattern pattern, uint32_t durationMs) {
    if (pattern == BUZZER_IDLE) {
        silence();
        return;
    }

    _pattern = pattern;
    _totalDurationMs = durationMs;
    _patternStartTime = millis();
    _stepStartTime = millis();
    _motionStep = 0;

    switch (pattern) {
        case BUZZER_PATTERN_FLAME:
            // Highest urgency fire siren: 60ms ON, 60ms OFF ultra-fast strobe
            _onTimeMs = 60;
            _offTimeMs = 60;
            setHardware(true);
            break;

        case BUZZER_PATTERN_GAS:
            // Heavy syncopated warning: 200ms ON, 100ms OFF
            _onTimeMs = 200;
            _offTimeMs = 100;
            setHardware(true);
            break;

        case BUZZER_PATTERN_SMOKE:
            // Fast, aggressive urgency: 100ms ON, 100ms OFF
            _onTimeMs = 100;
            _offTimeMs = 100;
            setHardware(true);
            break;

        case BUZZER_PATTERN_WATER:
            // Heavy alarm: 500ms ON, 200ms OFF
            _onTimeMs = 500;
            _offTimeMs = 200;
            setHardware(true);
            break;

        case BUZZER_PATTERN_MOTION:
            // Dual warning chirp: 100ms ON, 80ms OFF, 100ms ON, 1200ms pause
            _motionStep = 0;
            setHardware(true);
            break;

        case BUZZER_PATTERN_TEST:
            // Single short beep
            _onTimeMs = 250;
            _offTimeMs = 0;
            _totalDurationMs = 250;
            setHardware(true);
            break;

        default:
            _onTimeMs = 200;
            _offTimeMs = 200;
            setHardware(true);
            break;
    }
}

void Buzzer::triggerCustom(uint32_t onTimeMs, uint32_t offTimeMs, uint32_t totalDurationMs) {
    _pattern = BUZZER_PATTERN_CUSTOM;
    _onTimeMs = onTimeMs;
    _offTimeMs = offTimeMs;
    _totalDurationMs = totalDurationMs;
    _patternStartTime = millis();
    _stepStartTime = millis();
    setHardware(true);
}

void Buzzer::beep(uint16_t durationMs) {
    trigger(BUZZER_PATTERN_TEST, durationMs);
}

void Buzzer::silence() {
    _pattern = BUZZER_IDLE;
    _currentState = false;
    _totalDurationMs = 0;
    _onTimeMs = 0;
    _offTimeMs = 0;
    setHardware(false);
}

void Buzzer::update() {
    if (_pattern == BUZZER_IDLE) {
        if (_currentState) {
            setHardware(false);
        }
        return;
    }

    unsigned long now = millis();

    // Check overall pattern timeout
    if (_totalDurationMs > 0 && (now - _patternStartTime >= _totalDurationMs)) {
        silence();
        return;
    }

    // Motion cadence: multi-step state machine
    if (_pattern == BUZZER_PATTERN_MOTION) {
        switch (_motionStep) {
            case 0: // First beep (100ms)
                if (now - _stepStartTime >= 100) {
                    setHardware(false);
                    _stepStartTime = now;
                    _motionStep = 1;
                }
                break;
            case 1: // Short pause (80ms)
                if (now - _stepStartTime >= 80) {
                    setHardware(true);
                    _stepStartTime = now;
                    _motionStep = 2;
                }
                break;
            case 2: // Second beep (100ms)
                if (now - _stepStartTime >= 100) {
                    setHardware(false);
                    _stepStartTime = now;
                    _motionStep = 3;
                }
                break;
            case 3: // Long interval pause (1200ms)
                if (now - _stepStartTime >= 1200) {
                    setHardware(true);
                    _stepStartTime = now;
                    _motionStep = 0;
                }
                break;
        }
        return;
    }

    // Standard dual-phase cadence (Smoke, Water, Custom)
    if (_currentState) {
        // Currently sounding (ON phase)
        if (now - _stepStartTime >= _onTimeMs) {
            if (_offTimeMs > 0) {
                setHardware(false);
                _stepStartTime = now;
            } else {
                // Single-shot beep completed
                silence();
            }
        }
    } else {
        // Currently silent (OFF phase)
        if (now - _stepStartTime >= _offTimeMs) {
            setHardware(true);
            _stepStartTime = now;
        }
    }
}

bool Buzzer::isSounding() const {
    return _currentState;
}

BuzzerPattern Buzzer::getCurrentPattern() const {
    return _pattern;
}
