import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config/api_config.dart';

class ApiException implements Exception {
  final String message;
  final int? statusCode;
  const ApiException(this.message, [this.statusCode]);
  @override
  String toString() => message;
}

/// Typed boundary around the routes that actually exist in backend/src/server.ts.
/// Errors are surfaced to the UI rather than silently converted to empty data.
class ApiService {
  ApiService({String? baseUrl, FlutterSecureStorage? storage})
      : baseUrl = (baseUrl ?? ApiConfig.baseUrl).replaceFirst(RegExp(r'/$'), ''),
        _storage = storage ?? const FlutterSecureStorage();

  String baseUrl;
  final FlutterSecureStorage _storage;
  static const _tokenKey = 'propertyguard.jwt';

  Future<String?> get token => _storage.read(key: _tokenKey);
  Future<void> clearSession() => _storage.delete(key: _tokenKey);

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: query);

  Future<Map<String, String>> _headers({bool json = false}) async {
    final headers = <String, String>{'Accept': 'application/json'};
    if (json) headers['Content-Type'] = 'application/json';
    final accessToken = await token;
    if (accessToken != null && accessToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $accessToken';
    }
    return headers;
  }

  Future<dynamic> _request(
    String method,
    String path, {
    Map<String, String>? query,
    Map<String, dynamic>? body,
  }) async {
    final headers = await _headers(json: body != null);
    final uri = _uri(path, query);
    late http.Response response;
    try {
      if (method == 'POST') {
        response = await http.post(uri, headers: headers, body: jsonEncode(body)).timeout(ApiConfig.requestTimeout);
      } else if (method == 'PATCH') {
        response = await http.patch(uri, headers: headers, body: jsonEncode(body ?? const {})).timeout(ApiConfig.requestTimeout);
      } else if (method == 'DELETE') {
        response = await http.delete(uri, headers: headers, body: jsonEncode(body ?? const {})).timeout(ApiConfig.requestTimeout);
      } else {
        response = await http.get(uri, headers: headers).timeout(ApiConfig.requestTimeout);
      }
    } on Exception catch (e) {
      throw ApiException('Could not reach PropertyGuard services. Check your connection and API URL. ($e)');
    }

    dynamic payload;
    try {
      payload = response.body.isEmpty ? null : jsonDecode(response.body);
    } catch (_) {
      payload = null;
    }
    if (response.statusCode == 401 || response.statusCode == 403) {
      if (response.statusCode == 401 || _message(payload).toLowerCase().contains('expired')) {
        await clearSession();
        throw const ApiException('Your session has expired. Please sign in again.', 401);
      }
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(_message(payload, fallback: 'Request failed (${response.statusCode}).'), response.statusCode);
    }
    return payload;
  }

  String _message(dynamic payload, {String fallback = 'The request could not be completed.'}) {
    if (payload is Map && payload['error'] != null) return payload['error'].toString();
    return fallback;
  }

  Future<Map<String, dynamic>> signIn(String email, String password) async {
    final data = await _request('POST', '/api/auth/login', body: {'email': email, 'password': password});
    if (data is! Map || data['token'] == null || data['user'] is! Map) {
      throw const ApiException('The server returned an unexpected sign-in response.');
    }
    await _storage.write(key: _tokenKey, value: data['token'].toString());
    return Map<String, dynamic>.from(data['user'] as Map);
  }

  Future<Map<String, dynamic>> register(String name, String email, String password) async {
    final data = await _request('POST', '/api/auth/register', body: {'name': name, 'email': email, 'password': password});
    if (data is! Map || data['token'] == null || data['user'] is! Map) {
      throw const ApiException('The server returned an unexpected registration response.');
    }
    await _storage.write(key: _tokenKey, value: data['token'].toString());
    return Map<String, dynamic>.from(data['user'] as Map);
  }

  Future<Map<String, dynamic>> me() async {
    final data = await _request('GET', '/api/auth/me');
    if (data is Map && data['user'] is Map) return Map<String, dynamic>.from(data['user'] as Map);
    throw const ApiException('Could not load the signed-in account.');
  }

  Future<List<Map<String, dynamic>>> properties() async => _mapList(await _request('GET', '/api/properties'));
  Future<List<Map<String, dynamic>>> zones(String propertyId) async => _mapList(await _request('GET', '/api/properties/$propertyId/zones'));
  Future<List<Map<String, dynamic>>> incidents({String? propertyId}) async => _mapList(
        await _request('GET', '/api/incidents', query: propertyId == null ? null : {'propertyId': propertyId}),
      );
  Future<List<Map<String, dynamic>>> devices() async => _mapList(await _request('GET', '/api/devices'));

  Future<Map<String, dynamic>?> latestReading(String deviceId) async {
    final data = await _request('GET', '/api/telemetry/latest', query: {'deviceId': deviceId});
    if (data is Map && data.isNotEmpty) return Map<String, dynamic>.from(data);
    return null;
  }

  Future<Map<String, dynamic>> acknowledge(String incidentId) async {
    final data = await _request('PATCH', '/api/incidents/$incidentId/acknowledge', body: const {});
    return Map<String, dynamic>.from(data as Map);
  }

  Future<Map<String, dynamic>> claimDevice({required String pairingToken, required String propertyId}) async {
    final data = await _request('POST', '/api/devices/claim', body: {'pairingToken': pairingToken, 'propertyId': propertyId});
    return Map<String, dynamic>.from(data as Map);
  }

  Future<List<Map<String, dynamic>>> delegates(String propertyId) async =>
      _mapList(await _request('GET', '/api/properties/$propertyId/delegates'));

  Future<Map<String, dynamic>> addDelegate(String propertyId, String email) async {
    final data = await _request('POST', '/api/properties/$propertyId/delegates', body: {'email': email});
    return Map<String, dynamic>.from(data as Map);
  }

  Future<void> revokeDelegate(String propertyId, String userId) async {
    await _request('DELETE', '/api/properties/$propertyId/delegates/$userId');
  }

  Future<void> registerPushToken(String token, String platform) async {
    await _request('POST', '/api/auth/push-token', body: {'token': token, 'platform': platform, 'enabled': true});
  }

  Future<void> unregisterPushToken(String token) async {
    await _request('DELETE', '/api/auth/push-token', body: {'token': token});
  }

  Future<Map<String, dynamic>> createProperty({required String name, String? address}) async {
    return Map<String, dynamic>.from(await _request('POST', '/api/properties', body: {
      'name': name,
      if (address != null && address.trim().isNotEmpty) 'address': address,
    }) as Map);
  }

  Future<bool> notificationPreference() async => await _storage.read(key: 'propertyguard.notifications') == 'true';

  Future<void> updateNotificationPreference(bool enabled) async {
    // Persist the device preference locally. There is no backend notification
    // preference or FCM registration endpoint in this repository.
    await _storage.write(key: 'propertyguard.notifications', value: enabled.toString());
  }

  static List<Map<String, dynamic>> _mapList(dynamic value) {
    if (value is! List) return const [];
    return value.whereType<Map>().map((item) => Map<String, dynamic>.from(item)).toList();
  }
}
