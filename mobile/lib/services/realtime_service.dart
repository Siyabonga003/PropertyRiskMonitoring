import 'dart:async';

import '../config/api_config.dart';
import 'api_service.dart';

class MonitoringSnapshot {
  final List<Map<String, dynamic>> properties;
  final List<Map<String, dynamic>> devices;
  final List<Map<String, dynamic>> incidents;
  final Map<String, List<Map<String, dynamic>>> zonesByProperty;
  final Map<String, Map<String, dynamic>> readings;
  final DateTime updatedAt;

  const MonitoringSnapshot({
    required this.properties,
    required this.devices,
    required this.incidents,
    required this.zonesByProperty,
    required this.readings,
    required this.updatedAt,
  });
}

/// REST polling is used because this backend's Socket.IO gateway presently has
/// unauthenticated global broadcasts. Private monitoring data should only move
/// over a user-scoped, authenticated transport.
class RealtimeService {
  RealtimeService(this.api);
  final ApiService api;
  final _controller = StreamController<MonitoringSnapshot>.broadcast();
  final _errors = StreamController<String>.broadcast();
  Timer? _timer;
  bool _busy = false;
  Stream<MonitoringSnapshot> get snapshots => _controller.stream;
  Stream<String> get errors => _errors.stream;

  Future<void> start() async {
    stop();
    await refresh();
    _timer = Timer.periodic(ApiConfig.refreshInterval, (_) => refresh());
  }

  Future<void> refresh() async {
    if (_busy) return;
    _busy = true;
    try {
      final properties = await api.properties();
      final devices = await api.devices();
      final incidents = await api.incidents();
      final zoneResults = await Future.wait(properties.map((p) async {
        final id = p['id']?.toString();
        if (id == null || id.isEmpty) return null;
        try { return MapEntry(id, await api.zones(id)); } on ApiException { return null; }
      }));
      final zonesByProperty = <String, List<Map<String, dynamic>>>{
        for (final entry in zoneResults.whereType<MapEntry<String, List<Map<String, dynamic>>>>()) entry.key: entry.value,
      };
      final latest = await Future.wait(devices.map((d) async {
        final id = d['id']?.toString();
        if (id == null || id.isEmpty) return null;
        try {
          final reading = await api.latestReading(id);
          return reading == null ? null : MapEntry(id, reading);
        } on ApiException { return null; }
      }));
      final readings = <String, Map<String, dynamic>>{
        for (final row in latest.whereType<MapEntry<String, Map<String, dynamic>>>()) row.key: row.value,
      };
      _controller.add(MonitoringSnapshot(
        properties: properties,
        devices: devices,
        incidents: incidents,
        zonesByProperty: zonesByProperty,
        readings: readings,
        updatedAt: DateTime.now(),
      ));
    } on ApiException catch (e) {
      _errors.add(e.message);
    } finally {
      _busy = false;
    }
  }

  void stop() { _timer?.cancel(); _timer = null; }
  Future<void> dispose() async { stop(); await _controller.close(); await _errors.close(); }
}
