#ifndef HTTP_CLIENT_H
#define HTTP_CLIENT_H

#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "types.h"

/**
 * ============================================================================
 * HTTP Fallback Client
 * Provides REST fallback ingestion when MQTT broker is unavailable or disabled.
 * Endpoints:
 *   POST /api/telemetry/ingest
 *   POST /api/incidents/ingest
 * ============================================================================
 */
class FallbackHttpClient {
public:
    FallbackHttpClient();
    void begin(const char* baseUrl, const char* deviceToken);

    // POST telemetry metrics to backend
    bool postTelemetry(const SensorMetrics &metrics, const SystemDiagnostics &diag);

    // POST immediate hazard alert to backend
    bool postAlert(const AlertEvent &alert);

private:
    const char* _baseUrl;
    const char* _deviceToken;
    WiFiClient  _wifiClient;
    HTTPClient  _http;
};

extern FallbackHttpClient httpClient;

#endif // HTTP_CLIENT_H
