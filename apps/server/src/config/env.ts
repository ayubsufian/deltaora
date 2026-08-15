import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' }); // Load from root

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000'),
  
  // MongoDB
  MONGODB_URI: z.string().min(1, 'MongoDB URI is required'),
  
  // Redis
  REDIS_URL: z.string().min(1, 'Redis URL is required'),
  
  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  CSRF_SECRET: z.string().min(32, 'CSRF_SECRET must be at least 32 characters'),
  MFA_SECRET_ENCRYPTION_KEY: z.string().min(32, 'MFA_SECRET_ENCRYPTION_KEY must be at least 32 characters'),
  GOOGLE_CLIENT_ID: z.string().min(1, 'GOOGLE_CLIENT_ID is required for SSO'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  WEBAUTHN_RP_ID: z.string().optional(),
  WEBAUTHN_ORIGIN: z.string().url().optional(),
  PASSWORD_BREACH_SCREENING_MODE: z.enum(['api', 'local', 'disabled']).default('api'),
  PASSWORD_BREACH_SCREENING_FAILURE_POLICY: z.enum(['block', 'allow']).default('block'),
  PASSWORD_BREACH_SCREENING_TIMEOUT_MS: z.coerce.number().int().positive().max(10_000).default(3000),
  PASSWORD_BREACH_SCREENING_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).max(604_800).default(86_400),
  PASSWORD_BREACH_SCREENING_CACHE_MAX_PREFIXES: z.coerce.number().int().min(0).max(65_536).default(4096),
  PASSWORD_BREACH_SCREENING_LOCAL_DIR: z.string().optional(),
  PWNED_PASSWORDS_RANGE_URL: z.string().url().default('https://api.pwnedpasswords.com/range'),
  PWNED_PASSWORDS_USER_AGENT: z.string().min(8).default('Deltaora password breach screening'),
  
  // AI API Key
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  
  // Scraping Proxy
  PROXY_URL: z.string().optional(),
  
  // Brevo Email
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.PASSWORD_BREACH_SCREENING_MODE === 'local' && !value.PASSWORD_BREACH_SCREENING_LOCAL_DIR) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PASSWORD_BREACH_SCREENING_LOCAL_DIR'],
      message: 'PASSWORD_BREACH_SCREENING_LOCAL_DIR is required when PASSWORD_BREACH_SCREENING_MODE=local',
    });
  }

  if (value.NODE_ENV === 'production' && value.PASSWORD_BREACH_SCREENING_MODE === 'disabled') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PASSWORD_BREACH_SCREENING_MODE'],
      message: 'Password breach screening cannot be disabled in production',
    });
  }

  if (value.NODE_ENV === 'production' && value.PASSWORD_BREACH_SCREENING_FAILURE_POLICY !== 'block') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['PASSWORD_BREACH_SCREENING_FAILURE_POLICY'],
      message: 'Production password breach screening must fail closed with PASSWORD_BREACH_SCREENING_FAILURE_POLICY=block',
    });
  }
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
