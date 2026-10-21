import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /** Behind a reverse proxy: take client addresses (for join rate limits) from X-Forwarded-For. */
  TRUST_PROXY: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  UPLOAD_DIR: z.string().min(1).default('./uploads'),
  PUBLIC_API_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    .transform((url) => url.replace(/\/+$/, '')),
  /** Accounts with these emails are admins (comma-separated). */
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  /** When true, only admins may create, edit, import or delete quizzes. Hosting and playing stay open to everyone. */
  RESTRICT_QUIZ_EDITING: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
  /** Signs login tokens. Required in production; development falls back to a fixed, public value. */
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
});

const DEV_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me-0123456789';

const envSchemaWithDefaults = envSchema
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && !env.JWT_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['JWT_SECRET'], message: 'is required in production' });
    }
  })
  .transform((env) => ({ ...env, JWT_SECRET: env.JWT_SECRET ?? DEV_JWT_SECRET }));

export type Env = z.output<typeof envSchemaWithDefaults>;

/** Used by ConfigModule; fails fast at boot with a readable message. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchemaWithDefaults.safeParse(config);
  if (!result.success) {
    const details = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}
