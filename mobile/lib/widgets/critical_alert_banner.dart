import 'package:flutter/material.dart';
import '../models/incident.dart';
import '../theme/app_theme.dart';

class CriticalAlertBanner extends StatefulWidget {
  final List<Incident> criticalIncidents;
  final ValueChanged<Incident>? onAcknowledge;

  const CriticalAlertBanner({
    super.key,
    required this.criticalIncidents,
    this.onAcknowledge,
  });

  @override
  State<CriticalAlertBanner> createState() => _CriticalAlertBannerState();
}

class _CriticalAlertBannerState extends State<CriticalAlertBanner>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _animController, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.criticalIncidents.isEmpty) {
      return const SizedBox.shrink();
    }

    final topIncident = widget.criticalIncidents.first;

    return AnimatedBuilder(
      animation: _pulseAnimation,
      builder: (context, child) {
        return Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: AppColors.danger.withValues(alpha: 0.18 * _pulseAnimation.value),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: AppColors.danger.withValues(alpha: _pulseAnimation.value),
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: AppColors.danger.withValues(alpha: 0.25 * _pulseAnimation.value),
                blurRadius: 12 * _pulseAnimation.value,
                spreadRadius: 1,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(14.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                // Flashing Siren / Flame Icon
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.danger,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.danger.withValues(alpha: 0.6),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                  child: Icon(
                    _getHazardIcon(topIncident.hazardType),
                    color: Colors.white,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),

                // Text Description
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Row(
                        children: [
                          Text(
                            'EMERGENCY: ${topIncident.hazardType.displayName.toUpperCase()}',
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w900,
                              fontSize: 13,
                              letterSpacing: 0.5,
                            ),
                          ),
                          if (widget.criticalIncidents.length > 1) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.white24,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Text(
                                '+${widget.criticalIncidents.length - 1} more',
                                style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        topIncident.details ?? 'Critical hazard breach active on sensor node!',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontSize: 12,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),

                // Quick Ack Button
                if (topIncident.status == IncidentStatus.active) ...[
                  const SizedBox(width: 8),
                  ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.danger,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      minimumSize: const Size(60, 34),
                      elevation: 0,
                    ),
                    onPressed: () => widget.onAcknowledge?.call(topIncident),
                    child: const Text('ACK', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  IconData _getHazardIcon(HazardType type) {
    switch (type) {
      case HazardType.flame:
        return Icons.local_fire_department_rounded;
      case HazardType.gasLeak:
        return Icons.warning_rounded;
      case HazardType.smoke:
        return Icons.cloud_rounded;
      case HazardType.waterLeak:
        return Icons.water_drop_rounded;
      case HazardType.motion:
        return Icons.directions_run_rounded;
      default:
        return Icons.shield_rounded;
    }
  }
}
