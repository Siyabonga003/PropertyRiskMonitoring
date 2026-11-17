import { Router } from 'express';
import { randomBytes, createHash } from 'crypto';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { deviceService } from '../../services/deviceService';
import { propertyService } from '../../services/propertyService';
import { db } from '../../database/db';
import { validateBody } from '../middlewares/validate';
import { authenticateToken, AuthenticatedRequest, authorizeRoles, requireDeviceAccess, requireDeviceOwner, requirePropertyOwner } from '../middlewares/auth';
import { socketEmitter } from '../../sockets/emitter';

const router = Router();
router.use(authenticateToken);

const createDeviceSchema = z.object({ id: z.string().min(2).max(120), name: z.string().max(120).optional(), zoneId: z.string().min(1), deviceToken: z.string().min(20).optional(), firmwareVer: z.string().max(80).optional() }).strict();
const provisionSchema = z.object({ deviceId: z.string().min(2).max(120), name: z.string().trim().min(1).max(120).optional(), firmwareVer: z.string().max(80).optional() }).strict();
const claimSchema = z.object({ pairingToken: z.string().min(24).max(256), propertyId: z.string().min(1) }).strict();
const commandSchema = z.object({ command: z.enum(['TRIGGER_BUZZER', 'SILENCE_BUZZER', 'REBOOT', 'SET_CONFIG']), parameters: z.record(z.any()).optional() }).strict();
const safeDevice = (device: any) => {
  if (!device || typeof device !== 'object') return device;
  return {
    id: device.id, name: device.name, zoneId: device.zoneId, isOnline: device.isOnline,
    lastSeenAt: device.lastSeenAt, firmwareVer: device.firmwareVer, createdAt: device.createdAt, updatedAt: device.updatedAt,
  };
};
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try { res.json((await db.getDevicesForUser(req.user!.id, req.user!.role)).map(safeDevice)); }
  catch (err) { next(err); }
});

// Only system administrators provision a hardware identity. The pairing token
// is shown once; only its SHA-256 digest is stored in the database.
router.post('/provision', authorizeRoles(Role.ADMIN), validateBody(provisionSchema), async (req, res, next) => {
  try {
    const pairingToken = randomBytes(32).toString('base64url');
    const deviceToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const enrollment = await db.createDeviceEnrollment({
      deviceId: req.body.deviceId,
      name: req.body.name || `Sensor ${req.body.deviceId}`,
      deviceToken,
      pairingTokenHash: hashToken(pairingToken),
      firmwareVer: req.body.firmwareVer,
      expiresAt,
    });
    res.status(201).json({ deviceId: enrollment.deviceId, name: enrollment.name, pairingToken, deviceToken, expiresAt });
  } catch (err: any) {
    if (err?.message?.includes('Device ID already registered') || err?.message?.includes('Device ID already exists') || err?.code === 'P2002') {
      res.status(409).json({ error: 'Device ID already registered or has a pending enrollment.' });
      return;
    }
    next(err);
  }
});

router.post('/claim', authorizeRoles(Role.PROPERTY_OWNER), validateBody(claimSchema), requirePropertyOwner('propertyId'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const enrollment = await db.getEnrollmentByPairingHash(hashToken(req.body.pairingToken));
    if (!enrollment) { res.status(404).json({ error: 'Pairing token is invalid, expired, or already claimed.' }); return; }
    let zones = await propertyService.getZones(req.body.propertyId);
    if (!zones.length) zones = [await propertyService.createZone(req.body.propertyId, 'Sensors')];
    const device = await db.claimDeviceEnrollment(enrollment.deviceId, zones[0].id);
    if (!device) { res.status(409).json({ error: 'Device was already claimed or its pairing token expired.' }); return; }
    socketEmitter.emitDeviceStatus(device.id, false);
    res.status(201).json({ device: safeDevice(device), propertyId: req.body.propertyId, zoneId: zones[0].id, message: 'Device paired successfully.' });
  } catch (err) { next(err); }
});

router.get('/:id', requireDeviceAccess(), async (req, res, next) => {
  try {
    const device = await deviceService.getDeviceById(req.params.id);
    if (!device) { res.status(404).json({ error: 'Device not found.' }); return; }
    res.json(safeDevice(device));
  } catch (err) { next(err); }
});

// Legacy direct provisioning is retained for controlled administrative imports.
router.post('/', authorizeRoles(Role.ADMIN), validateBody(createDeviceSchema), async (req, res, next) => {
  try { res.status(201).json(safeDevice(await deviceService.registerDevice(req.body))); }
  catch (err) { next(err); }
});

router.post('/:id/command', requireDeviceOwner(), validateBody(commandSchema), async (req, res, next) => {
  try {
    const success = await deviceService.sendCommand(req.params.id, req.body.command, req.body.parameters || {});
    res.json({ success, deviceId: req.params.id, command: req.body.command, timestamp: new Date() });
  } catch (err) { next(err); }
});

export default router;
