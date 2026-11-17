# Property Risk Monitoring Backend

## PropertyGuard authentication and access controls

### Apply the expanded schema

This repository's existing database workflow uses Prisma `db push` (there is no initial baseline migration). Apply the updated roles, property owner field, device enrollment records, and push-token table before deploying the new server:

```sh
cd backend
npm ci
npx prisma db push
npx prisma generate
npm run build
```

Public registration creates `PROPERTY_OWNER` accounts only. Clients cannot set `ADMIN` or `AUTHORIZED_DELEGATE` through registration. Existing `MANAGER` and `VIEWER` enum values are retained as legacy roles and do not grant global access. Property reads require explicit `ownerId` ownership or membership in the existing `Property.users` relation. Mutations check ownership separately; being `ADMIN` permits system monitoring but does not automatically make an administrator a property owner.

For an existing database, pre-existing `Property.users` links remain read access. Properties with no `ownerId` have no owner-only operator until an administrator assigns one explicitly through `PUT /api/admin/properties/:id/owner`.

### Create the first administrator

Development seeding (including the demo `admin@example.com` account) is disabled in production. Provision an administrator through a one-time CLI command instead:

```sh
ADMIN_EMAIL=security-admin@example.com \
ADMIN_PASSWORD='a-unique-password-of-at-least-16-characters' \
ADMIN_NAME='Security Administrator' \
npm run admin:create
```

The CLI creates or promotes the named account to `ADMIN`. Keep its environment values private. Production requires PostgreSQL and a unique `JWT_SECRET` of at least 32 characters; the server refuses to start with fallback storage or the development JWT secret.

### API security contracts

- All user-facing property, device, telemetry-read, zone, and incident endpoints require a verified Bearer JWT. Cross-property requests return `404` to avoid disclosing record existence.
- `ADMIN` can read system monitoring records but cannot create properties, claim devices, change property settings, or manage delegates as an owner. System administration endpoints live under `/api/admin`.
- Only an account with `PROPERTY_OWNER` role that is the property's actual `ownerId` can create properties, pair devices, change arming/zone settings, or add/revoke delegates. Delegates can read assigned properties and acknowledge incidents, but cannot manage property resources.
- Public `/api/auth/register` ignores no role field: the schema is strict and rejects it. Admin roles are never user-selectable.
- Device firmware HTTP ingestion uses `X-Device-Token`; property, zone, and device identifiers are verified against the claimed device assignment. The device token is never returned by user-facing device/property APIs.
- `/api/devices/provision` is admin-only and returns a random single-use QR `pairingToken` (48-hour expiry) plus device credentials once. An owner claims it with `POST /api/devices/claim` and `{ "pairingToken": "…", "propertyId": "…" }`; the server selects/creates the property's default `Sensors` zone. No room/zone value is required from the app.
- Delegate add payload: `{ "email": "existing-account@example.com" }`. The delegate must already have an account. Revoke is scoped to that owner and property.
- FCM tokens are bound to the verified authenticated user at `POST /api/auth/push-token` with `{ "token": "…", "platform": "android|ios|web", "enabled": true }`; clients cannot provide a `userId`. DELETE removes only the caller's token. Set `FIREBASE_SERVICE_ACCOUNT_JSON` to enable Firebase Admin push delivery. Without it, token registration still works but delivery is disabled.
- Socket.IO requires a JWT in `handshake.auth.token` (or Bearer authorization). The server joins the verified `user:<id>` room and authorized property rooms. `property:join` checks membership, device commands check ownership/admin rights, and server events are emitted only to current authorized users' private user rooms (including authorized system administrators)—never to the property room or globally.

`CLIENT_URL` is a comma-separated allowlist for REST and Socket.IO origins. Firmware/MQTT deployment credentials and broker ACLs remain a separate network-security boundary; do not expose the broker publicly without per-device authentication and topic ACLs.
