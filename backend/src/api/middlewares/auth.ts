import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { env } from '../../config/env';
import { db } from '../../database/db';
import { IDevice } from '../../database/storageFallback';
import { canControlDevice, canManageProperty, canResolveIncident } from './accessPolicy';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  device?: IDevice;
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const match = authHeader?.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
    return;
  }

  try {
    const decoded = jwt.verify(match[1], env.JWT_SECRET) as { id?: string };
    if (!decoded.id) {
      res.status(401).json({ error: 'Invalid authentication token.' });
      return;
    }
    const user = await db.findUserById(decoded.id);
    if (!user) {
      res.status(401).json({ error: 'User no longer exists.' });
      return;
    }
    req.user = { id: user.id, email: user.email, role: user.role, name: user.name };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export async function authenticateDeviceToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.header('X-Device-Token');
  if (!token) { res.status(401).json({ error: 'Missing X-Device-Token.' }); return; }
  try {
    const device = await db.findDeviceByToken(token);
    if (!device) { res.status(401).json({ error: 'Invalid device credentials.' }); return; }
    req.device = device;
    next();
  } catch (error) { next(error); }
}

export async function requireDeviceBodyScope(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.device) { res.status(401).json({ error: 'Device authentication required.' }); return; }
  try {
    const propertyId = await db.getPropertyIdForZone(req.device.zoneId);
    if (req.body?.deviceId !== req.device.id || req.body?.zoneId !== req.device.zoneId || req.body?.propertyId !== propertyId) {
      res.status(403).json({ error: 'Device credentials do not match the submitted property, zone, and device identifiers.' });
      return;
    }
    next();
  } catch (error) { next(error); }
}

export function authorizeRoles(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden. Your account role does not permit this action.' });
      return;
    }
    next();
  };
}

export function requirePropertyAccess(paramName = 'id') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized.' }); return; }
    try {
      const allowed = await db.canAccessProperty(req.params[paramName], req.user.id, req.user.role);
      if (!allowed) { res.status(404).json({ error: 'Property not found.' }); return; }
      next();
    } catch (error) { next(error); }
  };
}

export function requirePropertyOwner(paramName = 'id') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized.' }); return; }
    try {
      const allowed = canManageProperty(req.user.role, await db.isPropertyOwner(req.params[paramName], req.user.id));
      if (!allowed) { res.status(403).json({ error: 'Only the property owner can perform this action.' }); return; }
      next();
    } catch (error) { next(error); }
  };
}

export async function requireDeviceQueryAccess(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized.' }); return; }
  const deviceId = typeof req.query.deviceId === 'string' ? req.query.deviceId : '';
  if (!deviceId) { res.status(400).json({ error: 'A deviceId query parameter is required.' }); return; }
  try {
    const propertyId = await db.getPropertyIdForDevice(deviceId);
    if (!propertyId || !(await db.canAccessProperty(propertyId, req.user.id, req.user.role))) {
      res.status(404).json({ error: 'Device not found.' }); return;
    }
    next();
  } catch (error) { next(error); }
}

export function requireDeviceAccess(paramName = 'id') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized.' }); return; }
    try {
      const propertyId = await db.getPropertyIdForDevice(req.params[paramName]);
      const allowed = propertyId !== null && await db.canAccessProperty(propertyId, req.user.id, req.user.role);
      if (!allowed) { res.status(404).json({ error: 'Device not found.' }); return; }
      next();
    } catch (error) { next(error); }
  };
}

export function requireDeviceOwner(paramName = 'id') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized.' }); return; }
    try {
      const propertyId = await db.getPropertyIdForDevice(req.params[paramName]);
      const allowed = propertyId !== null && canControlDevice(req.user.role, await db.isPropertyOwner(propertyId, req.user.id));
      if (!allowed) { res.status(404).json({ error: 'Device not found.' }); return; }
      next();
    } catch (error) { next(error); }
  };
}

export function requireZoneAccess(paramName = 'id', ownerOnly = false) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized.' }); return; }
    try {
      const propertyId = await db.getPropertyIdForZone(req.params[paramName]);
      const allowed = propertyId !== null && (ownerOnly
        ? canManageProperty(req.user.role, await db.isPropertyOwner(propertyId, req.user.id))
        : await db.canAccessProperty(propertyId, req.user.id, req.user.role));
      if (!allowed) { res.status(404).json({ error: 'Zone not found.' }); return; }
      next();
    } catch (error) { next(error); }
  };
}

export function requireIncidentOwner(paramName = 'id') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized.' }); return; }
    try {
      const incident = await db.getIncidentById(req.params[paramName]);
      if (!incident) { res.status(404).json({ error: 'Incident not found.' }); return; }
      const allowed = canResolveIncident(req.user.role, await db.isPropertyOwner(incident.propertyId, req.user.id));
      if (!allowed) { res.status(403).json({ error: 'Only the property owner or system administrator can resolve incidents.' }); return; }
      next();
    } catch (error) { next(error); }
  };
}

export function requireIncidentAccess(paramName = 'id') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) { res.status(401).json({ error: 'Unauthorized.' }); return; }
    try {
      const incident = await db.getIncidentById(req.params[paramName]);
      const allowed = incident !== null && await db.canAccessProperty(incident.propertyId, req.user.id, req.user.role);
      if (!allowed) { res.status(404).json({ error: 'Incident not found.' }); return; }
      next();
    } catch (error) { next(error); }
  };
}
