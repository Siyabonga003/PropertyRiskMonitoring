import 'package:flutter/material.dart';
import '../models/telemetry.dart';
import '../theme/app_theme.dart';

class ActuatorControlCard extends StatelessWidget {
  final Diagnostics? diagnostics;
  final bool isBuzzerActive;
  final bool isBusy;
  final VoidCallback onTriggerSiren;
  final VoidCallback onSilenceBuzzer;

  const ActuatorControlCard({
    super.key,
    this.diagnostics,
    this.isBuzzerActive = false,
    this.isBusy = false,
    required this.onTriggerSiren,
    required this.onSilenceBuzzer,
  });

  @override
  Widget build(BuildContext context) {
    final active = isBuzzerActive || (diagnostics?.buzzerActive == true);

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: active ? AppColors.danger : AppColors.border,
          width: active ? 1.5 : 1.0,
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(7),
                    decoration: BoxDecoration(
                      color: (active ? AppColors.danger : AppColors.secondary).withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(
                      active ? Icons.volume_up_rounded : Icons.sensors_rounded,
                      color: active ? AppColors.danger : AppColors.secondary,
                      size: 18,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'EDGE ACTUATOR & SIREN',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: active ? AppColors.dangerBg : AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  active ? 'SIREN ACTIVE' : 'STANDBY',
                  style: TextStyle(
                    color: active ? AppColors.danger : AppColors.safe,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Diagnostic stats chips
          if (diagnostics != null) ...[
            Row(
              children: [
                _buildStatChip(
                  icon: Icons.wifi_rounded,
                  label: '${diagnostics!.wifiRssi ?? -60} dBm',
                  sub: 'Signal',
                ),
                const SizedBox(width: 8),
                _buildStatChip(
                  icon: Icons.timer_outlined,
                  label: '${(diagnostics!.uptimeSeconds ?? 0) ~/ 60}m',
                  sub: 'Uptime',
                ),
                const SizedBox(width: 8),
                _buildStatChip(
                  icon: Icons.memory_rounded,
                  label: '${(diagnostics!.freeHeap ?? 180000) ~/ 1024} KB',
                  sub: 'Free Heap',
                ),
              ],
            ),
            const SizedBox(height: 14),
          ],

          // Actuator action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onPressed: isBusy ? null : onTriggerSiren,
                  icon: const Icon(Icons.volume_up_rounded, size: 16),
                  label: const Text('Test Siren', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: active ? AppColors.safe : AppColors.surfaceLight,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                  onPressed: isBusy ? null : onSilenceBuzzer,
                  icon: const Icon(Icons.volume_off_rounded, size: 16),
                  label: const Text('Silence Buzzer', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatChip({required IconData icon, required String label, required String sub}) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 8),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(icon, size: 14, color: AppColors.textMuted),
            const SizedBox(width: 6),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: AppColors.textPrimary,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  sub,
                  style: const TextStyle(
                    color: AppColors.textMuted,
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
