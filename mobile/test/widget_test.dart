import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/main.dart';
import 'package:mobile/services/api_service.dart';
import 'package:mobile/services/realtime_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    // flutter_secure_storage has no platform implementation in tests, so its
    // channel would never answer and session restore would hang forever.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      (call) async => null,
    );
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      const MethodChannel('plugins.it_nomads.com/flutter_secure_storage'),
      null,
    );
  });

  testWidgets('PropertyGuard opens on the sign-in screen', (WidgetTester tester) async {
    final apiService = ApiService(baseUrl: 'http://localhost:5000');
    final realtimeService = RealtimeService(apiService);

    await tester.pumpWidget(PropertyRiskApp(
      apiService: apiService,
      realtimeService: realtimeService,
    ));

    // Let session restore settle before asserting on the sign-in screen.
    for (var i = 0; i < 20 && !tester.any(find.text('Sign In')); i++) {
      await tester.pump(const Duration(milliseconds: 50));
    }

    expect(
      find.text('Sign In'),
      findsOneWidget,
      reason: 'Visible text: '
          '${tester.widgetList<Text>(find.byType(Text)).map((t) => t.data).toList()}',
    );
    expect(find.text('Monitor. Detect. Stay Safe.'), findsOneWidget);
    await realtimeService.dispose();
  });
}
