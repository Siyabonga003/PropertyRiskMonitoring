import 'dart:async';
import 'package:flutter/material.dart';
import '../models/telemetry.dart';
import '../models/incident.dart';
import '../models/property.dart';
import '../services/api_service.dart';
import '../services/realtime_service.dart';
import '../theme/app_theme.dart';
import '../widgets/critical_alert_banner.dart';
import '../widgets/arming_control_panel.dart';
import '../widgets/sensor_gauge_card.dart';
import '../widgets/actuator_control_card.dart';
import '../widgets/incident_card.dart';
import '../widgets/settings_dialog.dart';

class DashboardScreen extends StatefulWidget {
  final ApiService apiService;
  final RealtimeService realtimeService;

  const DashboardScreen({
    super.key,
    required this.apiService,
    required this.realtimeService,
  });

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Property? _currentProperty;
  TelemetryReading? _latestTelemetry;
  List<Incident> _incidents = [];
  bool _isArmingUpdating = false;
  bool _isActuatorBusy = false;
  bool _showAllIncidents = false;

  late StreamSubscription<TelemetryReading> _telemetrySub;
  late StreamSubscription<List<Incident>> _incidentsSub;
  late StreamSubscription<bool> _connectionSub;

  @override
  void initState() {
    super.initState();

    // 1. Listen to real-time streams
    _telemetrySub = widget.realtimeService.telemetryStream.listen((reading) {
      if (mounted) {
        setState(() {
          _latestTelemetry = reading;
        });
      }
    });

    _incidentsSub = widget.realtimeService.incidentsStream.listen((incidentsList) {
      if (mounted) {
        setState(() {
          _incidents = incidentsList;
        });
      }
    });

    _connectionSub = widget.realtimeService.connectionStream.listen((_) {
      if (mounted) setState(() {});
    });

    // 2. Initial property loading and start real-time sync
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final properties = await widget.apiService.getProperties();
    if (properties.isNotEmpty) {
      _currentProperty = properties.first;
    }
    if (mounted) {
      setState(() {});
      widget.realtimeService.start(propertyId: _currentProperty?.id);
    }
  }

  @override
  void dispose() {
    _telemetrySub.cancel();
    _incidentsSub.cancel();
    _connectionSub.cancel();
    super.dispose();
  }

  Future<void> _handleArmingChange(ArmingState newState) async {
    if (_currentProperty == null) return;
    setState(() => _isArmingUpdating = true);

    final success = await widget.apiService.updateArmingState(_currentProperty!.id, newState);
    if (success && mounted) {
      setState(() {
        _currentProperty = _currentProperty!.copyWith(armingState: newState);
        _isArmingUpdating = false;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Arming state updated to ${newState.label}'),
          backgroundColor: AppColors.surfaceLight,
          duration: const Duration(seconds: 2),
        ),
      );
    } else if (mounted) {
      setState(() => _isArmingUpdating = false);
    }
  }

  Future<void> _handleAcknowledgeIncident(Incident incident) async {
    final ok = await widget.apiService.acknowledgeIncident(incident.id);
    if (ok) {
      widget.realtimeService.refreshNow(propertyId: _currentProperty?.id);
    }
  }

  Future<void> _handleResolveIncident(Incident incident) async {
    final ok = await widget.apiService.resolveIncident(incident.id);
    if (ok) {
      widget.realtimeService.refreshNow(propertyId: _currentProperty?.id);
    }
  }

  Future<void> _handleTriggerSiren() async {
    final deviceId = _latestTelemetry?.deviceId ?? 'ESP32_A1B2C3';
    setState(() => _isActuatorBusy = true);
    await widget.apiService.triggerBuzzer(deviceId, durationMs: 25000, pattern: 'PULSE');
    if (mounted) setState(() => _isActuatorBusy = false);
    widget.realtimeService.refreshNow(propertyId: _currentProperty?.id);
  }

  Future<void> _handleSilenceBuzzer() async {
    final deviceId = _latestTelemetry?.deviceId ?? 'ESP32_A1B2C3';
    setState(() => _isActuatorBusy = true);
    await widget.apiService.silenceBuzzer(deviceId);
    if (mounted) setState(() => _isActuatorBusy = false);
    widget.realtimeService.refreshNow(propertyId: _currentProperty?.id);
  }

  void _openSettings() {
    showDialog(
      context: context,
      builder: (ctx) => SettingsDialog(
        apiService: widget.apiService,
        onSaved: () {
          widget.realtimeService.start(propertyId: _currentProperty?.id);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isOnline = widget.realtimeService.isConnected;
    final metrics = _latestTelemetry?.metrics ?? const SensorMetrics();
    final diagnostics = _latestTelemetry?.diagnostics;

    // Filter active critical hazards for emergency banner
    final criticalIncidents = _incidents.where((i) {
      return i.status != IncidentStatus.resolved &&
          (i.severity == IncidentSeverity.critical ||
              i.hazardType == HazardType.flame ||
              i.hazardType == HazardType.gasLeak);
    }).toList();

    // Incident list to display
    final displayedIncidents = _showAllIncidents
        ? _incidents
        : _incidents.where((i) => i.status != IncidentStatus.resolved).toList();

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.shield_outlined, color: AppColors.primary, size: 20),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _currentProperty?.name ?? 'Property Risk Monitor',
                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    _currentProperty?.address ?? 'IoT Multi-Hazard Edge System',
                    style: const TextStyle(fontSize: 10, color: AppColors.textMuted),
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          // Online status indicator pulse
          Center(
            child: Container(
              margin: const EdgeInsets.only(right: 8),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isOnline ? AppColors.safeBg : AppColors.dangerBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: isOnline ? AppColors.safe : AppColors.danger, width: 0.8),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: isOnline ? AppColors.safe : AppColors.danger,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    isOnline ? 'LIVE' : 'OFFLINE',
                    style: TextStyle(
                      color: isOnline ? AppColors.safe : AppColors.danger,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.settings_outlined, size: 20),
            tooltip: 'Server Settings',
            onPressed: _openSettings,
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => widget.realtimeService.refreshNow(propertyId: _currentProperty?.id),
        color: AppColors.primary,
        backgroundColor: AppColors.surface,
        child: ListView(
          padding: const EdgeInsets.only(bottom: 30),
          children: [
            // 1. Emergency Flashing Alert Banner
            CriticalAlertBanner(
              criticalIncidents: criticalIncidents,
              onAcknowledge: _handleAcknowledgeIncident,
            ),

            // 2. Security Arming Mode Control
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: ArmingControlPanel(
                currentState: _currentProperty?.armingState ?? ArmingState.disarmed,
                isLoading: _isArmingUpdating,
                onStateSelected: _handleArmingChange,
              ),
            ),

            const SizedBox(height: 10),

            // 3. Section Title: Multi-Hazard Real-Time Sensors
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'MULTI-HAZARD SENSOR TELEMETRY',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                  Text(
                    _latestTelemetry != null ? 'Synced' : 'Connecting...',
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
                  ),
                ],
              ),
            ),

            // 4. Sensor Grid (Flame, Gas, Smoke, Water, Temp/Hum, Motion)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                childAspectRatio: 1.15,
                children: [
                  // CARD 1: Optical Flame Sensor
                  SensorGaugeCard(
                    title: 'Optical Flame',
                    valueText: metrics.flameDetected ? 'DETECTED' : 'Safe',
                    unitText: null,
                    statusText: metrics.flameDetected ? 'FIRE ALARM' : 'Nominal',
                    status: metrics.flameDetected ? SensorStatus.danger : SensorStatus.safe,
                    icon: Icons.local_fire_department_rounded,
                    accentColor: AppColors.accentFlame,
                    subtitle: metrics.flameDetected ? 'IR radiation source detected!' : '760-1100nm IR standby',
                    progress: metrics.flameDetected ? 1.0 : 0.05,
                  ),

                  // CARD 2: Combustible Gas / LPG Sensor (MQ-2)
                  SensorGaugeCard(
                    title: 'Combustible Gas',
                    valueText: (metrics.gasPpm ?? 15.0).toStringAsFixed(1),
                    unitText: 'ppm',
                    statusText: (metrics.gasPpm ?? 0) >= 200
                        ? 'DANGER'
                        : (metrics.gasPpm ?? 0) >= 100
                            ? 'WARNING'
                            : 'SAFE',
                    status: (metrics.gasPpm ?? 0) >= 200
                        ? SensorStatus.danger
                        : (metrics.gasPpm ?? 0) >= 100
                            ? SensorStatus.warning
                            : SensorStatus.safe,
                    icon: Icons.warning_amber_rounded,
                    accentColor: AppColors.accentGas,
                    subtitle: 'MQ-2 LPG & Methane curve',
                    progress: ((metrics.gasPpm ?? 0) / 400.0).clamp(0.0, 1.0),
                  ),

                  // CARD 3: Smoke PPM Sensor (MQ-2)
                  SensorGaugeCard(
                    title: 'Smoke Concentration',
                    valueText: (metrics.smokePpm ?? 20.0).toStringAsFixed(1),
                    unitText: 'ppm',
                    statusText: (metrics.smokePpm ?? 0) >= 300
                        ? 'CRITICAL'
                        : (metrics.smokePpm ?? 0) >= 150
                            ? 'ELEVATED'
                            : 'NORMAL',
                    status: (metrics.smokePpm ?? 0) >= 300
                        ? SensorStatus.danger
                        : (metrics.smokePpm ?? 0) >= 150
                            ? SensorStatus.warning
                            : SensorStatus.safe,
                    icon: Icons.cloud_rounded,
                    accentColor: AppColors.secondary,
                    subtitle: 'Threshold: 300 ppm',
                    progress: ((metrics.smokePpm ?? 0) / 500.0).clamp(0.0, 1.0),
                  ),

                  // CARD 4: Water Leak Probe
                  SensorGaugeCard(
                    title: 'Water Leak Probe',
                    valueText: metrics.waterDetected ? 'LEAK!' : 'Dry',
                    unitText: null,
                    statusText: metrics.waterDetected ? 'SUBMERGED' : 'DRY',
                    status: metrics.waterDetected ? SensorStatus.danger : SensorStatus.safe,
                    icon: Icons.water_drop_rounded,
                    accentColor: AppColors.accentWater,
                    subtitle: metrics.waterDetected ? 'Floor probe triggered' : 'Resistance probe nominal',
                    progress: metrics.waterDetected ? 1.0 : 0.05,
                  ),

                  // CARD 5: Temperature & Humidity (DHT22)
                  SensorGaugeCard(
                    title: 'Temp & Humidity',
                    valueText: '${(metrics.temperature ?? 22.0).toStringAsFixed(1)}°',
                    unitText: 'C  |  ${(metrics.humidity ?? 45.0).toStringAsFixed(0)}%',
                    statusText: (metrics.temperature ?? 22) > 45 || (metrics.temperature ?? 22) < 3
                        ? 'ANOMALY'
                        : 'COMFORT',
                    status: (metrics.temperature ?? 22) > 45 || (metrics.temperature ?? 22) < 3
                        ? SensorStatus.warning
                        : SensorStatus.safe,
                    icon: Icons.thermostat_rounded,
                    accentColor: AppColors.primary,
                    subtitle: 'DHT22 Digital Dual Sensor',
                    progress: ((metrics.temperature ?? 20) / 60.0).clamp(0.0, 1.0),
                  ),

                  // CARD 6: PIR Motion Sensor
                  SensorGaugeCard(
                    title: 'PIR Motion Sensor',
                    valueText: metrics.motionDetected ? 'ACTIVE' : 'Clear',
                    unitText: null,
                    statusText: metrics.motionDetected ? 'MOTION' : 'STANDBY',
                    status: metrics.motionDetected &&
                            _currentProperty?.armingState != ArmingState.disarmed
                        ? SensorStatus.danger
                        : SensorStatus.safe,
                    icon: Icons.directions_run_rounded,
                    accentColor: AppColors.safe,
                    subtitle: 'HC-SR501 Infrared PIR',
                    progress: metrics.motionDetected ? 1.0 : 0.05,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),

            // 5. Edge Actuator & Siren Controls
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: ActuatorControlCard(
                diagnostics: diagnostics,
                isBuzzerActive: diagnostics?.buzzerActive == true,
                isBusy: _isActuatorBusy,
                onTriggerSiren: _handleTriggerSiren,
                onSilenceBuzzer: _handleSilenceBuzzer,
              ),
            ),

            const SizedBox(height: 10),

            // 6. Incidents Audit Trail Section
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text(
                    'RECENT INCIDENTS & AUDIT LOG',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                  TextButton(
                    style: TextButton.styleFrom(
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(50, 24),
                    ),
                    onPressed: () => setState(() => _showAllIncidents = !_showAllIncidents),
                    child: Text(
                      _showAllIncidents ? 'Show Active' : 'Show All',
                      style: const TextStyle(fontSize: 11, color: AppColors.primary),
                    ),
                  ),
                ],
              ),
            ),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: displayedIncidents.isEmpty
                  ? Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        children: [
                          Icon(Icons.check_circle_outline_rounded,
                              color: AppColors.safe.withValues(alpha: 0.7), size: 36),
                          const SizedBox(height: 8),
                          const Text(
                            'All Systems Secure',
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'No unresolved environmental or intrusion incidents.',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    )
                  : Column(
                      children: displayedIncidents.map((incident) {
                        return IncidentCard(
                          incident: incident,
                          onAcknowledge: _handleAcknowledgeIncident,
                          onResolve: _handleResolveIncident,
                        );
                      }).toList(),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
