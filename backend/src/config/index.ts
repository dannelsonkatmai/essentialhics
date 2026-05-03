import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRY: z.string().default('8h'),
  ENCRYPTION_KEY: z.string().length(64), // 32-byte hex → 64 chars
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z.string().transform((v) => v === 'true').default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('Essential HICS <noreply@hics.local>'),
  AZURE_AD_TENANT_ID: z.string().optional(),
  AZURE_AD_CLIENT_ID: z.string().optional(),
  AZURE_AD_CLIENT_SECRET: z.string().optional(),
  AZURE_AD_REDIRECT_URI: z.string().optional(),
  OKTA_DOMAIN: z.string().optional(),
  OKTA_CLIENT_ID: z.string().optional(),
  OKTA_CLIENT_SECRET: z.string().optional(),
  OKTA_REDIRECT_URI: z.string().optional(),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(10),
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_REFRESH_MAX: z.coerce.number().default(30),
  RATE_LIMIT_REFRESH_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_RESET_MAX: z.coerce.number().default(5),
  RATE_LIMIT_RESET_WINDOW_MS: z.coerce.number().default(3600000),
  // MinIO (Phase 2 — PDF export object storage)
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.coerce.number().default(9000),
  MINIO_USE_SSL: z.string().transform((v) => v === 'true').default('false'),
  MINIO_ACCESS_KEY: z.string().default('hics_minio'),
  MINIO_SECRET_KEY: z.string().default('hics_minio_secret'),
  MINIO_BUCKET: z.string().default('hics-exports'),
  MINIO_SIGNED_URL_EXPIRY: z.coerce.number().default(259200), // 72 hours
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:\n', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
export type Config = typeof config;
