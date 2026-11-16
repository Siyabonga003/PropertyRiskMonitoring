#ifndef MQTT_MANAGER_H
#define MQTT_MANAGER_H

#include <Arduino.h>
#include <WiFiClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "types.h"

// Callback type for dynamic config / command changes
typedef void (*IntervalChangeCallback)(uint32_t newIntervalMs);

/**
 * ============================================================================
 * MQTT Communication Manager
 * PubSubClient wrapper with automatic LWT, auto-reconnect, JSON telemetry,
 * hazard alert dispatching, and command subscription processing.
 * ============================================================================
 */
class MQTTManager {
public:
    MQTTManager();

    // Initialize with broker host, port, client credentials
    void begin(const char* host, uint16_t port, const char* user, const char* pass);

    // Non-blocking update called in loop
    void update();

    // Connection queries
    bool isConnected();

    // Publish periodic telemetry payload
    bool publishTelemetry(const SensorMetrics &metrics, const SystemDiagnostics &diag);

    // Publish urgent hazard alert payload (QoS 1)
    bool publishAlert(const AlertEvent &alert);

    // Register callback for interval updates
    void onIntervalChange(IntervalChangeCallback cb);

    // Incoming MQTT message handler (static for PubSubClient callback)
    static void handleIncomingMessage(char* topic, byte* payload, unsigned int length);

private:
    bool connectToBroker();
    void buildTopicNames();
    void processCommand(const char* jsonStr);
    void processConfig(const char* jsonStr);

    WiFiClient _wifiClient;
    PubSubClient _client;

    const char* _host;
    uint16_t    _port;
    const char* _user;
    const char* _pass;

    // Generated topic strings
    char _topicTelemetry[128];
    char _topicAlert[128];
    char _topicStatus[64];
    char _topicCommands[64];
    char _topicConfig[64];

    uint32_t _lastReconnectAttempt;
    IntervalChangeCallback _intervalCb;
};

extern MQTTManager mqttManager;

#endif // MQTT_MANAGER_H
