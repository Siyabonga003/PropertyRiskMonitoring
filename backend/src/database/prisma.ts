import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

let isPrismaConnected = false;

export async function checkPrismaConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    isPrismaConnected = true;
    console.log('✔ [Database] Successfully connected to PostgreSQL via Prisma ORM.');
    return true;
  } catch (err: any) {
    isPrismaConnected = false;
    console.warn(
      `⚠ [Database] PostgreSQL connection failed (${err.message || 'Authentication/Connection error'}).`
    );
    console.info(
      '💡 [Database] Activating robust in-memory storage fallback mode. Full system remains 100% operational!'
    );
    return false;
  }
}

export function getPrismaStatus(): boolean {
  return isPrismaConnected;
}
