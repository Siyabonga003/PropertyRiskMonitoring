import { Router } from 'express';
import { z } from 'zod';
import { propertyService } from '../../services/propertyService';
import { validateBody } from '../middlewares/validate';
import { authenticateToken, requireZoneAccess } from '../middlewares/auth';

const router = Router();
router.use(authenticateToken);
const updateThresholdsSchema = z.object({ thresholdConfig: z.record(z.any()) }).strict();
const sanitize = (zone: any) => zone ? ({ ...zone, devices: Array.isArray(zone.devices) ? zone.devices.map((device: any) => ({ id: device.id, name: device.name, zoneId: device.zoneId, isOnline: device.isOnline, lastSeenAt: device.lastSeenAt, firmwareVer: device.firmwareVer })) : zone.devices }) : zone;

router.get('/:id', requireZoneAccess(), async (req, res, next) => {
  try {
    const zone = await propertyService.getZoneById(req.params.id);
    if (!zone) { res.status(404).json({ error: 'Zone not found.' }); return; }
    res.json(sanitize(zone));
  } catch (err) { next(err); }
});

router.patch('/:id/thresholds', requireZoneAccess('id', true), validateBody(updateThresholdsSchema), async (req, res, next) => {
  try {
    const updated = await propertyService.updateZoneThresholds(req.params.id, req.body.thresholdConfig);
    if (!updated) { res.status(404).json({ error: 'Zone not found.' }); return; }
    res.json(sanitize(updated));
  } catch (err) { next(err); }
});
export default router;
