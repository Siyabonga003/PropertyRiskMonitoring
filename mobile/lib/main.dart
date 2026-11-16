import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'services/api_service.dart';
import 'services/realtime_service.dart';
import 'screens/dashboard_screen.dart';
import 'theme/app_theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();

  // Set immersive dark system UI overlay
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.background,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  final apiService = ApiService();
  final realtimeService = RealtimeService(api: apiService);

  runApp(PropertyRiskApp(
    apiService: apiService,
    realtimeService: realtimeService,
  ));
}

class PropertyRiskApp extends StatelessWidget {
  final ApiService apiService;
  final RealtimeService realtimeService;

  const PropertyRiskApp({
    super.key,
    required this.apiService,
    required this.realtimeService,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Property Risk Monitoring System',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.darkTheme,
      home: DashboardScreen(
        apiService: apiService,
        realtimeService: realtimeService,
      ),
    );
  }
}
