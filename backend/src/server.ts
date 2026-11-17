import express, { Application, Request, Response } from 'express';
import http from 'http';
import cors from 'cors';
import { env } from './config/env';
import { checkPrismaConnection } from './database/prisma';
import { initializeMqtt, getMqttClient } from './mqtt/client';
import { embeddedBroker } from './mqtt/broker';
import { initializeSockets } from './sockets';
import { errorHandler } from './api/middlewares/errorHandler';

// Route imports
import authRoutes from './api/routes/auth.routes';
import propertiesRoutes from './api/routes/properties.routes';
import zonesRoutes from './api/routes/zones.routes';
import devicesRoutes from './api/routes/devices.routes';
import telemetryRoutes from './api/routes/telemetry.routes';
import incidentsRoutes from './api/routes/incidents.routes';
import adminRoutes from './api/routes/admin.routes';

// Workers
import { rollupWorker } from './workers/rollups';
import { heartbeatMonitor } from './workers/heartbeatMonitor';

export async function createServer(): Promise<{ app: Application; server: http.Server }> {
  const app: Application = express();

  // Middleware
  app.use(
    cors({
      origin: env.CLIENT_URL.split(',').map((origin) => origin.trim()).filter(Boolean),
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root & Health check
  app.get('/', (req: Request, res: Response) => {
    res.json({
      name: 'Property Risk Monitoring Backend API',
      status: 'operational',
      version: '1.0.0',
      timestamp: new Date(),
    });
  });

  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date(),
      mqttBrokerRunning: embeddedBroker.running,
      mqttClientConnected: getMqttClient()?.connected ?? false,
    });
  });

  // Mount API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/properties', propertiesRoutes);
  app.use('/api/zones', zonesRoutes);
  app.use('/api/devices', devicesRoutes);
  app.use('/api/telemetry', telemetryRoutes);
  app.use('/api/incidents', incidentsRoutes);
  app.use('/api/admin', adminRoutes);

  // Error handling middleware
  app.use(errorHandler);

  const server = http.createServer(app);
  return { app, server };
}

export async function startServer() {
  console.log('='.repeat(65));
  console.log('  🛡  PROPERTY RISK MONITORING BACKEND SERVICE');
  console.log('='.repeat(65));

  const { server } = await createServer();

  // 1. Initialize WebSockets
  initializeSockets(server);
  console.log('✔ [Socket.IO] Real-time engine initialized.');

  // 2. Database Connection Check
  const isPostgresReady = await checkPrismaConnection();
  if (!isPostgresReady && env.NODE_ENV === 'production') {
    throw new Error('PostgreSQL is required in production; refusing to start with development in-memory data.');
  }
  if (isPostgresReady) {
    // Optionally trigger seed if needed
    try {
      const { seedDatabase } = await import('./database/seed');
      await seedDatabase();
    } catch (e: any) {
      console.log('[Seed] Notice:', e.message);
    }
  }

  // 3. Initialize MQTT Broker & Client
  await initializeMqtt();

  // 4. Start Background Workers
  rollupWorker.start();
  heartbeatMonitor.start();

  // 5. Start HTTP Listener
  server.listen(env.PORT, () => {
    console.log(`🚀 [Server] HTTP API listening on http://localhost:${env.PORT}`);
    console.log(`📡 [MQTT] Ingestion service ready on port ${env.MQTT_PORT}`);
    console.log(`🔌 [WebSockets] Real-time gateway ready`);
    console.log('='.repeat(65));
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Commencing graceful shutdown...`);
    rollupWorker.stop();
    heartbeatMonitor.stop();

    const client = getMqttClient();
    if (client) {
      client.end(true);
    }

    await embeddedBroker.stop();

    server.close(() => {
      console.log('✔ [Server] HTTP listener closed. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Fatal startup error:', err);
    process.exit(1);
  });
}
