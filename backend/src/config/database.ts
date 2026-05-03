import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? [{ emit: 'event', level: 'query' }, 'error', 'warn']
      : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  // Install immutability triggers after migrations
  await prisma.$executeRawUnsafe('SELECT setup_audit_log_immutability()').catch(() => {
    // Function may not exist yet on first boot before init.sql runs — ignore
  });
  await prisma.$executeRawUnsafe('SELECT setup_resource_status_history_immutability()').catch(() => {
    // Same — safe to ignore on first boot
  });
  logger.info('Database connected');
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
