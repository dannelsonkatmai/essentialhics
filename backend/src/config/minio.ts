import * as Minio from 'minio';
import { config } from './index';
import { logger } from './logger';

export const minioClient = new Minio.Client({
  endPoint: config.MINIO_ENDPOINT,
  port: config.MINIO_PORT,
  useSSL: config.MINIO_USE_SSL,
  accessKey: config.MINIO_ACCESS_KEY,
  secretKey: config.MINIO_SECRET_KEY,
});

export const BUCKET = config.MINIO_BUCKET;
export const SIGNED_URL_EXPIRY = config.MINIO_SIGNED_URL_EXPIRY; // seconds

export async function ensureBucket(): Promise<void> {
  try {
    const exists = await minioClient.bucketExists(BUCKET);
    if (!exists) {
      await minioClient.makeBucket(BUCKET, 'us-east-1');
      logger.info(`MinIO bucket '${BUCKET}' created`);
    }
  } catch (err) {
    logger.error('MinIO bucket init error', err);
    throw err;
  }
}

export async function uploadBuffer(
  objectName: string,
  buffer: Buffer,
  contentType: string,
): Promise<void> {
  await minioClient.putObject(BUCKET, objectName, buffer, buffer.length, {
    'Content-Type': contentType,
  });
}

export async function getSignedUrl(objectName: string): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, objectName, SIGNED_URL_EXPIRY);
}
