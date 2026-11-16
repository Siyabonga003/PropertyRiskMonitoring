import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

enum SensorStatus { safe, warning, danger }

class SensorGaugeCard extends StatelessWidget {
  final String title;
  final String valueText;
  final String? unitText;
  final String statusText;
  final SensorStatus status;
  final IconData icon;
  final Color accentColor;
  final String subtitle;
  final double? progress; // 0.0 to 1.0

  const SensorGaugeCard({
    super.key,
    required this.title,
    required this.valueText,
    this.unitText,
    required this.statusText,
    required this.status,
    required this.icon,
    required this.accentColor,
    required this.subtitle,
    this.progress,
  });

  Color get _statusBadgeColor {
    switch (status) {
      case SensorStatus.safe:
        return AppColors.safe;
      case SensorStatus.warning:
        return AppColors.warning;
      case SensorStatus.danger:
        return AppColors.danger;
    }
  }

  Color get _statusBadgeBg {
    switch (status) {
      case SensorStatus.safe:
        return AppColors.safeBg;
      case SensorStatus.warning:
        return AppColors.warningBg;
      case SensorStatus.danger:
        return AppColors.dangerBg;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: status == SensorStatus.danger
              ? AppColors.danger.withValues(alpha: 0.6)
              : AppColors.border,
          width: status == SensorStatus.danger ? 1.5 : 1.0,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(14.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Top Row: Icon + Title + Status Chip
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(7),
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, color: accentColor, size: 18),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: _statusBadgeBg.withValues(alpha: 0.7),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: _statusBadgeColor.withValues(alpha: 0.4), width: 0.8),
                  ),
                  child: Text(
                    statusText.toUpperCase(),
                    style: TextStyle(
                      color: _statusBadgeColor,
                      fontSize: 9,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),

            // Value + Unit
            Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  valueText,
                  style: TextStyle(
                    color: status == SensorStatus.danger ? AppColors.danger : AppColors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.5,
                  ),
                ),
                if (unitText != null) ...[
                  const SizedBox(width: 4),
                  Text(
                    unitText!,
                    style: const TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),

            // Progress bar if present
            if (progress != null) ...[
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: progress!.clamp(0.0, 1.0),
                  minHeight: 4,
                  backgroundColor: AppColors.surfaceLight,
                  valueColor: AlwaysStoppedAnimation<Color>(
                    status == SensorStatus.danger
                        ? AppColors.danger
                        : status == SensorStatus.warning
                            ? AppColors.warning
                            : accentColor,
                  ),
                ),
              ),
            ],

            const SizedBox(height: 6),
            Text(
              subtitle,
              style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
