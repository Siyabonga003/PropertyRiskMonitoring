import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/services/api_service.dart';
import 'package:mobile/services/realtime_service.dart';

void main() {
  testWidgets('PropertyRiskApp loads and renders title', (WidgetTester tester) async {
    final apiService = ApiService(baseUrl: 'http://localhost:5000');
    final realtimeService = RealtimeService(api: apiService);

    await tester.pumpWidget(PropertyRiskApp(
      apiService: apiService,
      realtimeService: realtimeService,
    ));

    // Verify app renders with Property Risk Monitor
    expect(find.text('MULTI-HAZARD SENSOR TELEMETRY'), findsOneWidget);
    expect(find.text('SECURITY ARMING MODE'), findsOneWidget);

    realtimeService.dispose();
  });
}
