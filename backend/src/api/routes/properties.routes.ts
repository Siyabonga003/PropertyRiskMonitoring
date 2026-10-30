import { Router } from 'express';
import { z } from 'zod';
import { propertyService } from '../../services/propertyService';
import { validateBody } from '../middlewares/validate';
import { ArmingState } from '@prisma/client';

const router = Router();

const createPropertySchema = z.object({
  name: z.string().min(2),
  address: z.string().optional(),
  armingState: z.enum(['DISARMED', 'ARMED_HOME', 'ARMED_AWAY']).optional(),
});

const armingSchema = z.object({
  armingState: z.enum(['DISARMED', 'ARMED_HOME', 'ARMED_AWAY']),
});

const createZoneSchema = z.object({
  name: z.string().min(2),
  thresholdConfig: z.record(z.any()).optional(),
});

// List all properties
router.get('/', async (req, res, next) => {
  try {
    const properties = await propertyService.getProperties();
    res.json(properties);
  } catch (err) {
    next(err);
  }
});

// Create property
router.post('/', validateBody(createPropertySchema), async (req, res, next) => {
  try {
    const property = await propertyService.createProperty(req.body);
    res.status(201).json(property);
  } catch (err) {
    next(err);
  }
});

// Get property by ID
router.get('/:id', async (req, res, next) => {
  try {
    const property = await propertyService.getPropertyById(req.params.id);
    if (!property) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }
    res.json(property);
  } catch (err) {
    next(err);
  }
});

// Patch property arming state
router.patch('/:id/arming', validateBody(armingSchema), async (req, res, next) => {
  try {
    const updated = await propertyService.updateArmingState(
      req.params.id,
      req.body.armingState as ArmingState
    );
    if (!updated) {
      res.status(404).json({ error: 'Property not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// Get zones for property
router.get('/:id/zones', async (req, res, next) => {
  try {
    const zones = await propertyService.getZones(req.params.id);
    res.json(zones);
  } catch (err) {
    next(err);
  }
});

// Create zone for property
router.post('/:id/zones', validateBody(createZoneSchema), async (req, res, next) => {
  try {
    const zone = await propertyService.createZone(
      req.params.id,
      req.body.name,
      req.body.thresholdConfig
    );
    res.status(201).json(zone);
  } catch (err) {
    next(err);
  }
});

export default router;
