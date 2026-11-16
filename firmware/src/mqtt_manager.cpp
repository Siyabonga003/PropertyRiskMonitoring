#include "mqtt_manager.h"
#include "config.h"
#include "wifi_manager.h"
#include "buzzer.h"
#include "status_led.h"

MQTTManager mqttManager;

MQTTManager::MQTTManager()
    : _client(_wifiClient),
      _host(nullptr),
      _port(1883),
      _user(nullptr),
      _pass(nullptr),
      _lastReconnectAttempt(0),
      _intervalCb(nullptr) {
    memset(_topicTelemetry, 0, sizeof(_topicTelemetry));
    memset(_topicAlert, 0, sizeof(_topicAlert));
    memset(_topicStatus, 0, sizeof(_topicStatus));
    memset(_topicCommands, 0, sizeof(_topicCommands));
    memset(_topicConfig, 0, sizeof(_topicConfig));
}

void MQTTManager::begin(const char* host, uint16_t port, const char* user, const char* pass) {
    _host = host;
    _port = port;
    _user = user;
    _pass = pass;

    buildTopicNames();

    _client.setServer(_host, _port);
    _client.setCallback(MQTTManager::handleIncomingMessage);
    _client.setBufferSize(1024); // Ensure large enough buffer for full JSON payloads
    _client.setKeepAlive(MQTT_KEEP_ALIVE_SEC);
    _client.setSocketTimeout(MQTT_SOCKET_TIMEOUT_SEC);

    Serial.printf("[MQTT] Initialized target %s:%u\n", _host, _port);
    Serial.printf("[MQTT] Telemetry Topic: %s\n", _topicTelemetry);
    Serial.printf("[MQTT] Alert Topic:     %s\n", _topicAlert);
}

void MQTTManager::buildTopicNames() {
    snprintf(_topicTelemetry, sizeof(_topicTelemetry),
             "properties/%s/zones/%s/devices/%s/telemetry",
             PROPERTY_ID, ZONE_ID, DEVICE_ID);

    snprintf(_topicAlert, sizeof(_topicAlert),
             "properties/%s/zones/%s/devices/%s/alert",
             PROPERTY_ID, ZONE_ID, DEVICE_ID);

    snprintf(_topicStatus, sizeof(_topicStatus),
             "devices/%s/status",
             DEVICE_ID);

    snprintf(_topicCommands, sizeof(_topicCommands),
             "devices/%s/commands",
             DEVICE_ID);

    snprintf(_topicConfig, sizeof(_topicConfig),
             "devices/%s/config",
             DEVICE_ID);
}

bool MQTTManager::connectToBroker() {
    if (!wifiManager.isConnected()) {
        return false;
    }

    Serial.printf("[MQTT] Attempting connection to %s:%u as %s...\n",
                  _host, _port, MQTT_CLIENT_ID);

    // Last Will & Testament (LWT) configuration:
    // When unexpected disconnect occurs, broker publishes "offline" with QoS 1, retained.
    const char* willTopic = _topicStatus;
    const uint8_t willQos = 1;
    const bool willRetain = true;
    const char* willMessage = "offline";

    bool success = false;
    if (_user && strlen(_user) > 0) {
        success = _client.connect(MQTT_CLIENT_ID, _user, _pass,
                                  willTopic, willQos, willRetain, willMessage);
    } else {
        success = _client.connect(MQTT_CLIENT_ID, willTopic, willQos, willRetain, willMessage);
    }

    if (success) {
        Serial.println("[MQTT] Connected successfully!");

        // Publish retained online status message
        _client.publish(_topicStatus, "online", true);

        // Subscribe to actuator commands and remote config
        _client.subscribe(_topicCommands, 1);
        _client.subscribe(_topicConfig, 1);

        Serial.printf("[MQTT] Subscribed to %s and %s\n", _topicCommands, _topicConfig);
        statusLed.flashOnce(200);
        return true;
    } else {
        Serial.printf("[MQTT] Connection failed, state code: %d. Will retry...\n", _client.state());
        return false;
    }
}

void MQTTManager::update() {
    if (!wifiManager.isConnected()) {
        return;
    }

    if (!_client.connected()) {
        unsigned long now = millis();
        if (now - _lastReconnectAttempt >= MQTT_RECONNECT_INTERVAL_MS || _lastReconnectAttempt == 0) {
            _lastReconnectAttempt = now;
            connectToBroker();
        }
    } else {
        _client.loop();
    }
}

bool MQTTManager::isConnected() {
    return _client.connected();
}

bool MQTTManager::publishTelemetry(const SensorMetrics &metrics, const SystemDiagnostics &diag) {
    if (!isConnected()) {
        return false;
    }

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["timestamp"] = wifiManager.getEpochTime();

    JsonObject metricsObj = doc["metrics"].to<JsonObject>();
    if (metrics.dht_valid) {
        metricsObj["temperature"] = serialized(String(metrics.temperature, 1));
        metricsObj["humidity"] = serialized(String(metrics.humidity, 1));
    } else {
        metricsObj["temperature"] = nullptr;
        metricsObj["humidity"] = nullptr;
    }
    metricsObj["smoke_ppm"] = serialized(String(metrics.smoke_ppm, 1));
    metricsObj["gas_ppm"] = serialized(String(metrics.gas_ppm, 1));
    metricsObj["flame_detected"] = metrics.flame_detected;
    metricsObj["water_detected"] = metrics.water_detected;
    metricsObj["motion_detected"] = metrics.motion_detected;

    JsonObject diagObj = doc["diagnostics"].to<JsonObject>();
    diagObj["wifi_rssi"] = diag.wifi_rssi;
    diagObj["uptime_seconds"] = diag.uptime_seconds;
    diagObj["free_heap"] = diag.free_heap;

    char buffer[512];
    size_t len = serializeJson(doc, buffer, sizeof(buffer));

    bool ok = _client.publish(_topicTelemetry, (const uint8_t*)buffer, len, false);
    if (ok) {
        Serial.printf("[MQTT] Telemetry published (%u bytes) to %s\n", (unsigned int)len, _topicTelemetry);
        statusLed.flashOnce(40);
    } else {
        Serial.println("[MQTT] Failed to publish telemetry!");
    }
    return ok;
}

bool MQTTManager::publishAlert(const AlertEvent &alert) {
    if (!isConnected()) {
        return false;
    }

    JsonDocument doc;
    doc["deviceId"] = DEVICE_ID;
    doc["timestamp"] = (alert.timestamp > 0) ? alert.timestamp : wifiManager.getEpochTime();
    doc["hazardType"] = hazardTypeToString(alert.hazard);
    doc["severity"] = severityToString(alert.severity);
    doc["value"] = alert.value;
    doc["unit"] = alert.unit;
    doc["message"] = alert.message;

    char buffer[512];
    size_t len = serializeJson(doc, buffer, sizeof(buffer));

    // High priority alert published with QoS 1
    bool ok = _client.publish(_topicAlert, (const uint8_t*)buffer, len, false);
    if (ok) {
        Serial.printf("[MQTT] HAZARD ALERT PUBLISHED: [%s] %s\n",
                      hazardTypeToString(alert.hazard), alert.message);
    } else {
        Serial.println("[MQTT] Failed to publish hazard alert!");
    }
    return ok;
}

void MQTTManager::onIntervalChange(IntervalChangeCallback cb) {
    _intervalCb = cb;
}

void MQTTManager::handleIncomingMessage(char* topic, byte* payload, unsigned int length) {
    char payloadStr[512];
    if (length >= sizeof(payloadStr)) {
        length = sizeof(payloadStr) - 1;
    }
    memcpy(payloadStr, payload, length);
    payloadStr[length] = '\0';

    Serial.printf("[MQTT] Incoming on topic '%s': %s\n", topic, payloadStr);

    if (strstr(topic, "/commands") != nullptr) {
        mqttManager.processCommand(payloadStr);
    } else if (strstr(topic, "/config") != nullptr) {
        mqttManager.processConfig(payloadStr);
    }
}

void MQTTManager::processCommand(const char* jsonStr) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, jsonStr);
    if (error) {
        Serial.printf("[MQTT] JSON parse error in command: %s\n", error.c_str());
        return;
    }

    const char* cmd = doc["command"];
    if (!cmd) return;

    Serial.printf("[MQTT] Executing command: %s\n", cmd);

    if (strcmp(cmd, "TRIGGER_BUZZER") == 0) {
        uint32_t durationMs = 30000;
        const char* patternStr = "PULSE";

        if (doc["parameters"].is<JsonObject>()) {
            JsonObject params = doc["parameters"];
            if (params["durationMs"].is<uint32_t>()) {
                durationMs = params["durationMs"].as<uint32_t>();
            }
            if (params["pattern"].is<const char*>()) {
                patternStr = params["pattern"].as<const char*>();
            }
        }

        if (strcmp(patternStr, "FLAME") == 0 || strcmp(patternStr, "FIRE") == 0) {
            buzzer.trigger(BUZZER_PATTERN_FLAME, durationMs);
        } else if (strcmp(patternStr, "GAS") == 0) {
            buzzer.trigger(BUZZER_PATTERN_GAS, durationMs);
        } else if (strcmp(patternStr, "SMOKE") == 0) {
            buzzer.trigger(BUZZER_PATTERN_SMOKE, durationMs);
        } else if (strcmp(patternStr, "WATER") == 0) {
            buzzer.trigger(BUZZER_PATTERN_WATER, durationMs);
        } else if (strcmp(patternStr, "MOTION") == 0) {
            buzzer.trigger(BUZZER_PATTERN_MOTION, durationMs);
        } else {
            buzzer.triggerCustom(200, 200, durationMs);
        }
    } else if (strcmp(cmd, "SILENCE_BUZZER") == 0) {
        buzzer.silence();
        Serial.println("[MQTT] Buzzer silenced via command.");
    } else if (strcmp(cmd, "SET_INTERVAL") == 0) {
        uint32_t newInterval = 0;
        if (doc["parameters"].is<JsonObject>()) {
            JsonObject params = doc["parameters"];
            if (params["intervalMs"].is<uint32_t>()) {
                newInterval = params["intervalMs"].as<uint32_t>();
            } else if (params["telemetryInterval"].is<uint32_t>()) {
                newInterval = params["telemetryInterval"].as<uint32_t>();
            }
        }
        if (newInterval >= 1000 && _intervalCb != nullptr) {
            Serial.printf("[MQTT] Setting telemetry interval to %u ms\n", newInterval);
            _intervalCb(newInterval);
        }
    }
}

void MQTTManager::processConfig(const char* jsonStr) {
    JsonDocument doc;
    DeserializationError error = deserializeJson(doc, jsonStr);
    if (error) {
        Serial.printf("[MQTT] JSON parse error in config: %s\n", error.c_str());
        return;
    }

    if (doc["telemetryIntervalMs"].is<uint32_t>() && _intervalCb != nullptr) {
        uint32_t interval = doc["telemetryIntervalMs"].as<uint32_t>();
        if (interval >= 1000) {
            Serial.printf("[MQTT] Config updated telemetry interval to %u ms\n", interval);
            _intervalCb(interval);
        }
    }
}
