import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/incident.dart';
import '../theme/app_theme.dart';

class IncidentCard extends StatelessWidget {
  final Incident incident;
  final ValueChanged<Incident>? onAcknowledge;
  final ValueChanged<Incident>? onResolve;

  const IncidentCard({
    super.key,
    required this.incident,
    this.onAcknowledge,
    this.onResolve,
  });

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, h:mm:ss a');
    final formattedTime = dateFormat.format(incident.startedAt.toLocal());

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: incident.status == IncidentStatus.active
              ? _getSeverityColor(incident.severity).withValues(alpha: 0.4)
              : AppColors.border,
        ),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Icon + Title + Severity Chip
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(7),
                decoration: BoxDecoration(
                  color: _getSeverityColor(incident.severity).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(
                  _getHazardIcon(incident.hazardType),
                  color: _getSeverityColor(incident.severity),
                  size: 16,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      incident.hazardType.displayName,
                      style: const TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      formattedTime,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 10),
                    ),
                  ],
                ),
              ),
              _buildSeverityChip(incident.severity),
              const SizedBox(width: 6),
              _buildStatusChip(incident.status),
            ],
          ),
          const SizedBox(height: 8),

          // Details
          if (incident.details != null && incident.details!.isNotEmpty) ...[
            Text(
              incident.details!,
              style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
            ),
            const SizedBox(height: 8),
          ],

          // Action buttons
          if (incident.status != IncidentStatus.resolved) ...[
            const Divider(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (incident.status == IncidentStatus.active) ...[
                  OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      minimumSize: const Size(60, 28),
                    ),
                    onPressed: () => onAcknowledge?.call(incident),
                    child: const Text('Acknowledge', style: TextStyle(fontSize: 11)),
                  ),
                  const SizedBox(width: 8),
                ],
                ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.safe,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                    minimumSize: const Size(60, 28),
                  ),
                  onPressed: () => onResolve?.call(incident),
                  child: const Text('Resolve', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildSeverityChip(IncidentSeverity sev) {
    final color = _getSeverityColor(sev);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        sev.name.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildStatusChip(IncidentStatus status) {
    Color color;
    switch (status) {
      case IncidentStatus.active:
        color = AppColors.danger;
        break;
      case IncidentStatus.acknowledged:
        color = AppColors.warning;
        break;
      case IncidentStatus.resolved:
        color = AppColors.safe;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.3), width: 0.8),
      ),
      child: Text(
        status.name.toUpperCase(),
        style: TextStyle(
          color: color,
          fontSize: 9,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }

  Color _getSeverityColor(IncidentSeverity sev) {
    switch (sev) {
      case IncidentSeverity.critical:
        return AppColors.danger;
      case IncidentSeverity.warning:
        return AppColors.warning;
      case IncidentSeverity.info:
        return AppColors.info;
    }
  }

  IconData _getHazardIcon(HazardType type) {
    switch (type) {
      case HazardType.flame:
        return Icons.local_fire_department_rounded;
      case HazardType.gasLeak:
        return Icons.warning_amber_rounded;
      case HazardType.smoke:
        return Icons.cloud_rounded;
      case HazardType.waterLeak:
        return Icons.water_drop_rounded;
      case HazardType.motion:
        return Icons.directions_run_rounded;
      case HazardType.highTemp:
        return Icons.thermostat_rounded;
      case HazardType.lowTemp:
        return Icons.ac_unit_rounded;
      case HazardType.deviceOffline:
        return Icons.cloud_off_rounded;
      default:
        return Icons.notifications_active_rounded;
    }
  }
}
