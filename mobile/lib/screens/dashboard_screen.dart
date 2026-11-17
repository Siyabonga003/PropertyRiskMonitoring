import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:google_fonts/google_fonts.dart';

import '../models/incident.dart';
import '../services/api_service.dart';
import '../services/realtime_service.dart';
import '../services/fcm_registration_service.dart';
import '../theme/app_theme.dart';

class DashboardScreen extends StatefulWidget {
  final ApiService apiService;
  final RealtimeService realtimeService;
  const DashboardScreen({super.key, required this.apiService, required this.realtimeService});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  Map<String, dynamic>? _user;
  MonitoringSnapshot? _snapshot;
  StreamSubscription<MonitoringSnapshot>? _subscription;
  StreamSubscription<String>? _errorSubscription;
  late final FcmRegistrationService _fcm;
  bool _loading = true;
  String? _error;
  int _tab = 0;
  String? _propertyId;
  bool _notifications = false;

  bool get _owner => _role == 'PROPERTY_OWNER';
  String get _role => (_user?['role'] ?? '').toString().toUpperCase();
  Map<String, dynamic>? get _property {
    final rows = _snapshot?.properties ?? const <Map<String, dynamic>>[];
    for (final row in rows) {
      if (row['id']?.toString() == _propertyId) return row;
    }
    return rows.isEmpty ? null : rows.first;
  }

  @override
  void initState() {
    super.initState();
    _fcm = FcmRegistrationService(widget.apiService);
    _subscription = widget.realtimeService.snapshots.listen((value) {
      if (!mounted) return;
      setState(() {
        _snapshot = value;
        _error = null;
        _propertyId ??= value.properties.isNotEmpty ? value.properties.first['id']?.toString() : null;
      });
    });
    _errorSubscription = widget.realtimeService.errors.listen((message) {
      if (!mounted) return;
      if (message.toLowerCase().contains('session has expired')) { _signOut(); return; }
      setState(() => _error = message);
    });
    _restoreSession();
  }

  Future<void> _restoreSession() async {
    try {
      _notifications = await widget.apiService.notificationPreference();
      final token = await widget.apiService.token;
      if (token != null) {
        _user = await widget.apiService.me();
        await widget.realtimeService.start();
        final fcmReady = await _fcm.activate();
        _notifications = fcmReady;
        await widget.apiService.updateNotificationPreference(fcmReady);
      }
    } on ApiException catch (e) {
      _error = e.message;
    } catch (_) {
      _error = 'Unable to restore your session.';
    }
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _signedIn(Map<String, dynamic> user) async {
    setState(() { _user = user; _error = null; _loading = true; });
    try {
      await widget.realtimeService.start();
      final fcmReady = await _fcm.activate();
      _notifications = fcmReady;
      await widget.apiService.updateNotificationPreference(fcmReady);
      if (mounted) setState(() => _loading = false);
    } on ApiException catch (e) {
      if (mounted) setState(() { _loading = false; _error = e.message; });
    }
  }

  Future<void> _signOut() async {
    await _fcm.deactivate();
    await widget.apiService.clearSession();
    widget.realtimeService.stop();
    if (mounted) setState(() { _user = null; _snapshot = null; _tab = 0; });
  }

  Future<void> _acknowledge(Map<String, dynamic> item) async {
    try {
      final updated = await widget.apiService.acknowledge(item['id'].toString());
      setState(() {
        final incidents = List<Map<String, dynamic>>.from(_snapshot?.incidents ?? const []);
        final i = incidents.indexWhere((x) => x['id'] == item['id']);
        if (i >= 0) incidents[i] = updated;
        final old = _snapshot;
        if (old != null) _snapshot = MonitoringSnapshot(properties: old.properties, devices: old.devices, incidents: incidents, zonesByProperty: old.zonesByProperty, readings: old.readings, updatedAt: DateTime.now());
      });
      await widget.realtimeService.refresh();
    } on ApiException catch (e) { _toast(e.message); }
  }

  Future<void> _setNotifications(bool enabled) async {
    if (enabled) {
      final registered = await _fcm.activate();
      if (!registered) {
        if (mounted) _toast('Set up Firebase for this app and allow notifications to enable push alerts.');
        return;
      }
    } else {
      await _fcm.deactivate();
    }
    await widget.apiService.updateNotificationPreference(enabled);
    if (mounted) setState(() => _notifications = enabled);
  }

  void _toast(String message) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), backgroundColor: AppColors.surfaceRaised));

  @override
  void dispose() { _subscription?.cancel(); _errorSubscription?.cancel(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const _LoadingScreen();
    if (_user == null) return _AuthScreen(api: widget.apiService, error: _error, onSuccess: _signedIn);
    if (_snapshot == null && _error != null) {
      return _Shell(tab: _tab, onTab: (v) => setState(() => _tab = v),
        child: _ErrorState(message: _error!, retry: () => widget.realtimeService.start()));
    }
    final pages = [
      _HomePage(user: _user!, snapshot: _snapshot, error: _error, property: _property, onSelectProperty: (id) => setState(() => _propertyId = id), onViewSensors: () => _push(_SensorsPage(snapshot: _snapshot, property: _property)), onOpenPair: _owner ? () => _push(_PairPage(api: widget.apiService, properties: _snapshot?.properties ?? const [])) : null, onAck: _acknowledge, onRefresh: widget.realtimeService.refresh),
      _AlertsPage(incidents: _snapshot?.incidents ?? const [], properties: _snapshot?.properties ?? const [], onAck: _acknowledge),
      _SettingsPage(user: _user!, owner: _owner, onSignOut: _signOut, onManageAccess: () => _push(_AccessPage(api: widget.apiService, property: _property, owner: _owner)), onAddProperty: _owner ? () => _addProperty() : null, notifications: _notifications, onNotifications: _setNotifications),
    ];
    return _Shell(tab: _tab, onTab: (v) => setState(() => _tab = v), child: pages[_tab]);
  }

  void _push(Widget page) => Navigator.of(context).push(MaterialPageRoute(builder: (_) => page));

  Future<void> _addProperty() async {
    final name = TextEditingController();
    final address = TextEditingController();
    final result = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(
      backgroundColor: AppColors.surface,
      title: const Text('Add property'),
      content: Column(mainAxisSize: MainAxisSize.min, children: [TextField(controller: name, decoration: const InputDecoration(labelText: 'Property name')), const SizedBox(height: 12), TextField(controller: address, decoration: const InputDecoration(labelText: 'Address'))]),
      actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create'))],
    ));
    if (result != true || name.text.trim().isEmpty) return;
    try { await widget.apiService.createProperty(name: name.text.trim(), address: address.text.trim()); await widget.realtimeService.refresh(); }
    on ApiException catch (e) { _toast(e.message); }
  }
}

class _LoadingScreen extends StatelessWidget { const _LoadingScreen(); @override Widget build(BuildContext context) => const Scaffold(body: Center(child: CircularProgressIndicator(color: AppColors.primary))); }

class _Shell extends StatelessWidget {
  final int tab; final ValueChanged<int> onTab; final Widget child;
  const _Shell({required this.tab, required this.onTab, required this.child});
  @override Widget build(BuildContext context) => Scaffold(
    body: SafeArea(child: child),
    bottomNavigationBar: Container(decoration: const BoxDecoration(color: AppColors.background, border: Border(top: BorderSide(color: AppColors.border))), padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom), child: Row(children: List.generate(3, (i) {
      final label = ['Home', 'Alerts', 'Settings'][i];
      return Expanded(child: InkWell(onTap: () => onTab(i), child: SizedBox(height: 58, child: Center(child: Text(label, style: TextStyle(color: tab == i ? AppColors.primary : AppColors.muted, fontSize: 14, fontWeight: tab == i ? FontWeight.w600 : FontWeight.w400))))));
    }))),
  );
}

class _AuthScreen extends StatefulWidget {
  final ApiService api; final String? error; final ValueChanged<Map<String, dynamic>> onSuccess;
  const _AuthScreen({required this.api, required this.error, required this.onSuccess});
  @override State<_AuthScreen> createState() => _AuthScreenState();
}
class _AuthScreenState extends State<_AuthScreen> {
  final _form = GlobalKey<FormState>(); final _name = TextEditingController(); final _email = TextEditingController(); final _password = TextEditingController();
  bool _register = false, _busy = false; String? _error;
  @override Widget build(BuildContext context) => Scaffold(body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 440), child: Form(key: _form, child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
    const SizedBox(height: 34), RichText(textAlign: TextAlign.center, text: TextSpan(style: GoogleFonts.inter(fontSize: 31, fontWeight: FontWeight.w700, letterSpacing: -1), children: const [TextSpan(text: 'Property', style: TextStyle(color: AppColors.textPrimary)), TextSpan(text: 'Guard', style: TextStyle(color: AppColors.primary))])),
    const SizedBox(height: 10), const Text('Monitor. Detect. Stay Safe.', textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 15)),
    const SizedBox(height: 58), Text(_register ? 'Create your account' : 'Welcome back', style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w600)), const SizedBox(height: 9), const Text('Secure and reliable property monitoring.', style: TextStyle(color: AppColors.textSecondary, fontSize: 14)), const SizedBox(height: 28),
    if (_register) ...[TextFormField(controller: _name, textCapitalization: TextCapitalization.words, decoration: const InputDecoration(labelText: 'Full name'), validator: (v) => (v ?? '').trim().length < 2 ? 'Enter your name' : null), const SizedBox(height: 14)],
    TextFormField(controller: _email, keyboardType: TextInputType.emailAddress, autofillHints: const [AutofillHints.email], decoration: const InputDecoration(labelText: 'Email address'), validator: (v) => (v ?? '').contains('@') ? null : 'Enter a valid email address'), const SizedBox(height: 14),
    TextFormField(controller: _password, obscureText: true, autofillHints: const [AutofillHints.password], decoration: const InputDecoration(labelText: 'Password'), validator: (v) => (v ?? '').length < (_register ? 8 : 1) ? (_register ? 'Password must be at least 8 characters' : 'Enter your password') : null), const SizedBox(height: 22),
    if (_error != null || widget.error != null) ...[Text(_error ?? widget.error!, style: const TextStyle(color: AppColors.danger, fontSize: 13)), const SizedBox(height: 12)],
    ElevatedButton(onPressed: _busy ? null : _submit, child: _busy ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.background)) : Text(_register ? 'Create Account' : 'Sign In')),
    const SizedBox(height: 16), TextButton(onPressed: _busy ? null : () => setState(() { _register = !_register; _error = null; }), child: Text(_register ? 'Already have an account? Sign in' : 'Create an account')),
  ])))))));
  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    setState(() { _busy = true; _error = null; });
    try { final user = _register ? await widget.api.register(_name.text.trim(), _email.text.trim(), _password.text) : await widget.api.signIn(_email.text.trim(), _password.text); widget.onSuccess(user); }
    on ApiException catch (e) { setState(() => _error = e.message); }
    catch (_) { setState(() => _error = 'Sign-in could not be completed. Please try again.'); }
    finally { if (mounted) setState(() => _busy = false); }
  }
}

class _HomePage extends StatelessWidget {
  final Map<String, dynamic> user; final MonitoringSnapshot? snapshot; final String? error; final Map<String, dynamic>? property; final ValueChanged<String> onSelectProperty; final VoidCallback onViewSensors; final VoidCallback? onOpenPair; final Future<void> Function(Map<String, dynamic>) onAck; final Future<void> Function() onRefresh;
  const _HomePage({required this.user, required this.snapshot, required this.error, required this.property, required this.onSelectProperty, required this.onViewSensors, required this.onOpenPair, required this.onAck, required this.onRefresh});
  @override Widget build(BuildContext context) {
    final props = snapshot?.properties ?? const <Map<String, dynamic>>[]; final devices = _propertyDevices(snapshot, property); final incidents = (snapshot?.incidents ?? const <Map<String, dynamic>>[]).where((a) => a['propertyId']?.toString() == property?['id']?.toString() && a['status']?.toString() == 'ACTIVE').toList();
    final critical = incidents.any((a) => a['severity'] == 'CRITICAL'); final warning = incidents.isNotEmpty; final status = critical ? 'CRITICAL_HAZARD' : warning ? 'WARNING' : 'SAFE'; final statusColor = critical ? AppColors.danger : warning ? AppColors.warning : AppColors.primary;
    return RefreshIndicator(color: AppColors.primary, onRefresh: onRefresh, child: ListView(padding: const EdgeInsets.fromLTRB(20, 20, 20, 30), children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Hello, ${_firstName(user['name']?.toString())}', style: const TextStyle(fontSize: 25, fontWeight: FontWeight.w600)), const SizedBox(height: 4), Text('${user['name'] ?? ''}  ·  ${user['role'] ?? 'Account'}', style: const TextStyle(fontSize: 13, color: AppColors.textSecondary))])), const Text('PROPERTYGUARD', style: TextStyle(fontSize: 10, letterSpacing: 1.4, color: AppColors.muted, fontWeight: FontWeight.w600))]),
      if (error != null) ...[const SizedBox(height: 14), Text(error!, style: const TextStyle(color: AppColors.warning, fontSize: 12))],
      const SizedBox(height: 22),
      if (props.isNotEmpty) DropdownButtonFormField<String>(value: props.any((p) => p['id'].toString() == property?['id']?.toString()) ? property?['id']?.toString() : props.first['id'].toString(), dropdownColor: AppColors.surface, decoration: const InputDecoration(labelText: 'Selected property'), items: props.map((p) => DropdownMenuItem(value: p['id'].toString(), child: Text(p['name']?.toString() ?? 'Property', overflow: TextOverflow.ellipsis))).toList(), onChanged: (v) { if (v != null) onSelectProperty(v); }),
      if (property != null) Padding(padding: const EdgeInsets.only(top: 10), child: Text('${property!['address'] ?? 'Address not provided'}  ·  ${devices.where((d) => d['isOnline'] == true).length}/${devices.length} Online', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))),
      const SizedBox(height: 20),
      _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [const Text('PROPERTY STATUS', style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)), const SizedBox(height: 15), Row(children: [_StatusDot(color: statusColor), const SizedBox(width: 9), Expanded(child: Text(status, style: TextStyle(color: statusColor, fontSize: 21, fontWeight: FontWeight.w700, letterSpacing: .4)))]), const SizedBox(height: 9), Text(critical ? 'Immediate attention required' : warning ? 'An active hazard needs review' : 'All systems operating normally', style: const TextStyle(color: AppColors.textSecondary, fontSize: 14))])),
      if (incidents.isNotEmpty) ...[const SizedBox(height: 14), _ActiveAlert(item: incidents.first, onAck: () => onAck(incidents.first))],
      const SizedBox(height: 26), Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Sensors Overview', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600)), TextButton(onPressed: onViewSensors, child: const Text('View All'))]), const SizedBox(height: 10),
      if (devices.isEmpty) _EmptyState(title: 'No sensors connected', message: 'Paired devices will appear here when available.') else ...devices.take(3).map((d) => Padding(padding: const EdgeInsets.only(bottom: 11), child: _DeviceOverviewCard(device: d, reading: snapshot?.readings[d['id']?.toString()]))),
      if (devices.length > 3) TextButton(onPressed: onViewSensors, child: Text('View ${devices.length - 3} more devices')),
      if (snapshot == null) const Padding(padding: EdgeInsets.only(top: 24), child: Center(child: CircularProgressIndicator(color: AppColors.primary))),
      if (onOpenPair != null) ...[const SizedBox(height: 12), OutlinedButton(onPressed: onOpenPair, child: const Text('Pair a device'))],
    ]));
  }
}

class _SensorsPage extends StatelessWidget {
  final MonitoringSnapshot? snapshot; final Map<String, dynamic>? property;
  const _SensorsPage({required this.snapshot, required this.property});
  @override Widget build(BuildContext context) {
    final devices = _propertyDevices(snapshot, property);
    return Scaffold(appBar: AppBar(title: const Text('Sensors')), body: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 28), children: [Text(property?['name']?.toString() ?? 'All paired devices', style: const TextStyle(color: AppColors.textSecondary)), const SizedBox(height: 18), if (devices.isEmpty) const _EmptyState(title: 'No paired devices', message: 'Device telemetry will appear when sensors are connected.') else ...devices.map((d) => Padding(padding: const EdgeInsets.only(bottom: 14), child: _DetailedDeviceCard(device: d, reading: snapshot?.readings[d['id']?.toString()])))]));
  }
}

class _AlertsPage extends StatefulWidget {
  final List<Map<String, dynamic>> incidents; final List<Map<String, dynamic>> properties; final Future<void> Function(Map<String, dynamic>) onAck;
  const _AlertsPage({required this.incidents, required this.properties, required this.onAck});
  @override State<_AlertsPage> createState() => _AlertsPageState();
}
class _AlertsPageState extends State<_AlertsPage> {
  String _filter = 'All'; String? _property;
  @override Widget build(BuildContext context) {
    final rows = widget.incidents.where((item) {
      final severity = item['severity']?.toString(); final status = item['status']?.toString();
      final matchesSeverity = _filter == 'All' || (_filter == 'Warning' ? severity == 'WARNING' : severity == 'CRITICAL');
      return matchesSeverity && (_property == null || item['propertyId']?.toString() == _property);
    }).toList()..sort((a,b) => _date(b['startedAt']).compareTo(_date(a['startedAt'])));
    return ListView(padding: const EdgeInsets.fromLTRB(20, 22, 20, 28), children: [const Text('Alerts', style: TextStyle(fontSize: 27, fontWeight: FontWeight.w600)), const SizedBox(height: 8), const Text('Incident history across your monitored properties.', style: TextStyle(color: AppColors.textSecondary)), const SizedBox(height: 20),
      Wrap(spacing: 8, children: ['All', 'Warning', 'Critical'].map((x) => ChoiceChip(label: Text(x), selected: _filter == x, onSelected: (_) => setState(() => _filter = x), selectedColor: AppColors.primary.withValues(alpha: .18), backgroundColor: AppColors.surface, side: BorderSide(color: _filter == x ? AppColors.primary : AppColors.border), labelStyle: TextStyle(color: _filter == x ? AppColors.primary : AppColors.textSecondary))).toList()),
      if (widget.properties.length > 1) ...[const SizedBox(height: 14), DropdownButtonFormField<String?>(value: _property, decoration: const InputDecoration(labelText: 'Filter by property'), items: [const DropdownMenuItem<String?>(value: null, child: Text('All properties')), ...widget.properties.map((p) => DropdownMenuItem<String?>(value: p['id']?.toString(), child: Text(p['name']?.toString() ?? 'Property')))], onChanged: (v) => setState(() => _property = v))],
      const SizedBox(height: 18), if (rows.isEmpty) const _EmptyState(title: 'No matching alerts', message: 'New incidents will be listed here in chronological order.') else ...rows.map((item) => _IncidentRow(item: item, properties: widget.properties, onAck: () => widget.onAck(item))),
    ]);
  }
}

class _PairPage extends StatefulWidget {
  final ApiService api; final List<Map<String, dynamic>> properties;
  const _PairPage({required this.api, required this.properties});
  @override State<_PairPage> createState() => _PairPageState();
}
class _PairPageState extends State<_PairPage> {
  final _token = TextEditingController(); String? _propertyId; bool _busy = false;
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Pair Device')), body: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 28), children: [
    Container(height: 220, clipBehavior: Clip.antiAlias, decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)), child: Stack(children: [Positioned.fill(child: MobileScanner(onDetect: _capture)), const _Corner(top: true, left: true), const _Corner(top: true, left: false), const _Corner(top: false, left: true), const _Corner(top: false, left: false)])),
    const SizedBox(height: 13), const Text("Scan the device's pairing QR code.", textAlign: TextAlign.center, style: TextStyle(color: AppColors.textSecondary, fontSize: 14)), const SizedBox(height: 24), const Row(children: [Expanded(child: Divider()), Padding(padding: EdgeInsets.symmetric(horizontal: 14), child: Text('OR', style: TextStyle(color: AppColors.muted, fontSize: 12))), Expanded(child: Divider())]), const SizedBox(height: 22), TextField(controller: _token, decoration: const InputDecoration(labelText: 'Pairing Token')), const SizedBox(height: 14),
    DropdownButtonFormField<String>(value: _propertyId, decoration: const InputDecoration(labelText: 'Target property'), items: widget.properties.map((p) => DropdownMenuItem(value: p['id']?.toString(), child: Text(p['name']?.toString() ?? 'Property'))).toList(), onChanged: (v) => setState(() => _propertyId = v)), const SizedBox(height: 20), ElevatedButton(onPressed: _busy ? null : _pair, child: Text(_busy ? 'Pairing…' : 'Pair Device')),
    const SizedBox(height: 14), const Text('The QR pairing token is single-use and expires after 48 hours.', style: TextStyle(color: AppColors.muted, fontSize: 12, height: 1.5)),
  ]));
  void _capture(BarcodeCapture capture) {
    if (_token.text.isNotEmpty || capture.barcodes.isEmpty) return;
    final raw = capture.barcodes.first.rawValue;
    if (raw == null || raw.isEmpty) return;
    var pairingToken = raw;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is Map && decoded['pairingToken'] != null) {
        pairingToken = decoded['pairingToken'].toString();
      }
    } catch (_) {
      // A plain-text QR payload is also accepted as the pairing token.
    }
    setState(() => _token.text = pairingToken);
    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Pairing token scanned.')));
  }

  Future<void> _pair() async {
    if (_token.text.trim().isEmpty || _propertyId == null) { ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a pairing token and select a property.'))); return; }
    setState(() => _busy = true);
    try {
      final result = await widget.api.claimDevice(pairingToken: _token.text.trim(), propertyId: _propertyId!);
      if (!mounted) return;
      final device = result['device'] is Map ? Map<String, dynamic>.from(result['device'] as Map) : const <String, dynamic>{};
      await showDialog<void>(context: context, builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Device paired'),
        content: Text('${device['name'] ?? device['id'] ?? 'Your device'} is now connected to the selected property.'),
        actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Done'))],
      ));
      if (mounted) Navigator.pop(context);
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.surfaceRaised));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _Corner extends StatelessWidget {
  final bool top; final bool left; const _Corner({required this.top, required this.left});
  @override Widget build(BuildContext context) => Positioned(top: top ? 17 : null, bottom: top ? null : 17, left: left ? 17 : null, right: left ? null : 17, child: SizedBox(width: 27, height: 27, child: DecoratedBox(decoration: BoxDecoration(border: Border(top: top ? const BorderSide(color: AppColors.primary, width: 2) : BorderSide.none, bottom: top ? BorderSide.none : const BorderSide(color: AppColors.primary, width: 2), left: left ? const BorderSide(color: AppColors.primary, width: 2) : BorderSide.none, right: left ? BorderSide.none : const BorderSide(color: AppColors.primary, width: 2))))));
}

class _AccessPage extends StatefulWidget {
  final ApiService api; final Map<String, dynamic>? property; final bool owner;
  const _AccessPage({required this.api, required this.property, required this.owner});
  @override State<_AccessPage> createState() => _AccessPageState();
}
class _AccessPageState extends State<_AccessPage> {
  List<Map<String, dynamic>> _delegates = const [];
  bool _loading = true;
  String? _error;
  String? get _propertyId => widget.property?['id']?.toString();
  @override void initState() { super.initState(); _load(); }
  Future<void> _load() async {
    if (_propertyId == null || !widget.owner) { setState(() => _loading = false); return; }
    setState(() { _loading = true; _error = null; });
    try { _delegates = await widget.api.delegates(_propertyId!); }
    on ApiException catch (e) { _error = e.message; }
    finally { if (mounted) setState(() => _loading = false); }
  }
  @override Widget build(BuildContext context) => Scaffold(appBar: AppBar(title: const Text('Property Access')), body: ListView(padding: const EdgeInsets.fromLTRB(20, 8, 20, 28), children: [
    _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(widget.property?['name']?.toString() ?? 'No property selected', style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w600)), const SizedBox(height: 7), Text(widget.property?['address']?.toString() ?? 'Address not provided', style: const TextStyle(color: AppColors.textSecondary, fontSize: 14))])),
    const SizedBox(height: 24), const Text('Authorized Delegates', style: TextStyle(fontSize: 19, fontWeight: FontWeight.w600)), const SizedBox(height: 12),
    if (_loading) const Center(child: Padding(padding: EdgeInsets.all(24), child: CircularProgressIndicator(color: AppColors.primary)))
    else if (_error != null) _EmptyState(title: 'Could not load delegates', message: _error!)
    else if (_delegates.isEmpty) const _EmptyState(title: 'No authorized delegates', message: 'Add a registered account to share monitoring access.')
    else ..._delegates.map((delegate) => Padding(padding: const EdgeInsets.only(bottom: 10), child: _Card(child: Row(children: [Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(delegate['name']?.toString() ?? 'Account', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)), const SizedBox(height: 4), Text(delegate['email']?.toString() ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)), const SizedBox(height: 7), const Text('ACTIVE', style: TextStyle(color: AppColors.primary, fontSize: 10, letterSpacing: .6, fontWeight: FontWeight.w600))])), TextButton(onPressed: () => _revoke(delegate), style: TextButton.styleFrom(foregroundColor: AppColors.danger), child: const Text('Revoke'))]))),
    if (widget.owner) ...[const SizedBox(height: 10), ElevatedButton(onPressed: _loading ? null : _add, child: const Text('Add Delegate'))] else const Padding(padding: EdgeInsets.only(top: 16), child: Text('Access management is limited to authorized property owners.', style: TextStyle(color: AppColors.muted, fontSize: 12))),
    const SizedBox(height: 16), const Text('Delegates can view property alerts and sensor readings but cannot add properties, pair devices or manage access permissions.', style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.5)),
  ]));

  Future<void> _add() async {
    final email = TextEditingController();
    final ok = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(backgroundColor: AppColors.surface, title: const Text('Add Delegate'), content: TextField(controller: email, keyboardType: TextInputType.emailAddress, decoration: const InputDecoration(labelText: 'Account email')), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Add'))]));
    if (ok != true || email.text.trim().isEmpty || _propertyId == null) return;
    try { await widget.api.addDelegate(_propertyId!, email.text.trim()); await _load(); if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Delegate access added.'))); }
    on ApiException catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.surfaceRaised)); }
  }

  Future<void> _revoke(Map<String, dynamic> delegate) async {
    final confirmed = await showDialog<bool>(context: context, builder: (ctx) => AlertDialog(backgroundColor: AppColors.surface, title: const Text('Revoke delegate access?'), content: Text('${delegate['name'] ?? delegate['email']} will no longer be able to view this property.'), actions: [TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')), TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Revoke', style: TextStyle(color: AppColors.danger)))]));
    if (confirmed != true || _propertyId == null) return;
    try { await widget.api.revokeDelegate(_propertyId!, delegate['id'].toString()); await _load(); if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Delegate access revoked.'))); }
    on ApiException catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message), backgroundColor: AppColors.surfaceRaised)); }
  }
}

class _SettingsPage extends StatelessWidget {
  final Map<String, dynamic> user; final bool owner; final VoidCallback onSignOut; final VoidCallback onManageAccess; final VoidCallback? onAddProperty; final bool notifications; final ValueChanged<bool> onNotifications;
  const _SettingsPage({required this.user, required this.owner, required this.onSignOut, required this.onManageAccess, required this.onAddProperty, required this.notifications, required this.onNotifications});
  @override Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(20, 22, 20, 30), children: [
    const Text('Settings', style: TextStyle(fontSize: 27, fontWeight: FontWeight.w600)), const SizedBox(height: 20), const Text('ACCOUNT', style: TextStyle(color: AppColors.muted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)), const SizedBox(height: 10),
    _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [_InfoLine(label: 'Full name', value: user['name']?.toString() ?? '—'), const Divider(height: 22), _InfoLine(label: 'Email address', value: user['email']?.toString() ?? '—'), const Divider(height: 22), _InfoLine(label: 'Account role', value: user['role']?.toString() ?? '—')])),
    const SizedBox(height: 22), const Text('PREFERENCES', style: TextStyle(color: AppColors.muted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)), const SizedBox(height: 8),
    const _SettingsAction(title: 'My Properties'), if (owner) ...[_SettingsAction(title: 'Authorized Delegates', onTap: onManageAccess), const SizedBox(height: 12), ElevatedButton(onPressed: onAddProperty, child: const Text('Add Property'))], const _SettingsAction(title: 'Account Information'),
    const SizedBox(height: 10), _Card(child: Row(children: [const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Push Notifications', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w500)), SizedBox(height: 5), Text('Receive real-time property hazard alerts.', style: TextStyle(color: AppColors.textSecondary, fontSize: 12))])), Switch(value: notifications, activeTrackColor: AppColors.primary, onChanged: onNotifications)])),
    const Padding(padding: EdgeInsets.only(top: 8), child: Text('Enable notifications after Firebase app settings are supplied for this build.', style: TextStyle(color: AppColors.muted, fontSize: 12))),
    const SizedBox(height: 36), OutlinedButton(onPressed: () => showDialog<void>(context: context, builder: (ctx) => AlertDialog(backgroundColor: AppColors.surface, title: const Text('Sign out?'), content: const Text('You will need to sign in again to monitor this account.'), actions: [TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')), TextButton(onPressed: () { Navigator.pop(ctx); onSignOut(); }, child: const Text('Sign Out', style: TextStyle(color: AppColors.danger)))])), style: OutlinedButton.styleFrom(foregroundColor: AppColors.danger, side: const BorderSide(color: AppColors.danger)), child: const Text('Sign Out')),
  ]);
}

class _ActiveAlert extends StatelessWidget {
  final Map<String, dynamic> item; final VoidCallback onAck; const _ActiveAlert({required this.item, required this.onAck});
  @override Widget build(BuildContext context) { final color = _severityColor(item['severity']); return Container(padding: const EdgeInsets.all(15), decoration: BoxDecoration(color: color.withValues(alpha: .08), border: Border.all(color: color.withValues(alpha: .3)), borderRadius: BorderRadius.circular(14)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [_StatusDot(color: color, size: 7), const SizedBox(width: 8), Text(item['severity']?.toString() ?? 'WARNING', style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 11, letterSpacing: .6)), const Spacer(), Text(item['hazardType']?.toString() ?? 'HAZARD', style: TextStyle(color: color, fontSize: 11))]), const SizedBox(height: 11), Text(item['details']?.toString() ?? _hazardLabel(item['hazardType']), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)), const SizedBox(height: 6), Text('${item['readingValue'] ?? '—'}  ·  ${_dateLabel(item['startedAt'])}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)), const SizedBox(height: 8), Align(alignment: Alignment.centerRight, child: TextButton(onPressed: item['status'] == 'ACTIVE' ? onAck : null, child: const Text('Acknowledge')))])); }
}

class _DeviceOverviewCard extends StatelessWidget {
  final Map<String, dynamic> device; final Map<String, dynamic>? reading; const _DeviceOverviewCard({required this.device, required this.reading});
  @override Widget build(BuildContext context) { final metrics = _metrics(reading); final isOnline = device['isOnline'] == true; return _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Expanded(child: Text(device['name']?.toString() ?? device['id']?.toString() ?? 'Sensor device', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15), maxLines: 1, overflow: TextOverflow.ellipsis)), Text(isOnline ? 'ONLINE' : 'OFFLINE', style: TextStyle(color: isOnline ? AppColors.primary : AppColors.muted, fontWeight: FontWeight.w600, fontSize: 11, letterSpacing: .4))]), const SizedBox(height: 4), Text(device['id']?.toString() ?? '', style: const TextStyle(color: AppColors.muted, fontSize: 12)), const SizedBox(height: 15), Row(children: [Expanded(child: _MetricMini(label: 'SMOKE', value: metrics['smokePpm'])), Expanded(child: _MetricMini(label: 'LPG', value: metrics['gasPpm'])), Expanded(child: _MetricMini(label: 'FLAME', value: metrics['flameDetected'] == true ? 'DETECTED' : 'CLEAR', color: metrics['flameDetected'] == true ? AppColors.danger : AppColors.primary))]) ])); }
}

class _DetailedDeviceCard extends StatelessWidget {
  final Map<String, dynamic> device; final Map<String, dynamic>? reading; const _DetailedDeviceCard({required this.device, required this.reading});
  @override Widget build(BuildContext context) { final m = _metrics(reading); final online = device['isOnline'] == true; final flame = m['flameDetected'] == true; return _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [Expanded(child: Text(device['name']?.toString() ?? device['id']?.toString() ?? 'Device', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 16))), Text(online ? 'ONLINE' : 'OFFLINE', style: TextStyle(color: online ? AppColors.primary : AppColors.muted, fontSize: 11, fontWeight: FontWeight.w600))]), const SizedBox(height: 5), Text(device['id']?.toString() ?? '', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)), const SizedBox(height: 4), Text('Last updated ${_dateLabel(reading?['recordedAt'] ?? device['lastSeenAt'])}', style: const TextStyle(color: AppColors.muted, fontSize: 11)), const SizedBox(height: 22), _Gauge(label: 'Smoke Level (ppm)', value: m['smokePpm'], threshold: 300, warning: 150), const SizedBox(height: 19), _Gauge(label: 'LPG Level (ppm)', value: m['gasPpm'], threshold: 200, warning: 100), const SizedBox(height: 20), const Divider(), const SizedBox(height: 11), const Text('Flame Sensor', style: TextStyle(color: AppColors.textSecondary, fontSize: 13)), const SizedBox(height: 7), Text(flame ? 'FLAME DETECTED' : 'CLEAR', style: TextStyle(color: flame ? AppColors.danger : AppColors.primary, fontWeight: FontWeight.w700, fontSize: 14, letterSpacing: .4))])); }
}

class _Gauge extends StatelessWidget {
  final String label; final dynamic value; final double threshold; final double warning; const _Gauge({required this.label, required this.value, required this.threshold, required this.warning});
  @override Widget build(BuildContext context) { final n = value is num ? value.toDouble() : null; final color = n == null ? AppColors.muted : n >= threshold ? AppColors.danger : n >= warning ? AppColors.warning : AppColors.primary; return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)), const SizedBox(height: 5), Text(n == null ? '—' : n.toStringAsFixed(1), style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w700, letterSpacing: -.7)), const SizedBox(height: 9), ClipRRect(borderRadius: BorderRadius.circular(5), child: LinearProgressIndicator(value: n == null ? 0 : (n / (threshold * 1.5)).clamp(0, 1), minHeight: 4, backgroundColor: AppColors.border, valueColor: AlwaysStoppedAnimation(color)))]); }
}

class _IncidentRow extends StatelessWidget {
  final Map<String, dynamic> item; final List<Map<String, dynamic>> properties; final VoidCallback onAck; const _IncidentRow({required this.item, required this.properties, required this.onAck});
  @override Widget build(BuildContext context) { final color = item['status'] == 'ACKNOWLEDGED' || item['status'] == 'RESOLVED' ? AppColors.muted : _severityColor(item['severity']); final property = properties.where((p) => p['id']?.toString() == item['propertyId']?.toString()).firstOrNull; final reading = item['readingValue']; final type = item['hazardType']?.toString() ?? 'HAZARD'; return Container(padding: const EdgeInsets.symmetric(vertical: 15), decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Row(children: [if (item['status'] == 'ACTIVE') _StatusDot(color: color, size: 7), if (item['status'] == 'ACTIVE') const SizedBox(width: 8), Text(type, style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 12, letterSpacing: .5)), const Spacer(), Text(item['severity']?.toString() ?? '', style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600))]), const SizedBox(height: 8), Text(property?['name']?.toString() ?? 'Property', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)), const SizedBox(height: 4), Text('${_triggerText(type, reading)}  ·  ${_dateLabel(item['startedAt'])}', style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)), const SizedBox(height: 8), Row(children: [Text(item['status']?.toString() == 'ACTIVE' ? 'UNACKNOWLEDGED' : 'ACKNOWLEDGED', style: TextStyle(color: color, fontSize: 10, letterSpacing: .5, fontWeight: FontWeight.w600)), if (item['acknowledgedBy'] != null) Expanded(child: Text('  ·  ${item['userAck'] is Map ? item['userAck']['name'] ?? item['acknowledgedBy'] : item['acknowledgedBy']}', overflow: TextOverflow.ellipsis, style: const TextStyle(color: AppColors.muted, fontSize: 11))), if (item['status'] == 'ACTIVE') TextButton(onPressed: onAck, child: const Text('Acknowledge'))]) ])); }
}

class _Card extends StatelessWidget { final Widget child; const _Card({required this.child}); @override Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(17), decoration: BoxDecoration(color: AppColors.surface, borderRadius: BorderRadius.circular(16), border: Border.all(color: AppColors.border)), child: child); }
class _StatusDot extends StatelessWidget { final Color color; final double size; const _StatusDot({required this.color, this.size = 9}); @override Widget build(BuildContext context) => Container(width: size, height: size, decoration: BoxDecoration(color: color, shape: BoxShape.circle)); }
class _MetricMini extends StatelessWidget { final String label; final dynamic value; final Color? color; const _MetricMini({required this.label, required this.value, this.color}); @override Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(label, style: const TextStyle(color: AppColors.muted, fontSize: 10, letterSpacing: .6)), const SizedBox(height: 5), Text(value is num ? value.toDouble().toStringAsFixed(1) : value?.toString() ?? '—', style: TextStyle(color: color ?? AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.w600))]); }
class _InfoLine extends StatelessWidget { final String label, value; const _InfoLine({required this.label, required this.value}); @override Widget build(BuildContext context) => Row(crossAxisAlignment: CrossAxisAlignment.start, children: [SizedBox(width: 110, child: Text(label, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13))), Expanded(child: Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500)))]); }
class _SettingsAction extends StatelessWidget { final String title; final VoidCallback? onTap; const _SettingsAction({required this.title, this.onTap}); @override Widget build(BuildContext context) => InkWell(onTap: onTap, child: Container(height: 50, decoration: const BoxDecoration(border: Border(bottom: BorderSide(color: AppColors.border))), child: Row(children: [Expanded(child: Text(title, style: TextStyle(color: onTap == null ? AppColors.textSecondary : AppColors.textPrimary, fontSize: 14))), const Text('Open', style: TextStyle(color: AppColors.muted, fontSize: 12))]))); }
class _EmptyState extends StatelessWidget { final String title, message; const _EmptyState({required this.title, required this.message}); @override Widget build(BuildContext context) => _Card(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600)), const SizedBox(height: 6), Text(message, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.45))])); }
class _ErrorState extends StatelessWidget { final String message; final VoidCallback retry; const _ErrorState({required this.message, required this.retry}); @override Widget build(BuildContext context) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Column(mainAxisSize: MainAxisSize.min, children: [Text(message, textAlign: TextAlign.center, style: const TextStyle(color: AppColors.textSecondary)), const SizedBox(height: 16), TextButton(onPressed: retry, child: const Text('Try again'))]))); }

List<Map<String, dynamic>> _propertyDevices(MonitoringSnapshot? snapshot, Map<String, dynamic>? property) {
  final rows = snapshot?.devices ?? const <Map<String, dynamic>>[];
  if (property == null) return rows;
  final embedded = property['zones'] is List ? (property['zones'] as List).whereType<Map>().toList() : const <Map>[];
  final fetched = snapshot?.zonesByProperty[property['id']?.toString()] ?? const <Map<String, dynamic>>[];
  final zones = embedded.isNotEmpty ? embedded : fetched;
  final propertyZones = zones.map((z) => z['id']?.toString()).toSet();
  return rows.where((d) => propertyZones.contains(d['zoneId']?.toString())).toList();
}
Map<String, dynamic> _metrics(Map<String, dynamic>? reading) { final source = reading?['metrics'] is Map ? Map<String, dynamic>.from(reading!['metrics'] as Map) : reading ?? const <String, dynamic>{}; return {'smokePpm': source['smokePpm'] ?? source['smoke_ppm'], 'gasPpm': source['gasPpm'] ?? source['gas_ppm'], 'flameDetected': source['flameDetected'] == true || source['flame_detected'] == true}; }
Color _severityColor(dynamic severity) => severity == 'CRITICAL' ? AppColors.danger : severity == 'WARNING' ? AppColors.warning : AppColors.muted;
DateTime _date(dynamic value) => DateTime.tryParse(value?.toString() ?? '') ?? DateTime.fromMillisecondsSinceEpoch(0);
String _dateLabel(dynamic value) { if (value == null) return 'Time unavailable'; final d = _date(value).toLocal(); if (d.millisecondsSinceEpoch == 0) return 'Time unavailable'; final y = d.year.toString().padLeft(4, '0'), m = d.month.toString().padLeft(2, '0'), day = d.day.toString().padLeft(2, '0'); final h = d.hour.toString().padLeft(2, '0'), min = d.minute.toString().padLeft(2, '0'), sec = d.second.toString().padLeft(2, '0'); return '$y-$m-$day $h:$min:$sec'; }
String _hazardLabel(dynamic type) => (type ?? 'Hazard event').toString().replaceAll('_', ' ');
String _triggerText(String type, dynamic value) { final prefix = type.contains('GAS') ? 'LPG' : type.contains('SMOKE') ? 'Smoke' : 'Reading'; return '$prefix: ${value ?? '—'} ppm'; }
String _firstName(String? name) { final trimmed = (name ?? '').trim(); return trimmed.isEmpty ? 'there' : trimmed.split(RegExp(r'\s+')).first; }
