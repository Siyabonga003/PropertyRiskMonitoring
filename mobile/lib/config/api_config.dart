/// API endpoints for local Android emulator, physical devices, or deployment.
/// Override at build time with:
/// flutter run --dart-define=API_BASE_URL=https://api.example.com
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
