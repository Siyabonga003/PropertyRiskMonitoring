import 'package:firebase_core/firebase_core.dart';

/// Supply the public Firebase application settings using --dart-define.
/// Example: flutter run --dart-define=FCM_API_KEY=... --dart-define=FCM_APP_ID=... etc.
class PropertyGuardFirebaseOptions {
  static const apiKey = String.fromEnvironment('FCM_API_KEY');
  static const appId = String.fromEnvironment('FCM_APP_ID');
  static const messagingSenderId = String.fromEnvironment('FCM_SENDER_ID');
  static const projectId = String.fromEnvironment('FCM_PROJECT_ID');
  static const iosBundleId = String.fromEnvironment('FCM_IOS_BUNDLE_ID');

  static bool get configured => apiKey.isNotEmpty && appId.isNotEmpty && messagingSenderId.isNotEmpty && projectId.isNotEmpty;

  static FirebaseOptions? get current => configured ? FirebaseOptions(
    apiKey: apiKey,
    appId: appId,
    messagingSenderId: messagingSenderId,
    projectId: projectId,
    iosBundleId: iosBundleId.isEmpty ? null : iosBundleId,
  ) : null;
}
