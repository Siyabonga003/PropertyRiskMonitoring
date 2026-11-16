#include "motion_sensor.h"
#include "pins.h"

MotionSensor motionSensor;

MotionSensor::MotionSensor()
    : _motionFlag(false),
      _lastTriggerTime(0),
      _debounceMs(2000) {}

void MotionSensor::begin() {
    pinMode(PIN_PIR_MOTION, INPUT_PULLDOWN);
    Serial.printf("[PIR Motion] Initialized on GPIO %d (Active HIGH)\n", PIN_PIR_MOTION);
}

void MotionSensor::onMotionInterrupt() {
    unsigned long now = millis();
    if (now - _lastTriggerTime >= _debounceMs || _lastTriggerTime == 0) {
        _motionFlag = true;
        _lastTriggerTime = now;
    }
}

bool MotionSensor::isMotionDetected() {
    // If raw pin is HIGH or interrupt flag was set
    bool rawHigh = (digitalRead(PIN_PIR_MOTION) == HIGH);
    if (rawHigh) {
        _motionFlag = true;
        _lastTriggerTime = millis();
    }
    return _motionFlag || rawHigh;
}

void MotionSensor::clearMotionFlag() {
    // Only clear if hardware pin returned to LOW
    if (digitalRead(PIN_PIR_MOTION) == LOW) {
        _motionFlag = false;
    }
}

bool MotionSensor::readRawPin() {
    return (digitalRead(PIN_PIR_MOTION) == HIGH);
}

int MotionSensor::getPin() const {
    return PIN_PIR_MOTION;
}
