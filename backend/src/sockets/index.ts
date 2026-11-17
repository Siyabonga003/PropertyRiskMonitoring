import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { setSocketServer } from './emitter';
import { SOCKET_EVENTS } from '../config/constants';
import { db } from '../database/db';
import { mqttPublisher } from '../mqtt/publisher';
import { AuthenticatedUser } from '../api/middlewares/auth';
import { canControlDevice } from '../api/middlewares/accessPolicy';

interface AuthSocket extends Socket { data: Socket['data'] & { user?: AuthenticatedUser; tokenExpiresAt?: number } }

export function initializeSockets(server: HttpServer): Server {
  const origins = env.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean);
  const io = new Server(server, {
    cors: { origin: origins.length ? origins : false, methods: ['GET', 'POST'], credentials: true },
  });

  io.use(async (socket: AuthSocket, next) => {
    const authToken = socket.handshake.auth?.token;
    const authorization = socket.handshake.headers.authorization;
    const token = typeof authToken === 'string' ? authToken : typeof authorization === 'string' ? authorization.replace(/^Bearer\s+/i, '') : '';
    if (!token) { next(new Error('Authentication required.')); return; }
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { id?: string; exp?: number };
      if (!payload.id) { next(new Error('Invalid authentication token.')); return; }
      const user = await db.findUserById(payload.id);
      if (!user) { next(new Error('Account not found.')); return; }
      socket.data.user = { id: user.id, email: user.email, name: user.name, role: user.role };
      socket.data.tokenExpiresAt = payload.exp;
      next();
    } catch { next(new Error('Invalid or expired authentication token.')); }
  });

  setSocketServer(io);
  io.on('connection', async (socket: AuthSocket) => {
    const user = socket.data.user!;
    const userRoom = `user:${user.id}`;
    await socket.join(userRoom);
    const properties = await db.getPropertiesForUser(user.id, user.role);
    await socket.join(properties.map((property) => `property:${property.id}`));
    console.log(`[Socket.IO] Authenticated client connected: ${socket.id} (${user.id})`);

    if (socket.data.tokenExpiresAt) {
      const delayMs = Math.max(0, socket.data.tokenExpiresAt * 1000 - Date.now());
      setTimeout(() => socket.disconnect(true), delayMs).unref?.();
    }

    socket.on(SOCKET_EVENTS.JOIN_PROPERTY, async (propertyId: unknown) => {
      if (typeof propertyId !== 'string' || propertyId.length === 0) return;
      if (!(await db.canAccessProperty(propertyId, user.id, user.role))) {
        socket.emit('property:access_denied', { propertyId });
        return;
      }
      const room = `property:${propertyId}`;
      await socket.join(room);
      socket.emit('joined', { room, timestamp: new Date() });
    });

    socket.on(SOCKET_EVENTS.LEAVE_PROPERTY, async (propertyId: unknown) => {
      if (typeof propertyId === 'string') await socket.leave(`property:${propertyId}`);
    });

    const commandAllowed = async (deviceId: unknown) => {
      if (typeof deviceId !== 'string') return false;
      const propertyId = await db.getPropertyIdForDevice(deviceId);
      if (!propertyId) return false;
      return canControlDevice(user.role, await db.isPropertyOwner(propertyId, user.id));
    };
    socket.on(SOCKET_EVENTS.TRIGGER_BUZZER, async (data: { deviceId?: string; durationMs?: number } = {}) => {
      if (!(await commandAllowed(data.deviceId))) { socket.emit('command:denied', { deviceId: data.deviceId }); return; }
      await mqttPublisher.triggerBuzzer(data.deviceId!, Math.min(Math.max(data.durationMs || 10000, 1000), 60000));
    });
    socket.on(SOCKET_EVENTS.SILENCE_BUZZER, async (data: { deviceId?: string } = {}) => {
      if (!(await commandAllowed(data.deviceId))) { socket.emit('command:denied', { deviceId: data.deviceId }); return; }
      await mqttPublisher.silenceBuzzer(data.deviceId!);
    });
    socket.on('disconnect', (reason) => console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`));
  });

  return io;
}
