#ifndef PINS_H
#define PINS_H

#include <Arduino.h>

/**
 * ============================================================================
 * Hardware Pin Mapping - ESP32 DevKit V1
 * ============================================================================
 * 
 * SENSOR / ACTUATOR PIN ASSIGNMENTS:
 * 
 * 1. DHT22 (AM2302) Temperature & Humidity Sensor:
 *    - Data Pin: GPIO 4 (Digital In/Out, with 4.7k-10k pullup resistor recommended)
 * 
 * 2. MQ-2 Flammable Gas & Smoke Sensor:
 *    - Analog Pin (A0): GPIO 34 (ADC1_CHANNEL_6, Input-only, safe with Wi-Fi)
 *    - Digital Pin (D0): GPIO 25 (Digital In with comparator threshold, Active LOW/HIGH)
 * 
 * 3. Water Leak / Rain Sensor:
 *    - Analog Pin (A0): GPIO 35 (ADC1_CHANNEL_7, Input-only, safe with Wi-Fi)
 *    - Digital Pin (D0): GPIO 26 (Digital In, Active LOW when water bridges probe)
 * 
 * 4. PIR Motion Sensor (HC-SR501 / AM312):
 *    - Digital Out: GPIO 27 (Digital In, Active HIGH on movement detected)
 * 
 * 5. Active Piezo Buzzer:
 *    - Control Pin: GPIO 19 (Digital Out, HIGH = Beep, LOW = Silent)
 * 
 * 6. Status LED:
 *    - Control Pin: GPIO 2 (Onboard Blue LED on ESP32 DevKit V1, Active HIGH)
 * ============================================================================
 */

// DHT22 Pin
#define PIN_DHT_DATA           4

// MQ-2 Smoke & Gas Sensor Pins
#define PIN_SMOKE_ANALOG       34
#define PIN_SMOKE_DIGITAL      25

// Water Leak Detector Pins
#define PIN_WATER_ANALOG       35
#define PIN_WATER_DIGITAL      26

// PIR Motion Detector Pin
#define PIN_PIR_MOTION         27

// Actuators
#define PIN_BUZZER             19
#define PIN_STATUS_LED         2

#endif // PINS_H
