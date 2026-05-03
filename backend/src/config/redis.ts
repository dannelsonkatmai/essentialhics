import Redis from 'ioredis';
import { config } from './index';
import { logger } from './logger';

export const redis = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  enableReadyCheck: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { err }));
redis.on('close', () => logger.warn('Redis connection closed'));

export async function connectRedis(): Promise<void> {
  await redis.connect();
}

// Key helpers
export const redisKeys = {
  refreshTokenBlacklist: (tokenHash: string) => `blacklist:rt:${tokenHash}`,
  userSessionCount: (userId: string) => `session:count:${userId}`,
  loginAttempts: (ip: string) => `login:attempts:${ip}`,
  passwordResetToken: (tokenHash: string) => `prt:${tokenHash}`,
  mfaPending: (userId: string) => `mfa:pending:${userId}`,
} as const;
