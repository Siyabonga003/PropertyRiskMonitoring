import { Router } from 'express';
import { z } from 'zod';
import { Role, ArmingState } from '@prisma/client';
import { propertyService } from '../../services/propertyService';
import { db } from '../../database/db';
import { validateBody } from '../middlewares/validate';
import { authenticateToken, AuthenticatedRequest, authorizeRoles, requirePropertyAccess, requirePropertyOwner } from '../middlewares/auth';
import { socketEmitter } from '../../sockets/emitter';

const router = Router();
router.use(authenticateToken);

const createPropertySchema = z.object({ name: z.string().trim().min(2).max(120), address: z.string().trim().max(300).optional() }).strict();
const armingSchema = z.object({ armingState: z.nativeEnum(ArmingState) }).strict();
const createZoneSchema = z.object({ name: z.string().trim().min(2).max(80), thresholdConfig: z.record(z.any()).optional() }).strict();
const delegateSchema = z.object({ email: z.string().email().max(254) }).strict();

const cleanDevice = (device: any) => {
  if (!device || typeof device !== 'object') return device;
  return { id: device.id, name: device.name, zoneId: device.zoneId, isOnline: device.isOnline, lastSeenAt: device.lastSeenAt, firmwareVer: device.firmwareVer };
};
const cleanProperty = (property: any) => ({
  ...property,
  zones: Array.isArray(property?.zones) ? property.zones.map((zone: any) => ({
    ...zone,
    devices: Array.isArray(zone.devices) ? zone.devices.map(cleanDevice) : zone.devices,
  })) : property?.zones,
});
const cleanZone = (zone: any) => ({ ...zone, devices: Array.isArray(zone?.devices) ? zone.devices.map(cleanDevice) : zone?.devices });

router.get('/', async (req: AuthenticatedRequest, res, next) => {
  try { res.json((await db.getPropertiesForUser(req.user!.id, req.user!.role)).map(cleanProperty)); }
  catch (err) { next(err); }
});

router.post('/', authorizeRoles(Role.PROPERTY_OWNER), validateBody(createPropertySchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const property = await propertyService.createProperty(req.body, req.user!.id);
    // Devices have no required room/zone input in the app. A neutral server
    // default zone is created for pairing and can be renamed by the owner later.
    await propertyService.createZone(property.id, 'Sensors');
    socketEmitter.refreshUserRooms(req.user!.id);
    res.status(201).json(cleanProperty(await propertyService.getPropertyById(property.id)));
  } catch (err) { next(err); }
});

router.get('/:id', requirePropertyAccess(), async (req, res, next) => {
  try {
    const property = await propertyService.getPropertyById(req.params.id);
    if (!property) { res.status(404).json({ error: 'Property not found.' }); return; }
    res.json(cleanProperty(property));
  } catch (err) { next(err); }
});

router.patch('/:id/arming', requirePropertyOwner(), validateBody(armingSchema), async (req, res, next) => {
  try {
    const updated = await propertyService.updateArmingState(req.params.id, req.body.armingState as ArmingState);
    if (!updated) { res.status(404).json({ error: 'Property not found.' }); return; }
    res.json(updated);
  } catch (err) { next(err); }
});

router.get('/:id/zones', requirePropertyAccess(), async (req, res, next) => {
  try { res.json((await propertyService.getZones(req.params.id)).map(cleanZone)); }
  catch (err) { next(err); }
});

router.post('/:id/zones', requirePropertyOwner(), validateBody(createZoneSchema), async (req, res, next) => {
  try {
    const zone = await propertyService.createZone(req.params.id, req.body.name, req.body.thresholdConfig);
    res.status(201).json(cleanZone(zone));
  } catch (err) { next(err); }
});

router.get('/:id/delegates', requirePropertyOwner(), async (req, res, next) => {
  try { res.json(await db.getDelegates(req.params.id)); }
  catch (err) { next(err); }
});

router.post('/:id/delegates', requirePropertyOwner(), validateBody(delegateSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const invitee = await db.findUserByEmail(String(req.body.email).trim().toLowerCase());
    if (!invitee) { res.status(404).json({ error: 'No registered account exists for that email. The delegate must register first.' }); return; }
    if (invitee.id === req.user!.id) { res.status(400).json({ error: 'The owner is already authorized.' }); return; }
    if (invitee.role === Role.ADMIN) { res.status(400).json({ error: 'System administrators cannot be added as property delegates.' }); return; }
    if (await db.canAccessProperty(req.params.id, invitee.id, invitee.role)) {
      res.status(409).json({ error: 'This account already has access to the property.' }); return;
    }
    await db.addDelegate(req.params.id, invitee.id);
    await db.syncPropertyRole(invitee.id);
    socketEmitter.refreshUserRooms(invitee.id);
    res.status(201).json({ id: invitee.id, email: invitee.email, name: invitee.name, role: Role.AUTHORIZED_DELEGATE, accessStatus: 'ACTIVE' });
  } catch (err) { next(err); }
});

router.delete('/:id/delegates/:userId', requirePropertyOwner(), async (req, res, next) => {
  try {
    const delegates = await db.getDelegates(req.params.id);
    if (!delegates.some((delegate) => delegate.id === req.params.userId)) {
      res.status(404).json({ error: 'Authorized delegate not found.' }); return;
    }
    await db.removeDelegate(req.params.id, req.params.userId);
    await db.syncPropertyRole(req.params.userId);
    socketEmitter.refreshUserRooms(req.params.userId);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
