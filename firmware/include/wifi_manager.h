#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>

enum WiFiManagerState {
    WIFI_MGR_DISCONNECTED,
    WIFI_MGR_CONNECTING,
    WIFI_MGR_CONNECTED
};

/**
 * ============================================================================
 * Non-blocking Wi-Fi Connection Manager
 * Manages Wi-Fi lifecycle, auto-reconnection, NTP time sync, and diagnostics.
 * ============================================================================
 */
class WiFiManager {
public:
    WiFiManager();

    // Start Wi-Fi subsystem with given SSID and password
    void begin(const char* ssid, const char* password);

    // Non-blocking update called periodically in loop/task
    void update();

    // Query status
    bool isConnected() const;
    WiFiManagerState getState() const;
    int32_t getRSSI() const;
    String getIP() const;
    String getMacAddress() const;
    uint32_t getEpochTime() const;

    // Manual reconnect request
    void reconnect();

private:
    void initiateConnection();
    void syncNTP();

    const char* _ssid;
    const char* _password;
    WiFiManagerState _state;
    uint32_t _lastAttemptTime;
    uint32_t _connectStartTime;
    bool _ntpSynced;
};

extern WiFiManager wifiManager;

#endif // WIFI_MANAGER_H
