import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  setupMfa,
  verifyMfa,
  stepUp,
  forgotPassword,
  resetPassword,
  sendVerificationEmail,
  verifyEmail,
  googleLogin,
  startPasskeyRegistration,
  verifyPasskeyRegistration,
  startPasskeyAuthentication,
  verifyPasskeyAuthentication,
} from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth, requireRecentStepUp, requireVerifiedEmail } from '../middleware/auth';
import { issueCsrfToken } from '../middleware/csrf';
import { registerSchema, loginSchema } from '@deltaora/validation';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../config/redis';
import { z } from 'zod';

const router = Router();

/**
 * Creates a Redis-backed rate limiter with an isolated key prefix per endpoint.
 * Each limiter has its own independent counter — limits on /register never
 * affect /login or any other endpoint.
 *
 * IP-based limiters use express-rate-limit's ipKeyGenerator helper which
 * correctly normalises IPv6 addresses to prevent bypass via address variants.
 */
function makeRedisLimiter(options: {
  prefix: string;         // unique per endpoint — prevents counter bleed
  windowMs: number;
  max: number;
  message: string;
  keyGenerator?: (req: any) => string;
}) {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: 'draft-8', // RateLimit header (2026 IETF draft standard)
    legacyHeaders: false,
    message: { error: options.message },
    // ipKeyGenerator normalises IPv6 (e.g. ::ffff:1.2.3.4 → 1.2.3.4) so
    // users cannot bypass limits by switching between address formats.
    keyGenerator: options.keyGenerator ?? ((req) => ipKeyGenerator(req)),
    store: new RedisStore({
      prefix: `rl:${options.prefix}:`,
      sendCommand: (...args: string[]) => (redis as any).call(...args),
    }),
  });
}

// ── Per-endpoint limiters (all independent — no shared counters) ────────────

// Registration: 5 attempts per IP per 15 min (account creation abuse prevention)
const registerLimiter = makeRedisLimiter({
  prefix: 'register',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many registration attempts. Please try again in 15 minutes.',
});

// Login (by IP): 20 attempts per IP per 15 min — allows real users to mistype
// without getting locked out, while still blocking automated spraying.
const loginIpLimiter = makeRedisLimiter({
  prefix: 'login_ip',
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts. Please try again in 15 minutes.',
});

// Login (by target email): 10 attempts per account per 15 min — stops
// distributed brute-force from many IPs targeting a single account.
const loginEmailLimiter = makeRedisLimiter({
  prefix: 'login_email',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts for this account. Please try again in 15 minutes.',
  keyGenerator: (req) => `${req.body?.email ?? 'unknown'}`,
});

// Forgot password: 3 per IP per hour (strict — unauthenticated enumeration vector)
const forgotPasswordLimiter = makeRedisLimiter({
  prefix: 'forgot_pw',
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Too many password reset requests. Please try again in an hour.',
});

// Reset password: 5 per IP per 15 min (token already required, so slightly looser)
const resetPasswordLimiter = makeRedisLimiter({
  prefix: 'reset_pw',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many password reset attempts. Please try again in 15 minutes.',
});

// Passkey authentication: 10 per IP per 15 min
const passkeyLimiter = makeRedisLimiter({
  prefix: 'passkey_auth',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many passkey authentication attempts. Please try again in 15 minutes.',
});

router.post('/register', registerLimiter, validate(registerSchema), register);
router.get('/csrf', issueCsrfToken);

// Accept optional mfaCode for 2FA
const mfaLoginSchema = loginSchema.extend({
  mfaCode: z.string().optional(),
  recoveryCode: z.string().optional()
});
router.post('/login', loginIpLimiter, loginEmailLimiter, validate(mfaLoginSchema), login);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: New access token generated
 *       401:
 *         description: Invalid or missing refresh token
 */
router.post('/refresh', refresh);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
router.post('/logout', logout);

// ── MFA Routes ──
router.post('/mfa/setup', requireAuth, requireRecentStepUp(), setupMfa);
router.post('/mfa/verify', requireAuth, validate(z.object({ code: z.string().length(6) })), verifyMfa);
router.post('/step-up', requireAuth, validate(z.object({
  currentPassword: z.string().optional(),
  mfaCode: z.string().optional(),
  recoveryCode: z.string().optional(),
})), stepUp);

// ── Account Recovery ──
router.post('/forgot-password', forgotPasswordLimiter, validate(z.object({ email: z.string().email() })), forgotPassword);
router.post('/reset-password', resetPasswordLimiter, validate(z.object({ token: z.string(), newPassword: z.string().min(15).max(1024) })), resetPassword);

// ── Email Verification & Google Auth ──
router.post('/send-verification', requireAuth, sendVerificationEmail);
router.post('/verify-email', validate(z.object({ token: z.string() })), verifyEmail);
router.post('/google', validate(z.object({ token: z.string() })), googleLogin);

// Passkeys / phishing-resistant MFA
router.post('/passkeys/register/options', requireAuth, requireVerifiedEmail, requireRecentStepUp(), startPasskeyRegistration);
router.post(
  '/passkeys/register/verify',
  requireAuth,
  requireVerifiedEmail,
  requireRecentStepUp(),
  validate(z.object({ credential: z.any(), name: z.string().max(80).optional() })),
  verifyPasskeyRegistration
);
router.post(
  '/passkeys/authenticate/options',
  passkeyLimiter,
  validate(z.object({ email: z.string().email() })),
  startPasskeyAuthentication
);
router.post(
  '/passkeys/authenticate/verify',
  passkeyLimiter,
  validate(z.object({ credential: z.any() })),
  verifyPasskeyAuthentication
);

export default router;
