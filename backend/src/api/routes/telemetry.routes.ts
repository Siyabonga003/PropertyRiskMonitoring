import { Router } from 'express';
import { z } from 'zod';
import { telemetryService } from '../../services/telemetryService';
import { validateBody } from '../middlewares/validate';

const router = Router();

const ingestTelemetrySchema = z.object({
  propertyId: z.string().min(1),
  zoneId: z.string().min(1),
  deviceId: z.string().min(1),
  timestamp: z.number().optional(),
  metrics: z.object({
    temperature: z.number().optional(),
    humidity: z.number().optional(),
    smoke_ppm: z.number().optional(),
    water_detected: z.boolean().optional(),
    motion_detected: z.boolean().optional(),
  }),
  diagnostics: z
    .object({
      wifi_rssi: z.number().optional(),
      uptime_seconds: z.number().optional(),
      free_heap: z.number().optional(),
    })
    .optional(),
});

// Latest telemetry
router.get('/latest', async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const latest = await telemetryService.getLatestReading(deviceId);
    res.json(latest || {});
  } catch (err) {
    next(err);
  }
});

// Telemetry history
router.get('/history', async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const history = await telemetryService.getHistory(deviceId, limit);
    res.json(history);
  } catch (err) {
    next(err);
  }
});

// Telemetry rollups
router.get('/rollups', async (req, res, next) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const rollups = await telemetryService.getRollups(deviceId);
    res.json(rollups);
  } catch (err) {
    next(err);
  }
});

// HTTP telemetry ingestion fallback (e.g. if MQTT is blocked or firewalled)
router.post('/ingest', validateBody(ingestTelemetrySchema), async (req, res, next) => {
  try {
    const { propertyId, zoneId, deviceId, timestamp, metrics, diagnostics } = req.body;
    const reading = await telemetryService.ingestTelemetry(propertyId, zoneId, deviceId, {
      deviceId,
      timestamp,
      metrics,
      diagnostics,
    });
    res.status(201).json({ success: true, reading });
  } catch (err) {
    next(err);
  }
});

export default router;
