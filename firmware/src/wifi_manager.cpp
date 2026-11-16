#include "wifi_manager.h"
#include "config.h"
#include "status_led.h"
#include <time.h>

WiFiManager wifiManager;

WiFiManager::WiFiManager()
    : _ssid(nullptr),
      _password(nullptr),
      _state(WIFI_MGR_DISCONNECTED),
      _lastAttemptTime(0),
      _connectStartTime(0),
      _ntpSynced(false) {}

void WiFiManager::begin(const char* ssid, const char* password) {
    _ssid = ssid;
    _password = password;
    _state = WIFI_MGR_DISCONNECTED;
    _lastAttemptTime = 0;
    _ntpSynced = false;

    WiFi.persistent(false);
    WiFi.mode(WIFI_STA);
    WiFi.disconnect(true);
    delay(100);

    Serial.printf("[WiFi] Initializing station for SSID: %s\n", _ssid);
    initiateConnection();
}

void WiFiManager::initiateConnection() {
    if (!_ssid || strlen(_ssid) == 0) {
        Serial.println("[WiFi] Error: No SSID provided!");
        return;
    }

    Serial.printf("[WiFi] Connecting to '%s'...\n", _ssid);
    statusLed.setMode(LED_MODE_CONNECTING);

    WiFi.begin(_ssid, _password);
    _state = WIFI_MGR_CONNECTING;
    _connectStartTime = millis();
    _lastAttemptTime = millis();
}

void WiFiManager::syncNTP() {
    Serial.printf("[NTP] Synchronizing system time with %s...\n", NTP_SERVER);
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    
    // Check if time is already available
    time_t now = time(nullptr);
    if (now > 1600000000) {
        _ntpSynced = true;
        struct tm timeinfo;
        gmtime_r(&now, &timeinfo);
        Serial.printf("[NTP] UTC Time synchronized: %04d-%02d-%02d %02d:%02d:%02d\n",
                      timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
                      timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    }
}

void WiFiManager::update() {
    unsigned long now = millis();

    switch (_state) {
        case WIFI_MGR_DISCONNECTED:
            statusLed.setMode(LED_MODE_DISCONNECTED);
            if (now - _lastAttemptTime >= WIFI_RECONNECT_INTERVAL_MS) {
                initiateConnection();
            }
            break;

        case WIFI_MGR_CONNECTING:
            if (WiFi.status() == WL_CONNECTED) {
                _state = WIFI_MGR_CONNECTED;
                Serial.println("[WiFi] Connected successfully!");
                Serial.printf("[WiFi] IP Address: %s\n", WiFi.localIP().toString().c_str());
                Serial.printf("[WiFi] Subnet:     %s\n", WiFi.subnetMask().toString().c_str());
                Serial.printf("[WiFi] Gateway:    %s\n", WiFi.gatewayIP().toString().c_str());
                Serial.printf("[WiFi] MAC:        %s\n", WiFi.macAddress().c_str());
                Serial.printf("[WiFi] Signal:     %d dBm\n", WiFi.RSSI());

                syncNTP();
                statusLed.setMode(LED_MODE_CONNECTED);
            } else if (now - _connectStartTime >= WIFI_CONNECT_TIMEOUT_MS) {
                Serial.println("[WiFi] Connection attempt timed out. Will retry...");
                WiFi.disconnect(true);
                _state = WIFI_MGR_DISCONNECTED;
                _lastAttemptTime = now;
            }
            break;

        case WIFI_MGR_CONNECTED:
            if (WiFi.status() != WL_CONNECTED) {
                Serial.println("[WiFi] Connection lost!");
                _state = WIFI_MGR_DISCONNECTED;
                _lastAttemptTime = now;
                _ntpSynced = false;
                statusLed.setMode(LED_MODE_DISCONNECTED);
            } else if (!_ntpSynced) {
                // Check if NTP completed in background
                time_t epoch = time(nullptr);
                if (epoch > 1600000000) {
                    _ntpSynced = true;
                    Serial.printf("[NTP] System epoch locked: %ld\n", (long)epoch);
                }
            }
            break;
    }
}

bool WiFiManager::isConnected() const {
    return (_state == WIFI_MGR_CONNECTED && WiFi.status() == WL_CONNECTED);
}

WiFiManagerState WiFiManager::getState() const {
    return _state;
}

int32_t WiFiManager::getRSSI() const {
    if (isConnected()) {
        return WiFi.RSSI();
    }
    return -100;
}

String WiFiManager::getIP() const {
    if (isConnected()) {
        return WiFi.localIP().toString();
    }
    return "0.0.0.0";
}

String WiFiManager::getMacAddress() const {
    return WiFi.macAddress();
}

uint32_t WiFiManager::getEpochTime() const {
    time_t now = time(nullptr);
    if (now > 1600000000) {
        return (uint32_t)now;
    }
    // Fallback: return uptime seconds if NTP not yet locked
    return (uint32_t)(millis() / 1000);
}

void WiFiManager::reconnect() {
    Serial.println("[WiFi] Manual reconnect requested.");
    WiFi.disconnect(true);
    _state = WIFI_MGR_DISCONNECTED;
    _lastAttemptTime = 0; // immediate retry
}
