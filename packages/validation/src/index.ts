import { z } from 'zod';
import { Category, Importance } from '@deltaora/shared-types';
import { APP_CONFIG } from '@deltaora/config';

// Mirrors the server-side COMMON_PASSWORDS set in passwordPolicy.service.ts
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '12345678', '123456789',
  '1234567890', 'qwerty123', 'letmein123', 'adminadmin', 'welcome123',
  'changeme', 'iloveyou', 'deltaora', 'deltaora123', 'deltaoradeltaora',
  'changeme123', 'defaultpassword', 'newpassword', 'newpassword123',
  'passwordpassword',
]);

const stripNonAlphanumeric = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

export const passwordRules = {
  minLength: APP_CONFIG.PASSWORD_MIN_LENGTH,
  maxLength: APP_CONFIG.PASSWORD_MAX_LENGTH,
};

/**
 * Validates a password against all local policy rules given optional context.
 * Returns an array of error messages (empty = valid).
 */
export const validatePasswordLocally = (
  password: string,
  context: { email?: string; name?: string } = {}
): string[] => {
  const rules = checkPasswordRules(password, context);
  const errors: string[] = [];

  if (!rules.hasMinLength) errors.push(`Password must be at least ${APP_CONFIG.PASSWORD_MIN_LENGTH} characters.`);
  if (!rules.notTooLong)   errors.push('Password is too long.');
  if (!rules.notCommon)    errors.push('Choose a less common password.');
  if (!rules.notContainsEmail) errors.push('Password must not contain your email address.');
  if (!rules.notContainsName)  errors.push('Password must not contain your name.');

  return errors;
};

/**
 * Structured per-rule result used by the UI checklist.
 * Avoids fragile string-matching on error messages.
 */
export interface PasswordRuleResult {
  hasMinLength: boolean;
  notTooLong: boolean;
  notCommon: boolean;
  notContainsEmail: boolean;
  notContainsName: boolean;
}

export const checkPasswordRules = (
  password: string,
  context: { email?: string; name?: string } = {}
): PasswordRuleResult => {
  const normalized = password.normalize('NFC');
  const lower = normalized.toLowerCase();

  const emailParts = context.email?.toLowerCase().split('@');
  const emailLocal = emailParts?.[0];
  const emailDomain = emailParts?.[1]?.split('.')[0];

  const containsEmail = !!(
    (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) ||
    (emailDomain && emailDomain.length >= 4 && lower.includes(emailDomain))
  );

  const nameParts = context.name
    ? context.name.toLowerCase().split(/[\s_-]+/).map(stripNonAlphanumeric).filter(p => p.length >= 4)
    : [];
  const containsName = nameParts.some(part => stripNonAlphanumeric(lower).includes(part));

  return {
    hasMinLength:     normalized.length >= APP_CONFIG.PASSWORD_MIN_LENGTH,
    notTooLong:       normalized.length <= APP_CONFIG.PASSWORD_MAX_LENGTH,
    notCommon:        !COMMON_PASSWORDS.has(lower),
    notContainsEmail: !containsEmail,
    notContainsName:  !containsName,
  };
};

/**
 * Returns a strength score 0–4 and a label for use in the UI strength meter.
 */
export const getPasswordStrength = (
  password: string,
  context: { email?: string; name?: string } = {}
): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } => {
  if (!password) return { score: 0, label: '', color: '' };

  const errors = validatePasswordLocally(password, context);
  if (errors.length > 0) return { score: 1, label: 'Weak', color: 'bg-red-500' };

  let score = 0;
  if (password.length >= 15) score++;
  if (password.length >= 24) score++;
  if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500' };
  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-orange-400' };
  if (score === 3) return { score: 3, label: 'Good', color: 'bg-yellow-400' };
  return { score: 4, label: 'Strong', color: 'bg-green-500' };
};

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(50),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(APP_CONFIG.PASSWORD_MIN_LENGTH, `Password must be at least ${APP_CONFIG.PASSWORD_MIN_LENGTH} characters`)
    .max(APP_CONFIG.PASSWORD_MAX_LENGTH, 'Password is too long'),
  confirmPassword: z.string(),
}).superRefine((data, ctx) => {
  // Use structured rule check — no fragile string matching
  const rules = checkPasswordRules(data.password, { email: data.email, name: data.name });

  if (!rules.notCommon) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Choose a less common password.', path: ['password'] });
  }
  if (!rules.notContainsEmail) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password must not contain your email address.', path: ['password'] });
  }
  if (!rules.notContainsName) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Password must not contain your name.', path: ['password'] });
  }

  if (data.password !== data.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords don't match", path: ['confirmPassword'] });
  }
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const selectorSchema = z.string().min(1).max(240);
const urlPatternSchema = z.string().min(1).max(500);
const recipeTimeoutSchema = z.number().int().min(100).max(60000).optional();
const recipeStepSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('waitForSelector'), selector: selectorSchema, timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('click'), selector: selectorSchema, timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('clickText'), text: z.string().min(1).max(120), timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('fill'), selector: selectorSchema, value: z.string().max(5000), timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('selectOption'), selector: selectorSchema, value: z.string().max(500), timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('check'), selector: selectorSchema, timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('uncheck'), selector: selectorSchema, timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('press'), selector: selectorSchema, key: z.string().min(1).max(80), timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('hover'), selector: selectorSchema, timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('waitForURL'), pattern: urlPatternSchema, timeoutMs: recipeTimeoutSchema }).strict(),
  z.object({ action: z.literal('waitMs'), value: z.number().int().min(0).max(15000) }).strict(),
  z.object({ action: z.literal('scrollToBottom') }).strict(),
]);

const crawlerCookieSchema = z.object({
  name: z.string().min(1).max(200),
  value: z.string().max(5000),
  domain: z.string().max(255).optional(),
  path: z.string().max(2000).optional(),
  expires: z.number().optional(),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(['Strict', 'Lax', 'None']).optional(),
});

const crawlerAuthSchema = z.object({
  headers: z.record(z.string().min(1).max(120), z.string().max(5000)).optional(),
  cookies: z.array(crawlerCookieSchema).max(100).optional(),
  storageState: z.record(z.unknown()).optional(),
}).strict();

export const crawlerConfigSchema = z.object({
  authSessionId: z.string().min(1).max(120).optional(),
  respectRobots: z.boolean().optional(),
  discovery: z.object({
    enabled: z.boolean().optional(),
    maxDepth: z.number().int().min(0).max(5).optional(),
    maxPages: z.number().int().min(1).max(500).optional(),
    includeSubdomains: z.boolean().optional(),
    includeSitemaps: z.boolean().optional(),
    includeFeeds: z.boolean().optional(),
    followCanonical: z.boolean().optional(),
  }).strict().optional(),
  extraction: z.object({
    includeSelectors: z.array(selectorSchema).max(25).optional(),
    excludeSelectors: z.array(selectorSchema).max(50).optional(),
  }).strict().optional(),
  behavior: z.object({
    waitForSelector: selectorSchema.optional(),
    clickSelectors: z.array(selectorSchema).max(20).optional(),
    clickText: z.array(z.string().min(1).max(120)).max(20).optional(),
    steps: z.array(recipeStepSchema).max(50).optional(),
    scrollToBottom: z.boolean().optional(),
    acceptCookieBanners: z.boolean().optional(),
    waitAfterLoadMs: z.number().int().min(0).max(15000).optional(),
    locale: z.string().min(2).max(35).optional(),
    timezoneId: z.string().min(1).max(80).optional(),
  }).strict().optional(),
  pagination: z.object({
    nextSelector: selectorSchema.optional(),
    nextText: z.string().min(1).max(120).optional(),
    maxPages: z.number().int().min(1).max(50).optional(),
    waitForSelector: selectorSchema.optional(),
  }).strict().optional(),
  apiCapture: z.object({
    enabled: z.boolean().optional(),
    mode: z.enum(['append', 'prefer']).optional(),
    maxResponses: z.number().int().min(1).max(50).optional(),
    includeUrlPatterns: z.array(urlPatternSchema).max(25).optional(),
    excludeUrlPatterns: z.array(urlPatternSchema).max(25).optional(),
  }).strict().optional(),
  content: z.object({
    screenshotDiff: z.boolean().optional(),
    binaryFingerprint: z.boolean().optional(),
  }).strict().optional(),
  compliance: z.object({
    robotsPolicy: z.enum(['respect', 'ignore']).optional(),
    blockedHandling: z.enum(['fail', 'manual_review']).optional(),
  }).strict().optional(),
  auth: crawlerAuthSchema.optional(),
}).strict();

export const discoverSiteSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  maxDepth: z.number().int().min(0).max(5).default(1),
  maxPages: z.number().int().min(1).max(500).default(100),
  includeSubdomains: z.boolean().default(false),
  includeSitemaps: z.boolean().default(true),
  includeFeeds: z.boolean().default(true),
  respectRobots: z.boolean().default(true),
});

export const createCrawlerAuthSessionSchema = z.object({
  name: z.string().min(1).max(100),
  origin: z.string().url("Must be a valid origin URL"),
  storageState: z.record(z.unknown()),
});

export const createPageSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  title: z.string().min(1, "Title is required").max(100),
  category: z.enum(Object.values(Category) as [string, ...string[]]).default(Category.GENERAL),
  importance: z.enum(Object.values(Importance) as [string, ...string[]]).default(Importance.MEDIUM),
  checkInterval: z.number().min(APP_CONFIG.MIN_CHECK_INTERVAL).max(APP_CONFIG.MAX_CHECK_INTERVAL).default(APP_CONFIG.DEFAULT_CHECK_INTERVAL),
  crawlerConfig: crawlerConfigSchema.optional(),
});

export const updatePageSchema = createPageSchema.partial();

// Inferred types for consumer convenience
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreatePageInput = z.infer<typeof createPageSchema>;
export type UpdatePageInput = z.infer<typeof updatePageSchema>;
export type CrawlerConfigInput = z.infer<typeof crawlerConfigSchema>;
export type DiscoverSiteInput = z.infer<typeof discoverSiteSchema>;
export type CreateCrawlerAuthSessionInput = z.infer<typeof createCrawlerAuthSessionSchema>;
