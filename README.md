# 🛡️ IoT Multi-Hazard Property Risk Monitoring System

A full-stack, enterprise-grade IoT Property Risk Monitoring System using an **ESP32 microcontroller** with multi-hazard environmental sensors (smoke, water leak, temperature/humidity, and motion), an event-driven **Node.js/Express (TypeScript) backend** with **PostgreSQL (Prisma ORM)** and **Eclipse Mosquitto MQTT**, and a real-time **React (Vite + Tailwind CSS) mission-control web dashboard**.

---

## 📐 System Architecture

```
                                  ┌────────────────────────┐
                                  │   ESP32 Edge Device    │
                                  │ (DHT22, MQ-2, Water,   │
                                  │   PIR, Active Buzzer)  │
                                  └───────────┬────────────┘
                                              │ MQTT (Port 1883)
                                              ▼
                                  ┌────────────────────────┐
                                  │ Eclipse Mosquitto MQTT │
                                  │ (or Embedded Aedes)    │
                                  └───────────┬────────────┘
                                              │ MQTT Pub/Sub
                                              ▼
┌───────────────────────┐  REST / WS  ┌────────────────────────┐  Prisma   ┌────────────────────────┐
│ React 19 Web UI       │◄───────────►│ Node.js/Express Server │──────────►│ PostgreSQL Database    │
│ (Vite + Tailwind CSS) │ (Port 5000) │ (Risk & Alert Engine)  │           │ (Time-series telemetry │
└───────────────────────┘             └────────────────────────┘           │  & Incidents log)      │
                                                                           └────────────────────────┘
```

---

## 🗂️ Subsystems & Folder Layout

| Directory | Subsystem | Tech Stack | Responsibility |
| :--- | :--- | :--- | :--- |
| **[`/firmware`](./firmware)** | Edge Firmware | PlatformIO, C++, FreeRTOS, PubSubClient, ArduinoJson | Reads DHT22, MQ-2, Water probe, and PIR motion sensor; executes hardware ISR interrupts for instant alert dispatch; subscribes to remote buzzer commands. |
| **[`/backend`](./backend)** | Core Ingestion & API | Node.js, Express, TypeScript, Prisma, PostgreSQL, Socket.IO, MQTT | Ingests MQTT & HTTP telemetry; evaluates risk rules; manages property arming state; dispatches real-time alerts; includes CLI virtual ESP32 simulator. |
| **[`/dashboard`](./dashboard)** | Web Mission Control | React 19, Vite, Tailwind CSS, Lucide, Recharts, Socket.IO Client | Live sensor gauges, emergency flashing siren banner with audible Web Audio alarm, property arming controls, incident audit log, and historical analytics. |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node.js v24+)
- **PlatformIO**: (optional, for physical ESP32 flashing)
- **Docker & Docker Compose**: (optional, for containerized PostgreSQL & Mosquitto)

### 2. Start Infrastructure (Optional Docker)
If you have Docker installed:
```bash
docker compose up -d
```
> *Note: If Docker is not installed, the backend automatically provides an embedded MQTT broker and fallback storage options so you can develop and test immediately.*

### 3. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npm run dev
```
Backend starts on `http://localhost:5000` with WebSocket support on the same port.

### 4. Dashboard Setup
```bash
cd ../dashboard
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Run the Virtual ESP32 Simulator (Instant Hardware Test)
No physical hardware needed for testing! From the backend directory:
```bash
cd backend
npm run simulate
```
- Press `[s]` to trigger a smoke spike (>600 PPM)
- Press `[w]` to simulate a water leak event
- Press `[m]` to simulate unauthorized motion (triggers alarm when Armed)
- Press `[n]` to normalize all sensors to safe conditions

---

## ⚡ Hardware Pinout (ESP32 DevKit V1)

| Sensor / Actuator | Module | ESP32 Pin | Signal Type | Power |
| :--- | :--- | :--- | :--- | :--- |
| **Smoke / Gas** | MQ-2 / MQ-135 | `GPIO 34` (A0) / `GPIO 25` (D0) | ADC1 / Digital Interrupt | 5V (heater coil) |
| **Temp & Humidity**| DHT22 (AM2302) | `GPIO 4` | Digital Single-Bus | 3.3V / 5V |
| **Water Leak** | Resistance Probe | `GPIO 35` (A0) / `GPIO 26` (D0) | ADC1 / Active Low Interrupt | 3.3V |
| **PIR Motion** | HC-SR501 | `GPIO 27` | Active High Interrupt | 5V (3.3V signal) |
| **Audible Siren** | Active Buzzer | `GPIO 19` | Digital Output | 3.3V / 5V |
| **Status LED** | Onboard LED | `GPIO 2` | Digital Output | 3.3V |

---

## 🔐 Security & Arming States

- **DISARMED**: Temperature, smoke, and water leak sensors remain on 24/7 active surveillance. Motion detection is logged as ambient activity without sounding alarms.
- **ARMED_HOME**: Smoke, water, perimeter motion sensors active; alerts dispatched on intruder detection.
- **ARMED_AWAY**: Maximum surveillance mode. Any interior or exterior motion immediately triggers critical incidents, dashboard audio siren, and MQTT command to fire edge buzzer.
