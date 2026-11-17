import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { db } from '../../database/db';
import { env } from '../../config/env';
import { validateBody } from '../middlewares/validate';
import { authenticateToken, AuthenticatedRequest } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();
const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().trim().min(2).max(120),
}).strict();
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) }).strict();
const pushTokenSchema = z.object({
  token: z.string().min(20).max(4096),
  platform: z.enum(['android', 'ios', 'web']),
  enabled: z.boolean().optional(),
}).strict();
const removePushTokenSchema = z.object({ token: z.string().min(20).max(4096) }).strict();

function issueToken(user: { id: string; email: string; role: Role }) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as any });
}
function publicUser(user: { id: string; email: string; name: string; role: Role }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const email = String(req.body.email).trim().toLowerCase();
    const { password, name } = req.body;
    if (await db.findUserByEmail(email)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }
    const user = await db.createUser({
      email, name: name.trim(), passwordHash: await bcrypt.hash(password, 12),
      // Public registration can create owners only; ADMIN can only be granted
      // through a trusted administrative provisioning process.
      role: Role.PROPERTY_OWNER,
    });
    res.status(201).json({ message: 'User registered successfully', token: issueToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const email = String(req.body.email).trim().toLowerCase();
    const user = await db.findUserByEmail(email);
    if (!user || !(await bcrypt.compare(req.body.password, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    res.json({ message: 'Login successful', token: issueToken(user), user: publicUser(user) });
  } catch (err) { next(err); }
});

router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// FCM registration is tied to the authenticated principal, never a client
// supplied userId. Re-registering a token transfers it to the verified account.
router.post('/push-token', authenticateToken, validateBody(pushTokenSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    const registration = await db.upsertPushToken({
      userId: req.user!.id, token: req.body.token, platform: req.body.platform, enabled: req.body.enabled ?? true,
    });
    res.status(201).json({ id: registration.id, platform: registration.platform, enabled: registration.enabled });
  } catch (err) { next(err); }
});

router.delete('/push-token', authenticateToken, validateBody(removePushTokenSchema), async (req: AuthenticatedRequest, res, next) => {
  try {
    await db.removePushToken(req.user!.id, req.body.token);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
