import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

for (const candidate of [resolve(process.cwd(), '.env.local'), resolve(process.cwd(), '../../.env.local'), resolve(process.cwd(), '.env'), resolve(process.cwd(), '../../.env')]) loadDotenv({ path: candidate, override: false, quiet: true });

const booleanString = z.string().default('false').transform(v => v === 'true');
const optionalString = z.preprocess(value => typeof value === 'string' && value.trim() === '' ? undefined : value, z.string().min(1).optional());
const optionalUrl = z.preprocess(value => typeof value === 'string' && value.trim() === '' ? undefined : value, z.string().url().optional());
const optionalEmailProvider = z.preprocess(
  value => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.enum(['relay', 'smtp', 'none', 'supabase']).optional(),
);
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  MIGRATION_DATABASE_URL: optionalString,
  DATABASE_SSL: booleanString,
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(30).optional(),
  SESSION_SECRET: z.string().min(32),
  LIVEKIT_URL: z.string().min(1),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(6),
  SMTP_HOST: optionalString,
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  SMTP_FROM: optionalString,
  TRUST_PROXY: z.string().default('false'),
  RENDER: optionalString,
  EMAIL_PROVIDER: optionalEmailProvider,
  EMAIL_RELAY_URL: optionalUrl,
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,
});

export type Config = z.infer<typeof schema>;
export function loadConfig(environment: NodeJS.ProcessEnv = process.env): Config {
  const result = schema.safeParse(environment);
  if (!result.success) {
    const fields = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${fields}`);
  }
  return result.data;
}
