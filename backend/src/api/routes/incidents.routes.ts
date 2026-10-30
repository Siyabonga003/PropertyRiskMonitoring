import { Router } from 'express';
import { z } from 'zod';
import { incidentService } from '../../services/incidentService';
import { validateBody } from '../middlewares/validate';
import { IncidentStatus, HazardType, IncidentSeverity } from '@prisma/client';

const router = Router();

const ingestIncidentSchema = z.object({
  propertyId: z.string().min(1),
  deviceId: z.string().min(1),
  hazardType: z.nativeEnum(HazardType),
  severity: z.nativeEnum(IncidentSeverity).optional(),
  readingValue: z.number().optional(),
  details: z.string().optional(),
});

const ackSchema = z.object({
  userId: z.string().optional(),
});

// List incidents
router.get('/', async (req, res, next) => {
  try {
    const propertyId = req.query.propertyId as string | undefined;
    const status = req.query.status as IncidentStatus | undefined;

    const incidents = await incidentService.getIncidents({ propertyId, status });
    res.json(incidents);
  } catch (err) {
    next(err);
  }
});

// Get incident by ID
router.get('/:id', async (req, res, next) => {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json(incident);
  } catch (err) {
    next(err);
  }
});

// Direct incident ingestion
router.post('/ingest', validateBody(ingestIncidentSchema), async (req, res, next) => {
  try {
    const incident = await incidentService.ingestDirectIncident(req.body);
    res.status(201).json(incident);
  } catch (err) {
    next(err);
  }
});

// Acknowledge incident
router.patch('/:id/acknowledge', validateBody(ackSchema), async (req, res, next) => {
  try {
    const incident = await incidentService.acknowledge(req.params.id, req.body.userId);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json(incident);
  } catch (err) {
    next(err);
  }
});

// Resolve incident
router.patch('/:id/resolve', async (req, res, next) => {
  try {
    const incident = await incidentService.resolve(req.params.id);
    if (!incident) {
      res.status(404).json({ error: 'Incident not found' });
      return;
    }
    res.json(incident);
  } catch (err) {
    next(err);
  }
});

export default router;
