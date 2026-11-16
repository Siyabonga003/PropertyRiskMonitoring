import { Router } from 'express';
import { z } from 'zod';
import { deviceService } from '../../services/deviceService';
import { validateBody } from '../middlewares/validate';

const router = Router();

const createDeviceSchema = z.object({
  id: z.string().min(2),
  name: z.string().optional(),
  zoneId: z.string().min(1),
  deviceToken: z.string().optional(),
  firmwareVer: z.string().optional(),
});

const commandSchema = z.object({
  command: z.string().min(1),
  parameters: z.record(z.any()).optional(),
});

// List devices
router.get('/', async (req, res, next) => {
  try {
    const devices = await deviceService.getDevices();
    res.json(devices);
  } catch (err) {
    next(err);
  }
});

// Get device by ID
router.get('/:id', async (req, res, next) => {
  try {
    const device = await deviceService.getDeviceById(req.params.id);
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    res.json(device);
  } catch (err) {
    next(err);
  }
});

// Create/Register device
router.post('/', validateBody(createDeviceSchema), async (req, res, next) => {
  try {
    const device = await deviceService.registerDevice(req.body);
    res.status(201).json(device);
  } catch (err) {
    next(err);
  }
});

// Send actuator command to device
router.post('/:id/command', validateBody(commandSchema), async (req, res, next) => {
  try {
    const success = await deviceService.sendCommand(
      req.params.id,
      req.body.command,
      req.body.parameters || {}
    );
    res.json({
      success,
      deviceId: req.params.id,
      command: req.body.command,
      timestamp: new Date(),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
