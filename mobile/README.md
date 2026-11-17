# PropertyGuard mobile

A dark, responsive Flutter client for the Property Risk Monitoring backend. It includes sign-in/registration, Home, Alerts, sensor detail cards, QR/manual device claim, Property Access delegate management, Settings, secure JWT storage, and authenticated Firebase Messaging token registration.

## Run

```sh
cd mobile
flutter pub get
flutter run \
  --dart-define=API_BASE_URL=http://10.0.2.2:5000 \
  --dart-define=FCM_API_KEY=... \
  --dart-define=FCM_APP_ID=... \
  --dart-define=FCM_SENDER_ID=... \
  --dart-define=FCM_PROJECT_ID=...
```

For a physical Android device, replace `10.0.2.2` with the host machine's LAN address. If the FCM build values are absent, the app still works but push registration remains disabled. The API URL and independent future Socket.IO URL are configured in `lib/config/api_config.dart`.

## Backend routes used

| Feature | Route |
| --- | --- |
| Register / login / restore account | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me` |
| FCM token lifecycle | `POST /api/auth/push-token`, `DELETE /api/auth/push-token` |
| Authorized properties, zones, create property | `GET /api/properties`, `GET /api/properties/:id/zones`, `POST /api/properties` |
| Devices and claim | `GET /api/devices`, `POST /api/devices/claim` |
| Telemetry | `GET /api/telemetry/latest?deviceId=...` |
| Incidents / acknowledgement | `GET /api/incidents`, `PATCH /api/incidents/:id/acknowledge` |
| Delegate management | `GET|POST /api/properties/:id/delegates`, `DELETE /api/properties/:id/delegates/:userId` |

The app polls the REST contract for dashboard updates. Socket.IO is now authenticated and property/user-scoped, but the mobile client can continue using polling without depending on socket availability.
