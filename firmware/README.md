# ESP32 Edge Firmware — IoT Property Risk Monitoring System

Production-grade C++ firmware for the ESP32 microcontroller targeting multi-hazard environmental risk detection, autonomous alarm response, and real-time MQTT telemetry streaming with HTTP REST fallback.

---

## 1. Hardware Bill of Materials (BOM)

| Component | Model / Type | Quantity | Interface | Operating Voltage |
| :--- | :--- | :---: | :--- | :--- |
| **Microcontroller** | ESP32 DevKit V1 (30-pin or 38-pin, ESP-WROOM-32) | 1 | Wi-Fi 802.11 b/g/n | 5V via Micro-USB / Vin (3.3V logic) |
| **Combustible Gas & Smoke** | MQ-2 Sensor Breakout Module | 1 | ADC1 (A0) + Digital (D0) | 5V VCC (~150mA internal heater coil) |
| **Temperature & Humidity** | DHT22 (AM2302) | 1 | Single-Bus Digital | 3.3V or 5V VCC |
| **Water Leak Probe** | Conductive Rain / Flood Probe + LM393 Module | 1 | ADC1 (A0) + Digital (D0) | 3.3V or 5V VCC |
| **Passive Infrared Motion** | PIR HC-SR501 / AM312 | 1 | Digital Out | 5V VCC (3.3V logic out) |
| **Audible Alarm Siren** | Active 5V / 3.3V Piezo Buzzer | 1 | Digital Out | 3.3V or 5V via NPN transistor / direct |
| **Visual Indicator** | Onboard Blue LED / External Status LED | 1 | Digital Out | 3.3V (Built-in on GPIO 2) |
| **Power Supply** | 5V DC 2.0A USB Power Adapter & Micro-USB Cable | 1 | Power | 5V DC |

> [!IMPORTANT]
> **Power Recommendation**: The MQ-2 sensor includes an internal heating element that draws approximately 150mA to maintain the tin dioxide ($SnO_2$) sensing surface at operating temperature. When the ESP32 Wi-Fi radio transmits bursts (drawing up to 280mA peak), total board consumption can exceed 450mA. Use an external **5V 2A** USB power supply connected directly to the ESP32 micro-USB port or `5V/VIN` pin. Do **NOT** power the entire circuit from a laptop's unpowered USB hub during calibration.

---

## 2. Complete Wiring Diagram & Pin Mapping

### Pin Table (ESP32 DevKit V1)

| ESP32 Pin | Connected Component | Module Pin | Wire Color (Typical) | Signal Description |
| :--- | :--- | :--- | :--- | :--- |
| **GPIO 4** | DHT22 Sensor | `DATA` / `OUT` | Yellow | Single-bus bidirectional data (add 4.7kΩ pull-up to 3.3V if bare sensor) |
| **GPIO 34** | MQ-2 Smoke Sensor | `A0` (Analog Out) | Blue | ADC1 channel 6 (0–4095, safe with active Wi-Fi radio) |
| **GPIO 25** | MQ-2 Smoke Sensor | `D0` (Digital Out) | Green | Comparator threshold (Active LOW) — Hardware Interrupt attached |
| **GPIO 35** | Water Leak Probe | `A0` (Analog Out) | Orange | ADC1 channel 7 (0–4095 wetness gradient) |
| **GPIO 26** | Water Leak Probe | `D0` (Digital Out) | White | LM393 output (Active LOW when submerged) — Hardware Interrupt attached |
| **GPIO 27** | PIR Motion Sensor | `OUT` | Purple | Pyroelectric digital output (Active HIGH) — Hardware Interrupt attached |
| **GPIO 19** | Active Buzzer | `+` / `SIG` | Red / Brown | Logic HIGH = Sounding (cadence pulsed), Logic LOW = Silent |
| **GPIO 2** | Status Indicator | Onboard LED | - | Built-in Blue LED (Blink codes for Wi-Fi, MQTT, and Alarm strobe) |
| **VIN / 5V** | MQ-2, PIR Sensor | `VCC` | Red | Common 5V DC rail for sensor heaters and PIR regulator |
| **3.3V** | DHT22, Water Sensor | `VCC` | Orange | Regulated 3.3V DC rail |
| **GND** | All Sensors & Actuators | `GND` | Black | Common Ground Rail |

```
                       ESP32 DevKit V1
                      +----------------+
                      | [USB Connector]|
                      |                |
             [3.3V] --| 3V3        GND |-- Common GND
              [GND] --| GND         23 |--
    MQ-2 A0 (GPIO 34)-| 34          22 |--
   Water A0 (GPIO 35)-| 35           1 |-- (TX0)
                      | 32           3 |-- (RX0)
                      | 33          21 |--
                      | 25          19 |-- Active Buzzer SIG (GPIO 19)
    MQ-2 D0 (GPIO 25)-| 26          18 |--
   Water D0 (GPIO 26)-| 27           5 |--
     PIR D0 (GPIO 27)-| 14           4 |-- DHT22 Data (GPIO 4)
                      | 12           0 |-- (BOOT)
                      | 13           2 |-- Onboard Blue LED (GPIO 2)
              [5V] ---| VIN/5V      15 |--
                      +----------------+
```

---

## 3. Project Directory Architecture

```
firmware/
├── platformio.ini               # PlatformIO board, framework, and dependency config
├── include/
│   ├── config.h.example         # Template for Wi-Fi and MQTT credentials
│   ├── pins.h                   # Hardware GPIO declarations
│   ├── types.h                  # SensorMetrics, AlertEvent, and enum definitions
│   ├── dht_sensor.h             # DHT22 non-blocking driver
│   ├── smoke_sensor.h           # MQ-2 analog curve & calibration driver
│   ├── water_sensor.h           # Water probe analog & digital driver
│   ├── motion_sensor.h          # PIR debounced interrupt driver
│   ├── buzzer.h                 # Multi-cadence active buzzer driver
│   ├── status_led.h             # Visual state indicator driver
│   ├── wifi_manager.h           # Wi-Fi auto-reconnection state machine & NTP
│   ├── mqtt_manager.h           # PubSubClient MQTT client with LWT and QoS 1
│   └── http_client.h            # HTTP REST ingestion fallback client
├── src/
│   ├── main.cpp                 # Firmware entry point, ISRs, FreeRTOS tasks
│   ├── config.h                 # Local active configuration (git-ignored)
│   ├── wifi_manager.cpp
│   ├── mqtt_manager.cpp
│   ├── http_client.cpp
│   ├── sensors/
│   │   ├── dht_sensor.cpp
│   │   ├── smoke_sensor.cpp
│   │   ├── water_sensor.cpp
│   │   └── motion_sensor.cpp
│   └── actuators/
│       ├── buzzer.cpp
│       └── status_led.cpp
└── README.md
```

---

## 4. Software Setup & Flashing Guide

### Prerequisites
- [VS Code](https://code.visualstudio.com/) with the **PlatformIO IDE** extension installed.
- Or PlatformIO Core CLI: `pip install -U platformio`.
- CP2102 or CH340 USB-to-UART bridge driver for ESP32.

### Step 1: Configure Credentials
1. Copy `include/config.h.example` to `src/config.h`:
   ```bash
   cp include/config.h.example src/config.h
   ```
2. Open `src/config.h` and edit your Wi-Fi credentials and Broker address:
   ```cpp
   #define WIFI_SSID         "Your_WiFi_Network"
   #define WIFI_PASSWORD     "Your_Password"

   #define MQTT_BROKER_HOST  "192.168.1.100"   // IP of your Mosquitto host
   #define MQTT_BROKER_PORT  1883
   #define MQTT_USERNAME     "esp32_node"
   #define MQTT_PASSWORD     "node_secret_key"

   #define PROPERTY_ID       "prop_demo_001"
   #define ZONE_ID           "zone_kitchen_01"
   #define DEVICE_ID         "ESP32_A1B2C3"
   ```

### Step 2: Build & Flash
Connect your ESP32 to your PC via USB:

#### Option A: Using PlatformIO IDE (VS Code)
1. Open the `/firmware` folder in VS Code.
2. Click the **Build** checkmark `(✓)` on the blue bottom status bar.
3. Click the **Upload** arrow `(→)` to flash the binary to the ESP32.
4. Click the **Serial Monitor** plug `(🔌)` to observe real-time boot logs at 115200 baud.

#### Option B: Using PlatformIO CLI
```bash
# Navigate to firmware directory
cd firmware

# Build firmware
pio run

# Upload to connected ESP32
pio run --target upload

# Open Serial Monitor
pio device monitor -b 115200
```

---

## 5. Network Communication Contracts

### 5.1 MQTT Topic Hierarchy

| Direction | Topic Pattern | QoS | Purpose |
| :--- | :--- | :---: | :--- |
| **ESP32 &rarr; Broker** | `properties/{propertyId}/zones/{zoneId}/devices/{deviceId}/telemetry` | 0 | Regular health and environmental metrics |
| **ESP32 &rarr; Broker** | `properties/{propertyId}/zones/{zoneId}/devices/{deviceId}/alert` | 1 | Urgent hazard interrupt events |
| **ESP32 &rarr; Broker** | `devices/{deviceId}/status` | 1 (Retained) | LWT status (`"offline"` on abrupt drop, `"online"` on connect) |
| **Broker &rarr; ESP32** | `devices/{deviceId}/commands` | 1 | Actuator commands (`TRIGGER_BUZZER`, `SILENCE_BUZZER`, `SET_INTERVAL`) |
| **Broker &rarr; ESP32** | `devices/{deviceId}/config` | 1 | Dynamic reporting parameters |

### 5.2 Payload Samples

#### Telemetry JSON Payload
```json
{
  "deviceId": "ESP32_A1B2C3",
  "timestamp": 1793318400,
  "metrics": {
    "temperature": 24.2,
    "humidity": 45.8,
    "smoke_ppm": 38.5,
    "water_detected": false,
    "motion_detected": false
  },
  "diagnostics": {
    "wifi_rssi": -58,
    "uptime_seconds": 1240,
    "free_heap": 178240
  }
}
```

#### Hazard Alert JSON Payload
```json
{
  "deviceId": "ESP32_A1B2C3",
  "timestamp": 1793318412,
  "hazardType": "WATER_LEAK",
  "severity": "CRITICAL",
  "value": 85.0,
  "unit": "%",
  "message": "Critical water leak detected at probe sensor!"
}
```

#### Actuator Command Examples
Send to `devices/ESP32_A1B2C3/commands`:
```json
{
  "command": "TRIGGER_BUZZER",
  "parameters": {
    "pattern": "SMOKE",
    "durationMs": 10000
  }
}
```
Or silence the alarm remotely:
```json
{
  "command": "SILENCE_BUZZER"
}
```

---

## 6. LED and Buzzer Operational Indicators

### Status LED Indications
- **Slow Blink (1s period)**: Disconnected from Wi-Fi.
- **Fast Blink (240ms period)**: Connecting to Wi-Fi / MQTT Broker.
- **Solid ON with Heartbeat Dip**: Fully connected to Wi-Fi and MQTT Broker.
- **High-Speed Strobe (90ms period)**: Active Critical Hazard Alarm.

### Buzzer Cadence Patterns
- **Smoke Hazard**: Urgent rapid pulsing (100ms ON / 100ms OFF).
- **Water Hazard**: Heavy siren tone (500ms ON / 200ms OFF).
- **Motion Intrusion**: Warning double-chirp.
- **Startup / Test**: Single 120ms confirmation beep.
