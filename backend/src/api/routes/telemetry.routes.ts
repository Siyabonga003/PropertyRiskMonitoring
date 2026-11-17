import { Router } from 'express';
import { z } from 'zod';
import { telemetryService } from '../../services/telemetryService';
import { validateBody } from '../middlewares/validate';
import { authenticateDeviceToken, authenticateToken, requireDeviceBodyScope, requireDeviceQueryAccess } from '../middlewares/auth';

const router = Router();
const metric = z.number().finite().optional();
const ingestTelemetrySchema = z.object({
  propertyId: z.string().min(1), zoneId: z.string().min(1), deviceId: z.string().min(1), timestamp: z.number().finite().optional(),
  metrics: z.object({
    temperature: metric, humidity: metric, smoke_ppm: metric, gas_ppm: metric,
    flame_detected: z.boolean().optional(), water_detected: z.boolean().optional(), motion_detected: z.boolean().optional(),
  }).strict(),
  diagnostics: z.object({ wifi_rssi: z.number().int().optional(), uptime_seconds: z.number().nonnegative().optional(), free_heap: z.number().nonnegative().optional() }).strict().optional(),
}).strict();

router.get('/latest', authenticateToken, requireDeviceQueryAccess, async (req, res, next) => {
  try { res.json((await telemetryService.getLatestReading(req.query.deviceId as string)) || {}); }
  catch (err) { next(err); }
});
router.get('/history', authenticateToken, requireDeviceQueryAccess, async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) { res.status(400).json({ error: 'limit must be an integer between 1 and 1000.' }); return; }
    res.json(await telemetryService.getHistory(req.query.deviceId as string, limit));
  } catch (err) { next(err); }
});
router.get('/rollups', authenticateToken, requireDeviceQueryAccess, async (req, res, next) => {
  try { res.json(await telemetryService.getRollups(req.query.deviceId as string)); }
  catch (err) { next(err); }
});

// Firmware fallback: X-Device-Token must map to the registered device and all
// routed identifiers must match its currently assigned property and zone.
router.post('/ingest', validateBody(ingestTelemetrySchema), authenticateDeviceToken, requireDeviceBodyScope, async (req, res, next) => {
  try {
    const { propertyId, zoneId, deviceId, timestamp, metrics, diagnostics } = req.body;
    const reading = await telemetryService.ingestTelemetry(propertyId, zoneId, deviceId, { deviceId, timestamp, metrics, diagnostics });
    res.status(201).json({ success: true, reading });
  } catch (err) { next(err); }
});
export default router;
