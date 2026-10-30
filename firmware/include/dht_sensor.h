#ifndef DHT_SENSOR_H
#define DHT_SENSOR_H

#include <Arduino.h>

/**
 * ============================================================================
 * DHT22 Temperature & Humidity Sensor Driver
 * Non-blocking polling with fallback caching and NaN error handling.
 * ============================================================================
 */
class DHTSensor {
public:
    DHTSensor();
    void begin();
    
    // Non-blocking read. Returns true if valid data available (new or cached).
    bool read(float &temperature, float &humidity);

    // Getters for latest cached readings
    float getTemperature() const;
    float getHumidity() const;
    bool isValid() const;

private:
    float _cachedTemp;
    float _cachedHumidity;
    bool _hasValidReading;
    unsigned long _lastReadTime;
    static constexpr unsigned long MIN_INTERVAL_MS = 2000; // DHT22 minimum sample interval
};

extern DHTSensor dhtSensor;

#endif // DHT_SENSOR_H
