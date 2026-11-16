enum ArmingState {
  disarmed,
  armedHome,
  armedAway;

  static ArmingState fromString(String? val) {
    if (val == null) return ArmingState.disarmed;
    switch (val.toUpperCase()) {
      case 'ARMED_HOME':
        return ArmingState.armedHome;
      case 'ARMED_AWAY':
        return ArmingState.armedAway;
      case 'DISARMED':
      default:
        return ArmingState.disarmed;
    }
  }

  String toApiString() {
    switch (this) {
      case ArmingState.armedHome:
        return 'ARMED_HOME';
      case ArmingState.armedAway:
        return 'ARMED_AWAY';
      case ArmingState.disarmed:
        return 'DISARMED';
    }
  }

  String get label {
    switch (this) {
      case ArmingState.disarmed:
        return 'Disarmed';
      case ArmingState.armedHome:
        return 'Armed Home';
      case ArmingState.armedAway:
        return 'Armed Away';
    }
  }

  String get description {
    switch (this) {
      case ArmingState.disarmed:
        return 'Flame, gas & water monitored. Motion alarm disarmed.';
      case ArmingState.armedHome:
        return 'Perimeter protection active. Interior motion permitted.';
      case ArmingState.armedAway:
        return 'Full surveillance active. Immediate intrusion sirens enabled.';
    }
  }
}

class Property {
  final String id;
  final String name;
  final String? address;
  final ArmingState armingState;
  final List<Zone> zones;

  const Property({
    required this.id,
    required this.name,
    this.address,
    required this.armingState,
    this.zones = const [],
  });

  factory Property.fromJson(Map<String, dynamic> json) {
    var rawZones = json['zones'];
    List<Zone> parsedZones = [];
    if (rawZones is List) {
      parsedZones = rawZones.map((z) => Zone.fromJson(z as Map<String, dynamic>)).toList();
    }

    return Property(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'My Property',
      address: json['address']?.toString(),
      armingState: ArmingState.fromString(json['armingState']?.toString()),
      zones: parsedZones,
    );
  }

  Property copyWith({
    String? name,
    String? address,
    ArmingState? armingState,
    List<Zone>? zones,
  }) {
    return Property(
      id: id,
      name: name ?? this.name,
      address: address ?? this.address,
      armingState: armingState ?? this.armingState,
      zones: zones ?? this.zones,
    );
  }
}

class Zone {
  final String id;
  final String propertyId;
  final String name;
  final List<Device> devices;

  const Zone({
    required this.id,
    required this.propertyId,
    required this.name,
    this.devices = const [],
  });

  factory Zone.fromJson(Map<String, dynamic> json) {
    var rawDevices = json['devices'];
    List<Device> parsedDevices = [];
    if (rawDevices is List) {
      parsedDevices = rawDevices.map((d) => Device.fromJson(d as Map<String, dynamic>)).toList();
    }

    return Zone(
      id: json['id']?.toString() ?? '',
      propertyId: json['propertyId']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Default Zone',
      devices: parsedDevices,
    );
  }
}

class Device {
  final String id;
  final String name;
  final String zoneId;
  final bool isOnline;
  final DateTime? lastSeenAt;
  final String? firmwareVer;

  const Device({
    required this.id,
    required this.name,
    required this.zoneId,
    required this.isOnline,
    this.lastSeenAt,
    this.firmwareVer,
  });

  factory Device.fromJson(Map<String, dynamic> json) {
    return Device(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Sensor Node',
      zoneId: json['zoneId']?.toString() ?? '',
      isOnline: json['isOnline'] == true,
      lastSeenAt: json['lastSeenAt'] != null
          ? DateTime.tryParse(json['lastSeenAt'].toString())
          : null,
      firmwareVer: json['firmwareVer']?.toString(),
    );
  }
}
