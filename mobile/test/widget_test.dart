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
    // Session restore talks to secure storage and the network; give those
    // futures a chance to settle before asserting on the sign-in screen.
    for (var i = 0; i < 40 && !tester.any(find.text('Sign In')); i++) {
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
