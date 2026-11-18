import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/services/api_service.dart';
import 'package:mobile/services/realtime_service.dart';

void main() {
  testWidgets('PropertyGuard opens on the sign-in screen', (WidgetTester tester) async {
    final apiService = ApiService(baseUrl: 'http://localhost:5000');
    final realtimeService = RealtimeService(apiService);

    await tester.pumpWidget(PropertyRiskApp(
      apiService: apiService,
      realtimeService: realtimeService,
    ));
    // Session restore touches secure storage, which is unavailable in tests;
    // pump a couple of frames so it fails fast and the sign-in screen renders.
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Monitor. Detect. Stay Safe.'), findsOneWidget);
    await realtimeService.dispose();
  });
}
