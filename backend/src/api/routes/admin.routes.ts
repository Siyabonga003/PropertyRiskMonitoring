import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';
import { authenticateToken, authorizeRoles } from '../middlewares/auth';
import { validateBody } from '../middlewares/validate';
import { db } from '../../database/db';
import { socketEmitter } from '../../sockets/emitter';

const router = Router();
router.use(authenticateToken, authorizeRoles(Role.ADMIN));

router.get('/users', async (_req, res, next) => {
  try { res.json(await db.getUsersSafe()); }
  catch (err) { next(err); }
});

router.get('/properties', async (_req, res, next) => {
  try {
    const properties = await db.getProperties();
    res.json(properties.map((property: any) => ({
      ...property,
      zones: Array.isArray(property.zones) ? property.zones.map((zone: any) => ({
        ...zone,
        devices: Array.isArray(zone.devices) ? zone.devices.map((device: any) => ({ id: device.id, name: device.name, zoneId: device.zoneId, isOnline: device.isOnline, lastSeenAt: device.lastSeenAt, firmwareVer: device.firmwareVer })) : zone.devices,
      })) : property.zones,
    })));
  }
  catch (err) { next(err); }
});

router.patch('/users/:id/role', validateBody(z.object({ role: z.nativeEnum(Role) }).strict()), async (req, res, next) => {
  try {
    const user = await db.findUserById(req.params.id);
    if (!user) { res.status(404).json({ error: 'User not found.' }); return; }
    await db.setUserRole(user.id, req.body.role);
    res.json({ id: user.id, email: user.email, name: user.name, role: req.body.role });
  } catch (err) { next(err); }
});

router.put('/properties/:id/owner', validateBody(z.object({ userId: z.string().min(1) }).strict()), async (req, res, next) => {
  try {
    const nextOwner = await db.findUserById(req.body.userId);
    if (!nextOwner || nextOwner.role === Role.ADMIN) { res.status(404).json({ error: 'Eligible owner account not found.' }); return; }
    const transfer = await db.setPropertyOwner(req.params.id, nextOwner.id);
    if (transfer === null) { res.status(404).json({ error: 'Property or owner account not found.' }); return; }
    await db.syncPropertyRole(nextOwner.id);
    if (transfer.previousOwnerId) {
      await db.syncPropertyRole(transfer.previousOwnerId);
      socketEmitter.refreshUserRooms(transfer.previousOwnerId);
    }
    socketEmitter.refreshUserRooms(nextOwner.id);
    res.json({ propertyId: req.params.id, owner: { id: nextOwner.id, email: nextOwner.email, name: nextOwner.name } });
  } catch (err) { next(err); }
});

export default router;
