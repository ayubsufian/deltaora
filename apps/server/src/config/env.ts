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
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  
  // AI API Key
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
  
  // Scraping Proxy
  PROXY_URL: z.string().optional(),
  
  // SMTP Config for Nodemailer
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
