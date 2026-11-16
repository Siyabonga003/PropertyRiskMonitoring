class SensorMetrics {
  final double? temperature;
  final double? humidity;
  final double? smokePpm;
  final double? gasPpm;
  final bool flameDetected;
  final bool waterDetected;
  final bool motionDetected;

  const SensorMetrics({
    this.temperature,
    this.humidity,
    this.smokePpm,
    this.gasPpm,
    this.flameDetected = false,
    this.waterDetected = false,
    this.motionDetected = false,
  });

  factory SensorMetrics.fromJson(Map<String, dynamic> json) {
    return SensorMetrics(
      temperature: (json['temperature'] as num?)?.toDouble(),
      humidity: (json['humidity'] as num?)?.toDouble(),
      smokePpm: (json['smoke_ppm'] as num?)?.toDouble() ?? (json['smokePpm'] as num?)?.toDouble(),
      gasPpm: (json['gas_ppm'] as num?)?.toDouble() ?? (json['gasPpm'] as num?)?.toDouble(),
      flameDetected: json['flame_detected'] == true || json['flameDetected'] == true,
      waterDetected: json['water_detected'] == true || json['waterDetected'] == true,
      motionDetected: json['motion_detected'] == true || json['motionDetected'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
    'temperature': temperature,
    'humidity': humidity,
    'smoke_ppm': smokePpm,
    'gas_ppm': gasPpm,
    'flame_detected': flameDetected,
    'water_detected': waterDetected,
    'motion_detected': motionDetected,
  };
}

class Diagnostics {
  final int? wifiRssi;
  final int? uptimeSeconds;
  final int? freeHeap;
  final bool buzzerActive;

  const Diagnostics({
    this.wifiRssi,
    this.uptimeSeconds,
    this.freeHeap,
    this.buzzerActive = false,
  });

  factory Diagnostics.fromJson(Map<String, dynamic> json) {
    return Diagnostics(
      wifiRssi: (json['wifi_rssi'] as num?)?.toInt() ?? (json['wifiRssi'] as num?)?.toInt(),
      uptimeSeconds: (json['uptime_seconds'] as num?)?.toInt(),
      freeHeap: (json['free_heap'] as num?)?.toInt(),
      buzzerActive: json['buzzer_active'] == true,
    );
  }
}

class TelemetryReading {
  final String? id;
  final String deviceId;
  final DateTime recordedAt;
  final SensorMetrics metrics;
  final Diagnostics? diagnostics;

  const TelemetryReading({
    this.id,
    required this.deviceId,
    required this.recordedAt,
    required this.metrics,
    this.diagnostics,
  });

  factory TelemetryReading.fromJson(Map<String, dynamic> json) {
    // Handles both flat REST DB responses and nested MQTT telemetry packets
    DateTime recordedDate;
    if (json['recordedAt'] != null) {
      recordedDate = DateTime.tryParse(json['recordedAt'].toString()) ?? DateTime.now();
    } else if (json['timestamp'] != null) {
      final ts = (json['timestamp'] as num).toInt();
      recordedDate = DateTime.fromMillisecondsSinceEpoch(ts > 10000000000 ? ts : ts * 1000);
    } else {
      recordedDate = DateTime.now();
    }

    final rawMetrics = json['metrics'] is Map<String, dynamic>
        ? json['metrics'] as Map<String, dynamic>
        : json;

    final rawDiag = json['diagnostics'] is Map<String, dynamic>
        ? json['diagnostics'] as Map<String, dynamic>
        : json;

    return TelemetryReading(
      id: json['id']?.toString(),
      deviceId: json['deviceId']?.toString() ?? 'ESP32_A1B2C3',
      recordedAt: recordedDate,
      metrics: SensorMetrics.fromJson(rawMetrics),
      diagnostics: Diagnostics.fromJson(rawDiag),
    );
  }
}
