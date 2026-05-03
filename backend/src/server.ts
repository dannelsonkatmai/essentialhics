import http from 'http';
import app from './app';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, redis } from './config/redis';
import { ensureBucket } from './config/minio';
import { initSocket } from './socket';
import { startAllCronJobs } from './jobs/scheduler';
import { logger } from './config/logger';

async function start(): Promise<void> {
  await connectDatabase();
  await connectRedis();

  // Ensure MinIO bucket exists (non-fatal — exports will fail gracefully if MinIO is down)
  try {
    await ensureBucket();
  } catch (err) {
    logger.warn('MinIO bucket init failed — PDF exports will be unavailable', err);
  }

  // Wrap express app in an HTTP server so Socket.io can share the port
  const httpServer = http.createServer(app);
  initSocket(httpServer, config.FRONTEND_URL);

  // Start Phase 3 cron jobs
  if (config.NODE_ENV !== 'test') {
    startAllCronJobs();
  }

  httpServer.listen(config.PORT, () => {
    logger.info(`Essential HICS backend listening on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    httpServer.close(async () => {
      await disconnectDatabase();
      await redis.quit();
      logger.info('Server shut down');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
