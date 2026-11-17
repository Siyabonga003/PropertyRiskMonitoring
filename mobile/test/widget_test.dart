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
    await tester.pump();

    expect(find.text('Sign In'), findsOneWidget);
    expect(find.text('Monitor. Detect. Stay Safe.'), findsOneWidget);
    await realtimeService.dispose();
  });
}
