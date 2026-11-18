/// API endpoints for local Android emulator, physical devices, or deployment.
///
/// The default targets the Android emulator, where 10.0.2.2 is the host machine.
/// A physical phone needs the computer's LAN address instead, passed at build time:
///   flutter build apk --debug --dart-define=API_BASE_URL=http://192.168.1.20:5000
/// or for a run session:
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.20:5000
///
/// Do not edit the default below: it is what the emulator uses, and a hard-coded
/// LAN address stops working as soon as the network changes.
class ApiConfig {
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:5000',
  );

  // Kept separately so a Socket.IO deployment can be configured independently.
  // The current backend broadcasts globally and does not authenticate socket
  // joins, so the app uses the REST polling endpoints until that is secured.
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'http://10.0.2.2:5000',
  );

  static const Duration requestTimeout = Duration(seconds: 12);
  static const Duration refreshInterval = Duration(seconds: 5);
}
