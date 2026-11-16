#include "http_client.h"
#include "config.h"
#include "wifi_manager.h"

FallbackHttpClient httpClient;

FallbackHttpClient::FallbackHttpClient()
    : _baseUrl(nullptr),
      _deviceToken(nullptr) {}

void FallbackHttpClient::begin(const char* baseUrl, const char* deviceToken) {
    _baseUrl = baseUrl;
    _deviceToken = deviceToken;
    Serial.printf("[HTTP Fallback] Initialized target: %s\n", _baseUrl);
}

bool FallbackHttpClient::postTelemetry(const SensorMetrics &metrics, const SystemDiagnostics &diag) {
    if (!wifiManager.isConnected() || !_baseUrl) {
        return false;
    }

    String url = String(_baseUrl) + HTTP_TELEMETRY_ENDPOINT;
    
    _http.begin(_wifiClient, url);
    _http.setTimeout(HTTP_REQUEST_TIMEOUT_MS);
    _http.addHeader("Content-Type", "application/json");
    if (_deviceToken && strlen(_deviceToken) > 0) {
        _http.addHeader("X-Device-Token", _deviceToken);
    }

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["propertyId"] = PROPERTY_ID;
    doc["zoneId"] = ZONE_ID;
    doc["timestamp"] = wifiManager.getEpochTime();

    JsonObject metricsObj = doc["metrics"].to<JsonObject>();
    if (metrics.dht_valid) {
        metricsObj["temperature"] = metrics.temperature;
        metricsObj["humidity"] = metrics.humidity;
    } else {
        metricsObj["temperature"] = nullptr;
        metricsObj["humidity"] = nullptr;
    }
    metricsObj["smoke_ppm"] = metrics.smoke_ppm;
    metricsObj["gas_ppm"] = metrics.gas_ppm;
    metricsObj["flame_detected"] = metrics.flame_detected;
    metricsObj["water_detected"] = metrics.water_detected;
    metricsObj["motion_detected"] = metrics.motion_detected;

    JsonObject diagObj = doc["diagnostics"].to<JsonObject>();
    diagObj["wifi_rssi"] = diag.wifi_rssi;
    diagObj["uptime_seconds"] = diag.uptime_seconds;
    diagObj["free_heap"] = diag.free_heap;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = _http.POST(jsonPayload);
    bool success = (httpCode >= 200 && httpCode < 300);

    if (success) {
        Serial.printf("[HTTP Fallback] Telemetry POST OK (%d) to %s\n", httpCode, url.c_str());
    } else {
        Serial.printf("[HTTP Fallback] Telemetry POST failed (%d): %s\n",
                      httpCode, _http.errorToString(httpCode).c_str());
    }

    _http.end();
    return success;
}

bool FallbackHttpClient::postAlert(const AlertEvent &alert) {
    if (!wifiManager.isConnected() || !_baseUrl) {
        return false;
    }

    String url = String(_baseUrl) + HTTP_ALERT_ENDPOINT;

    _http.begin(_wifiClient, url);
    _http.setTimeout(HTTP_REQUEST_TIMEOUT_MS);
    _http.addHeader("Content-Type", "application/json");
    if (_deviceToken && strlen(_deviceToken) > 0) {
        _http.addHeader("X-Device-Token", _deviceToken);
    }

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["propertyId"] = PROPERTY_ID;
    doc["zoneId"] = ZONE_ID;
    doc["timestamp"] = (alert.timestamp > 0) ? alert.timestamp : wifiManager.getEpochTime();
    doc["hazardType"] = hazardTypeToString(alert.hazard);
    doc["severity"] = severityToString(alert.severity);
    doc["value"] = alert.value;
    doc["unit"] = alert.unit;
    doc["message"] = alert.message;

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    int httpCode = _http.POST(jsonPayload);
    bool success = (httpCode >= 200 && httpCode < 300);

    if (success) {
        Serial.printf("[HTTP Fallback] Hazard Alert POST OK (%d)\n", httpCode);
    } else {
        Serial.printf("[HTTP Fallback] Hazard Alert POST failed (%d): %s\n",
                      httpCode, _http.errorToString(httpCode).c_str());
    }

    _http.end();
    return success;
}
