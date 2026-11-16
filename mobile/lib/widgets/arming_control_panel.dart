import 'package:flutter/material.dart';
import '../models/property.dart';
import '../theme/app_theme.dart';

class ArmingControlPanel extends StatelessWidget {
  final ArmingState currentState;
  final bool isLoading;
  final ValueChanged<ArmingState> onStateSelected;

  const ArmingControlPanel({
    super.key,
    required this.currentState,
    this.isLoading = false,
    required this.onStateSelected,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
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
                  Icon(
                    _getArmingIcon(currentState),
                    color: _getArmingColor(currentState),
                    size: 20,
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'SECURITY ARMING MODE',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                    ),
                  ),
                ],
              ),
              if (isLoading)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _getArmingColor(currentState).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: _getArmingColor(currentState).withValues(alpha: 0.5)),
                  ),
                  child: Text(
                    currentState.label.toUpperCase(),
                    style: TextStyle(
                      color: _getArmingColor(currentState),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            currentState.description,
            style: const TextStyle(color: AppColors.textMuted, fontSize: 11),
          ),
          const SizedBox(height: 14),

          // 3-way mode selector
          Row(
            children: [
              Expanded(
                child: _buildModeButton(
                  context,
                  state: ArmingState.disarmed,
                  label: 'Disarmed',
                  icon: Icons.lock_open_rounded,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildModeButton(
                  context,
                  state: ArmingState.armedHome,
                  label: 'Armed Home',
                  icon: Icons.night_shelter_rounded,
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: _buildModeButton(
                  context,
                  state: ArmingState.armedAway,
                  label: 'Armed Away',
                  icon: Icons.security_rounded,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildModeButton(
    BuildContext context, {
    required ArmingState state,
    required String label,
    required IconData icon,
  }) {
    final isSelected = currentState == state;
    final color = _getArmingColor(state);

    return InkWell(
      onTap: isLoading ? null : () => onStateSelected(state),
      borderRadius: BorderRadius.circular(10),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 6),
        decoration: BoxDecoration(
          color: isSelected ? color.withValues(alpha: 0.15) : AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: isSelected ? color : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 18,
              color: isSelected ? color : AppColors.textSecondary,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : AppColors.textSecondary,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }

  IconData _getArmingIcon(ArmingState state) {
    switch (state) {
      case ArmingState.disarmed:
        return Icons.lock_open_rounded;
      case ArmingState.armedHome:
        return Icons.night_shelter_rounded;
      case ArmingState.armedAway:
        return Icons.security_rounded;
    }
  }

  Color _getArmingColor(ArmingState state) {
    switch (state) {
      case ArmingState.disarmed:
        return AppColors.textSecondary;
      case ArmingState.armedHome:
        return AppColors.primary;
      case ArmingState.armedAway:
        return AppColors.danger;
    }
  }
}
