import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

import '../config/firebase_options.dart';
import 'api_service.dart';

class FcmRegistrationService {
  FcmRegistrationService(this.api);
  final ApiService api;
  StreamSubscription<String>? _refreshSubscription;
  String? _registeredToken;

  Future<bool> activate() async {
    final options = PropertyGuardFirebaseOptions.current;
    if (options == null) return false;
    try {
      if (Firebase.apps.isEmpty) await Firebase.initializeApp(options: options);
      final messaging = FirebaseMessaging.instance;
      final permission = await messaging.requestPermission(alert: true, badge: true, sound: true);
      if (permission.authorizationStatus == AuthorizationStatus.denied) return false;
      final token = await messaging.getToken();
      if (token == null || token.isEmpty) return false;
      await api.registerPushToken(token, _platformName());
      _registeredToken = token;
      await _refreshSubscription?.cancel();
      _refreshSubscription = messaging.onTokenRefresh.listen((updated) async {
        try {
          await api.registerPushToken(updated, _platformName());
          _registeredToken = updated;
        } on ApiException {
          // The authenticated session may have expired; the next sign-in will retry.
        }
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> deactivate() async {
    await _refreshSubscription?.cancel();
    _refreshSubscription = null;
    try {
      final token = _registeredToken ?? (Firebase.apps.isNotEmpty ? await FirebaseMessaging.instance.getToken() : null);
      if (token != null && token.isNotEmpty) await api.unregisterPushToken(token);
    } catch (_) {
      // Signing out must still clear the local session if the network is down.
    }
    _registeredToken = null;
  }

  String _platformName() {
    if (kIsWeb) return 'web';
    return switch (defaultTargetPlatform) {
      TargetPlatform.iOS || TargetPlatform.macOS => 'ios',
      _ => 'android',
    };
  }
}
