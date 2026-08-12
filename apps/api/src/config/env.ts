import { z } from 'zod';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const emptyToUndef = (value: unknown) => (value === '' || value === undefined ? undefined : value);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().optional(),
  PORT: z.coerce.number().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  MAX_IMAGE_UPLOAD_MB: z.coerce.number().positive().default(20),
  MAX_VIDEO_UPLOAD_MB: z.coerce.number().positive().default(500),
  MAX_DOCUMENT_UPLOAD_MB: z.coerce.number().positive().default(100),
  META_APP_ID: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  META_APP_SECRET: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  META_GRAPH_API_VERSION: z
    .string()
    .regex(/^v\d+(\.\d+)?$/, 'META_GRAPH_API_VERSION ör. v21.0 olmalı')
    .default('v21.0'),
  META_OAUTH_REDIRECT_URI: z.preprocess(emptyToUndef, z.string().url().optional()),
  META_LOGIN_CONFIG_ID: z.preprocess(emptyToUndef, z.string().min(1).optional()),
  SOCIAL_TOKEN_ENCRYPTION_KEY: z.preprocess(emptyToUndef, z.string().min(32).optional()),
  FRONTEND_URL: z.preprocess(emptyToUndef, z.string().url().optional()),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Geçersiz ortam değişkenleri:', parsed.error.flatten().fieldErrors);
  throw new Error('Ortam değişkenleri doğrulanamadı');
}

export const env = {
  ...parsed.data,
  API_PORT: parsed.data.PORT ?? parsed.data.API_PORT ?? 4000,
  FRONTEND_URL: parsed.data.FRONTEND_URL ?? parsed.data.CORS_ORIGIN ?? 'http://localhost:5173',
  META_OAUTH_REDIRECT_URI:
    parsed.data.META_OAUTH_REDIRECT_URI ??
    `http://localhost:${parsed.data.PORT ?? parsed.data.API_PORT ?? 4000}/api/social/meta/oauth/callback`,
};
