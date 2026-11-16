import 'dart:async';
import '../models/telemetry.dart';
import '../models/incident.dart';
import 'api_service.dart';

class RealtimeService {
  final ApiService api;
  Timer? _pollingTimer;

  final _telemetryController = StreamController<TelemetryReading>.broadcast();
  final _incidentsController = StreamController<List<Incident>>.broadcast();
  final _connectionController = StreamController<bool>.broadcast();

  bool _isPolling = false;
  bool _isConnected = false;

  Stream<TelemetryReading> get telemetryStream => _telemetryController.stream;
  Stream<List<Incident>> get incidentsStream => _incidentsController.stream;
  Stream<bool> get connectionStream => _connectionController.stream;
  bool get isConnected => _isConnected;

  RealtimeService({required this.api});

  void start({String? propertyId, String? deviceId, Duration interval = const Duration(seconds: 2)}) {
    stop();
    _isPolling = true;

    // Immediate first fetch
    _poll(propertyId: propertyId, deviceId: deviceId);

    // Periodic reactive synchronization loop
    _pollingTimer = Timer.periodic(interval, (_) {
      if (_isPolling) {
        _poll(propertyId: propertyId, deviceId: deviceId);
      }
    });
  }

  Future<void> _poll({String? propertyId, String? deviceId}) async {
    try {
      final futures = await Future.wait([
        api.getLatestTelemetry(deviceId: deviceId),
        api.getIncidents(propertyId: propertyId),
      ]);

      final latestTelemetry = futures[0] as TelemetryReading?;
      final incidents = futures[1] as List<Incident>?;

      if (latestTelemetry != null) {
        _telemetryController.add(latestTelemetry);
      }

      if (incidents != null) {
        _incidentsController.add(incidents);
      }

      _setConnected(true);
    } catch (_) {
      _setConnected(false);
    }
  }

  void _setConnected(bool status) {
    if (_isConnected != status) {
      _isConnected = status;
      _connectionController.add(status);
    }
  }

  Future<void> refreshNow({String? propertyId, String? deviceId}) async {
    await _poll(propertyId: propertyId, deviceId: deviceId);
  }

  void stop() {
    _isPolling = false;
    _pollingTimer?.cancel();
    _pollingTimer = null;
    _setConnected(false);
  }

  void dispose() {
    stop();
    _telemetryController.close();
    _incidentsController.close();
    _connectionController.close();
  }
}
