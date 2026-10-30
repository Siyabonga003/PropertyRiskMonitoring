#include "dht_sensor.h"
#include "pins.h"
#include <DHT.h>

static DHT dhtHardware(PIN_DHT_DATA, DHT22);
DHTSensor dhtSensor;

DHTSensor::DHTSensor()
    : _cachedTemp(0.0f),
      _cachedHumidity(0.0f),
      _hasValidReading(false),
      _lastReadTime(0) {}

void DHTSensor::begin() {
    dhtHardware.begin();
    Serial.printf("[DHT22] Initialized on GPIO %d\n", PIN_DHT_DATA);
}

bool DHTSensor::read(float &temperature, float &humidity) {
    unsigned long now = millis();

    // Enforce 2-second sampling interval required by DHT22 capacitive element
    if (now - _lastReadTime >= MIN_INTERVAL_MS || _lastReadTime == 0) {
        float rawHumidity = dhtHardware.readHumidity();
        float rawTemp = dhtHardware.readTemperature(); // Celsius

        if (!isnan(rawHumidity) && !isnan(rawTemp)) {
            // Valid reading obtained
            _cachedTemp = rawTemp;
            _cachedHumidity = rawHumidity;
            _hasValidReading = true;
            _lastReadTime = now;
        } else {
            Serial.println("[DHT22] Warning: Checksum/NaN read error from sensor!");
            // Keep previous valid reading if available, update timer to prevent thrashing
            _lastReadTime = now;
        }
    }

    temperature = _cachedTemp;
    humidity = _cachedHumidity;
    return _hasValidReading;
}

float DHTSensor::getTemperature() const {
    return _cachedTemp;
}

float DHTSensor::getHumidity() const {
    return _cachedHumidity;
}

bool DHTSensor::isValid() const {
    return _hasValidReading;
}
