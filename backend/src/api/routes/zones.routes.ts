import { Router } from 'express';
import { z } from 'zod';
import { propertyService } from '../../services/propertyService';
import { validateBody } from '../middlewares/validate';

const router = Router();

const updateThresholdsSchema = z.object({
  thresholdConfig: z.record(z.any()),
});

// Get zone by ID
router.get('/:id', async (req, res, next) => {
  try {
    const zone = await propertyService.getZoneById(req.params.id);
    if (!zone) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }
    res.json(zone);
  } catch (err) {
    next(err);
  }
});

// Update custom thresholds for zone
router.patch('/:id/thresholds', validateBody(updateThresholdsSchema), async (req, res, next) => {
  try {
    const updated = await propertyService.updateZoneThresholds(
      req.params.id,
      req.body.thresholdConfig
    );
    if (!updated) {
      res.status(404).json({ error: 'Zone not found' });
      return;
    }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

export default router;
