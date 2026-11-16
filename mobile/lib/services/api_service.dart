import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/telemetry.dart';
import '../models/incident.dart';
import '../models/property.dart';

class ApiService {
  String baseUrl;

  ApiService({this.baseUrl = 'http://10.0.2.2:5000'}); // default to Android emulator loopback

  void updateBaseUrl(String url) {
    if (url.endsWith('/')) {
      baseUrl = url.substring(0, url.length - 1);
    } else {
      baseUrl = url;
    }
  }

  // Properties
  Future<List<Property>> getProperties() async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/api/properties'))
          .timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final List<dynamic> list = jsonDecode(res.body);
        return list.map((p) => Property.fromJson(p as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<Property?> getProperty(String id) async {
    try {
      final res = await http
          .get(Uri.parse('$baseUrl/api/properties/$id'))
          .timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        return Property.fromJson(jsonDecode(res.body));
      }
    } catch (_) {}
    return null;
  }

  Future<bool> updateArmingState(String propertyId, ArmingState state) async {
    try {
      final res = await http
          .patch(
            Uri.parse('$baseUrl/api/properties/$propertyId/arming'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'armingState': state.toApiString()}),
          )
          .timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // Telemetry
  Future<TelemetryReading?> getLatestTelemetry({String? deviceId}) async {
    try {
      final uri = Uri.parse('$baseUrl/api/telemetry/latest')
          .replace(queryParameters: deviceId != null ? {'deviceId': deviceId} : null);
      final res = await http.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data is Map<String, dynamic> && data.isNotEmpty) {
          return TelemetryReading.fromJson(data);
        }
      }
    } catch (_) {}
    return null;
  }

  Future<List<TelemetryReading>> getTelemetryHistory({String? deviceId, int limit = 20}) async {
    try {
      final queryParams = <String, String>{
        'limit': limit.toString(),
      };
      if (deviceId != null) {
        queryParams['deviceId'] = deviceId;
      }
      final uri = Uri.parse('$baseUrl/api/telemetry/history').replace(queryParameters: queryParams);
      final res = await http.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final List<dynamic> list = jsonDecode(res.body);
        return list.map((r) => TelemetryReading.fromJson(r as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  // Incidents
  Future<List<Incident>> getIncidents({String? propertyId, IncidentStatus? status}) async {
    try {
      final params = <String, String>{};
      if (propertyId != null) params['propertyId'] = propertyId;
      if (status != null) {
        params['status'] = status.name.toUpperCase();
      }
      final uri = Uri.parse('$baseUrl/api/incidents').replace(queryParameters: params);
      final res = await http.get(uri).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final List<dynamic> list = jsonDecode(res.body);
        return list.map((i) => Incident.fromJson(i as Map<String, dynamic>)).toList();
      }
    } catch (_) {}
    return [];
  }

  Future<bool> acknowledgeIncident(String incidentId, {String? userId}) async {
    try {
      final res = await http
          .patch(
            Uri.parse('$baseUrl/api/incidents/$incidentId/acknowledge'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'userId': userId ?? 'user_mobile'}),
          )
          .timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> resolveIncident(String incidentId) async {
    try {
      final res = await http
          .patch(
            Uri.parse('$baseUrl/api/incidents/$incidentId/resolve'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({}),
          )
          .timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // Actuator Commands
  Future<bool> triggerBuzzer(String deviceId, {int durationMs = 30000, String pattern = 'PULSE'}) async {
    try {
      final res = await http
          .post(
            Uri.parse('$baseUrl/api/devices/$deviceId/command'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'command': 'TRIGGER_BUZZER',
              'parameters': {
                'durationMs': durationMs,
                'pattern': pattern,
              },
            }),
          )
          .timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<bool> silenceBuzzer(String deviceId) async {
    try {
      final res = await http
          .post(
            Uri.parse('$baseUrl/api/devices/$deviceId/command'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'command': 'SILENCE_BUZZER',
            }),
          )
          .timeout(const Duration(seconds: 4));
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }
}
