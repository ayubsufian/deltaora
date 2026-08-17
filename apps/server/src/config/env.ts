import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' }); // Load from root

const booleanFromEnv = (defaultValue: boolean) =>
  z.preprocess(value => {
    if (value === undefined || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      if (['true', '1', 'yes', 'on'].includes(value.toLowerCase())) return true;
      if (['false', '0', 'no', 'off'].includes(value.toLowerCase())) return false;
    }
    return value;
  }, z.boolean());

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
  CRAWLER_USER_AGENT: z.string().min(8).default('DeltaoraBot/1.0 (+https://deltaora.local/crawler)'),
  CRAWLER_CONTACT_URL: z.string().url().optional(),
  CRAWLER_RESPECT_ROBOTS: booleanFromEnv(true),
  CRAWLER_ALLOW_PRIVATE_NETWORKS: booleanFromEnv(false),
  CRAWLER_PRIVATE_NETWORK_ALLOWLIST: z.string().optional(),
  CRAWLER_ROBOTS_UNAVAILABLE_POLICY: z.enum(['fail_closed', 'fail_open']).default('fail_closed'),
  CRAWLER_MAX_BYTES: z.coerce.number().int().positive().max(50_000_000).default(10_000_000),
  CRAWLER_MAX_REDIRECTS: z.coerce.number().int().min(0).max(10).default(5),
  CRAWLER_MIN_HOST_DELAY_MS: z.coerce.number().int().min(0).max(300_000).default(5000),
  CRAWLER_ROBOTS_CACHE_SECONDS: z.coerce.number().int().positive().max(86_400).default(3600),
  CRAWLER_ROBOTS_MAX_BYTES: z.coerce.number().int().positive().max(1_000_000).default(512_000),
  
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
