import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { env } from '../config/env';
import { setSocketServer } from './emitter';
import { SOCKET_EVENTS } from '../config/constants';
import { db } from '../database/db';
import { mqttPublisher } from '../mqtt/publisher';

export function initializeSockets(server: HttpServer): Server {
  const io = new Server(server, {
    cors: {
      origin: '*', // Allow frontend development server
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
  });

  setSocketServer(io);

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 [Socket.IO] Client connected: ${socket.id}`);

    // Join property room
    socket.on(SOCKET_EVENTS.JOIN_PROPERTY, (propertyId: string) => {
      const room = `property:${propertyId}`;
      socket.join(room);
      console.log(`[Socket.IO] Client ${socket.id} joined room: ${room}`);
      socket.emit('joined', { room, timestamp: new Date() });
    });

    // Leave property room
    socket.on(SOCKET_EVENTS.LEAVE_PROPERTY, (propertyId: string) => {
      const room = `property:${propertyId}`;
      socket.leave(room);
      console.log(`[Socket.IO] Client ${socket.id} left room: ${room}`);
    });

    // Interactive Buzzer Trigger from Dashboard
    socket.on(SOCKET_EVENTS.TRIGGER_BUZZER, async (data: { deviceId: string; durationMs?: number }) => {
      console.log(`📢 [Socket.IO] Manual buzzer trigger requested for device: ${data.deviceId}`);
      await mqttPublisher.triggerBuzzer(data.deviceId, data.durationMs || 10000);
    });

    // Interactive Buzzer Silence from Dashboard
    socket.on(SOCKET_EVENTS.SILENCE_BUZZER, async (data: { deviceId: string }) => {
      console.log(`🔇 [Socket.IO] Manual buzzer silence requested for device: ${data.deviceId}`);
      await mqttPublisher.silenceBuzzer(data.deviceId);
    });

    socket.on('disconnect', (reason) => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  return io;
}
