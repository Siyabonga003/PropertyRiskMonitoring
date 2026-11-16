enum HazardType {
  smoke,
  flame,
  gasLeak,
  waterLeak,
  highTemp,
  lowTemp,
  motion,
  deviceOffline,
  unknown;

  static HazardType fromString(String? val) {
    if (val == null) return HazardType.unknown;
    final upper = val.toUpperCase();
    if (upper.contains('FLAME') || upper.contains('FIRE')) return HazardType.flame;
    if (upper.contains('GAS') || upper.contains('LPG')) return HazardType.gasLeak;
    if (upper.contains('SMOKE')) return HazardType.smoke;
    if (upper.contains('WATER') || upper.contains('LEAK')) return HazardType.waterLeak;
    if (upper.contains('MOTION') || upper.contains('PIR')) return HazardType.motion;
    if (upper.contains('TEMP_HIGH') || upper.contains('HIGH_TEMP')) return HazardType.highTemp;
    if (upper.contains('TEMP_LOW') || upper.contains('LOW_TEMP')) return HazardType.lowTemp;
    if (upper.contains('OFFLINE')) return HazardType.deviceOffline;
    return HazardType.unknown;
  }

  String get displayName {
    switch (this) {
      case HazardType.flame:
        return 'Open Flame';
      case HazardType.gasLeak:
        return 'Combustible Gas Leak';
      case HazardType.smoke:
        return 'Smoke Detected';
      case HazardType.waterLeak:
        return 'Water Leak';
      case HazardType.motion:
        return 'Unauthorized Motion';
      case HazardType.highTemp:
        return 'High Temperature';
      case HazardType.lowTemp:
        return 'Freezing Risk';
      case HazardType.deviceOffline:
        return 'Device Offline';
      case HazardType.unknown:
        return 'Hazard Alert';
    }
  }
}

enum IncidentSeverity {
  info,
  warning,
  critical;

  static IncidentSeverity fromString(String? val) {
    if (val == null) return IncidentSeverity.warning;
    switch (val.toUpperCase()) {
      case 'CRITICAL':
        return IncidentSeverity.critical;
      case 'INFO':
        return IncidentSeverity.info;
      case 'WARNING':
      default:
        return IncidentSeverity.warning;
    }
  }
}

enum IncidentStatus {
  active,
  acknowledged,
  resolved;

  static IncidentStatus fromString(String? val) {
    if (val == null) return IncidentStatus.active;
    switch (val.toUpperCase()) {
      case 'ACKNOWLEDGED':
        return IncidentStatus.acknowledged;
      case 'RESOLVED':
        return IncidentStatus.resolved;
      case 'ACTIVE':
      default:
        return IncidentStatus.active;
    }
  }
}

class Incident {
  final String id;
  final String propertyId;
  final String deviceId;
  final HazardType hazardType;
  final IncidentSeverity severity;
  final IncidentStatus status;
  final double? readingValue;
  final String? details;
  final DateTime startedAt;
  final DateTime? acknowledgedAt;
  final String? acknowledgedBy;
  final DateTime? resolvedAt;

  const Incident({
    required this.id,
    required this.propertyId,
    required this.deviceId,
    required this.hazardType,
    required this.severity,
    required this.status,
    this.readingValue,
    this.details,
    required this.startedAt,
    this.acknowledgedAt,
    this.acknowledgedBy,
    this.resolvedAt,
  });

  factory Incident.fromJson(Map<String, dynamic> json) {
    return Incident(
      id: json['id']?.toString() ?? '',
      propertyId: json['propertyId']?.toString() ?? '',
      deviceId: json['deviceId']?.toString() ?? '',
      hazardType: HazardType.fromString(json['hazardType']?.toString()),
      severity: IncidentSeverity.fromString(json['severity']?.toString()),
      status: IncidentStatus.fromString(json['status']?.toString()),
      readingValue: (json['readingValue'] as num?)?.toDouble() ?? (json['value'] as num?)?.toDouble(),
      details: json['details']?.toString() ?? json['message']?.toString(),
      startedAt: json['startedAt'] != null
          ? DateTime.tryParse(json['startedAt'].toString()) ?? DateTime.now()
          : DateTime.now(),
      acknowledgedAt: json['acknowledgedAt'] != null
          ? DateTime.tryParse(json['acknowledgedAt'].toString())
          : null,
      acknowledgedBy: json['acknowledgedBy']?.toString(),
      resolvedAt: json['resolvedAt'] != null
          ? DateTime.tryParse(json['resolvedAt'].toString())
          : null,
    );
  }

  Incident copyWith({
    IncidentStatus? status,
    DateTime? acknowledgedAt,
    DateTime? resolvedAt,
  }) {
    return Incident(
      id: id,
      propertyId: propertyId,
      deviceId: deviceId,
      hazardType: hazardType,
      severity: severity,
      status: status ?? this.status,
      readingValue: readingValue,
      details: details,
      startedAt: startedAt,
      acknowledgedAt: acknowledgedAt ?? this.acknowledgedAt,
      acknowledgedBy: acknowledgedBy,
      resolvedAt: resolvedAt ?? this.resolvedAt,
    );
  }
}
