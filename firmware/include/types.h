#ifndef TYPES_H
#define TYPES_H

#include <Arduino.h>

/**
 * ============================================================================
 * Shared Data Types and Enumerations
 * ============================================================================
 */

// Hazard Alert Severities
enum IncidentSeverity {
    SEV_INFO,
    SEV_WARNING,
    SEV_CRITICAL
};

inline const char* severityToString(IncidentSeverity sev) {
    switch (sev) {
        case SEV_INFO:     return "INFO";
        case SEV_WARNING:  return "WARNING";
        case SEV_CRITICAL: return "CRITICAL";
        default:           return "WARNING";
    }
}

// Hazard Alert Types
enum HazardType {
    HAZARD_NONE,
    HAZARD_SMOKE,
    HAZARD_WATER_LEAK,
    HAZARD_MOTION,
    HAZARD_HIGH_TEMP,
    HAZARD_LOW_TEMP
};

inline const char* hazardTypeToString(HazardType type) {
    switch (type) {
        case HAZARD_SMOKE:      return "SMOKE_DETECTED";
        case HAZARD_WATER_LEAK: return "WATER_LEAK";
        case HAZARD_MOTION:     return "MOTION_DETECTED";
        case HAZARD_HIGH_TEMP:  return "HIGH_TEMP";
        case HAZARD_LOW_TEMP:   return "LOW_TEMP";
        default:                return "UNKNOWN";
    }
}

// Telemetry Metrics Data Container
struct SensorMetrics {
    float temperature;       // In Celsius
    float humidity;          // In Percentage (0-100)
    float smoke_ppm;         // Estimated smoke concentration in PPM
    int   smoke_raw_adc;     // Raw ADC value (0-4095)
    bool  smoke_digital_alarm; // Digital pin D0 threshold triggered
    bool  water_detected;    // Digital active-low indicator or analog threshold
    float water_level_pct;   // Water sensor wetness percentage (0-100)
    int   water_raw_adc;     // Raw ADC value (0-4095)
    bool  motion_detected;   // PIR digital state
    bool  dht_valid;         // Whether DHT sensor reading is valid
};

// System Health and Diagnostics
struct SystemDiagnostics {
    int32_t  wifi_rssi;
    uint32_t uptime_seconds;
    uint32_t free_heap;
    uint32_t min_free_heap;
    bool     wifi_connected;
    bool     mqtt_connected;
};

// Hazard Alert Message
struct AlertEvent {
    HazardType       hazard;
    IncidentSeverity severity;
    float            value;
    const char*      unit;
    const char*      message;
    uint32_t         timestamp;
};

// Buzzer Cadence Patterns
enum BuzzerPattern {
    BUZZER_IDLE,          // Silence
    BUZZER_PATTERN_SMOKE, // Rapid urgent pulsing (100ms ON / 100ms OFF)
    BUZZER_PATTERN_WATER, // Heavy alert tone (500ms ON / 200ms OFF)
    BUZZER_PATTERN_MOTION,// Quick alert double-chirp
    BUZZER_PATTERN_TEST,  // Short confirmation beep (250ms)
    BUZZER_PATTERN_CUSTOM // User custom pulsed duration
};

// LED Indicator Modes
enum LedMode {
    LED_MODE_OFF,
    LED_MODE_DISCONNECTED, // Slow pulse (1s period)
    LED_MODE_CONNECTING,   // Fast blink (200ms period)
    LED_MODE_CONNECTED,    // Solid ON with occasional heartbeat blink
    LED_MODE_ALARM         // High-frequency strobe (50ms period)
};

#endif // TYPES_H
