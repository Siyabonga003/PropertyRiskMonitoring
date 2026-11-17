import { Router } from 'express';
import { z } from 'zod';
import { IncidentStatus, IncidentSeverity, HazardType, Role } from '@prisma/client';
import { incidentService } from '../../services/incidentService';
import { alertEngine } from '../../services/alertEngine';
import { db } from '../../database/db';
import { validateBody } from '../middlewares/validate';
import { authenticateDeviceToken, authenticateToken, AuthenticatedRequest, authorizeRoles, requireDeviceBodyScope, requireIncidentAccess, requireIncidentOwner } from '../middlewares/auth';

const router = Router();
const hardwareAlertSchema = z.object({
  propertyId: z.string().min(1), zoneId: z.string().min(1), deviceId: z.string().min(1),
  timestamp: z.number().finite().optional(), hazardType: z.string().min(2).max(60),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']).optional(), value: z.number().finite().optional(),
  unit: z.string().max(20).optional(), message: z.string().max(1000).optional(),
}).strict();
const adminIngestSchema = z.object({
  propertyId: z.string().min(1), deviceId: z.string().min(1), hazardType: z.nativeEnum(HazardType),
  severity: z.nativeEnum(IncidentSeverity).optional(), readingValue: z.number().finite().optional(), details: z.string().max(1000).optional(),
}).strict();
const ackSchema = z.object({}).strict();

router.get('/', authenticateToken, async (req: AuthenticatedRequest, res, next) => {
  try {
    const propertyId = typeof req.query.propertyId === 'string' ? req.query.propertyId : undefined;
    const status = typeof req.query.status === 'string' && Object.values(IncidentStatus).includes(req.query.status as IncidentStatus)
      ? req.query.status as IncidentStatus : undefined;
    if (req.query.status && !status) { res.status(400).json({ error: 'Invalid incident status.' }); return; }
    const properties = await db.getPropertiesForUser(req.user!.id, req.user!.role);
    const propertyIds = properties.map((property) => property.id);
    if (propertyId && !propertyIds.includes(propertyId)) { res.status(404).json({ error: 'Property not found.' }); return; }
    const incidents = await incidentService.getIncidents({ ...(propertyId ? { propertyId } : { propertyIds }), ...(status ? { status } : {}) });
    res.json(await Promise.all(incidents.map(async (incident: any) => ({
      ...incident,
      userAck: incident.userAck || (incident.acknowledgedBy ? await db.findUserById(incident.acknowledgedBy).then((user) => user ? { id: user.id, name: user.name, email: user.email } : null) : null),
    }))));
  } catch (err) { next(err); }
});

router.get('/:id', authenticateToken, requireIncidentAccess(), async (req, res, next) => {
  try {
    const incident = await incidentService.getIncidentById(req.params.id);
    if (!incident) { res.status(404).json({ error: 'Incident not found.' }); return; }
    const user = incident.acknowledgedBy ? await db.findUserById(incident.acknowledgedBy) : null;
    res.json({ ...incident, userAck: (incident as any).userAck || (user ? { id: user.id, name: user.name, email: user.email } : null) });
  } catch (err) { next(err); }
});

// The firmware's X-Device-Token is verified and the body property/zone/device
// tuple is checked against the claimed device before alert evaluation.
router.post('/ingest', validateBody(hardwareAlertSchema), authenticateDeviceToken, requireDeviceBodyScope, async (req, res, next) => {
  try {
    await alertEngine.evaluateExplicitAlert(req.body.propertyId, req.body.zoneId, req.body.deviceId, req.body);
    res.status(202).json({ success: true, accepted: true });
  } catch (err) { next(err); }
});

router.post('/admin-ingest', authenticateToken, authorizeRoles(Role.ADMIN), validateBody(adminIngestSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const properties = await db.getPropertiesForUser(req.user!.id, req.user!.role);
    const property = properties.find((item) => item.id === req.body.propertyId);
    if (!property) { res.status(404).json({ error: 'Property not found.' }); return; }
    const device = await db.getDeviceById(req.body.deviceId);
    if (!device || await db.getPropertyIdForDevice(device.id) !== property.id) { res.status(400).json({ error: 'Device does not belong to this property.' }); return; }
    const incident = await incidentService.ingestDirectIncident(req.body);
    res.status(201).json(incident);
  } catch (err) { next(err); }
});

router.patch('/:id/acknowledge', authenticateToken, authorizeRoles(Role.ADMIN, Role.PROPERTY_OWNER, Role.AUTHORIZED_DELEGATE), requireIncidentAccess(), validateBody(ackSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const incident = await incidentService.acknowledge(req.params.id, req.user!.id);
    if (!incident) { res.status(404).json({ error: 'Incident not found.' }); return; }
    res.json({ ...incident, acknowledgedBy: req.user!.id, userAck: { id: req.user!.id, name: req.user!.name, email: req.user!.email } });
  } catch (err) { next(err); }
});

router.patch('/:id/resolve', authenticateToken, authorizeRoles(Role.ADMIN, Role.PROPERTY_OWNER), requireIncidentOwner(), async (req, res, next) => {
  try {
    const incident = await incidentService.resolve(req.params.id);
    if (!incident) { res.status(404).json({ error: 'Incident not found.' }); return; }
    res.json(incident);
  } catch (err) { next(err); }
});

export default router;
