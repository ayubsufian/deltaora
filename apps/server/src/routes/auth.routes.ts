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
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

const router = Router();

// 2026 Standard: Strict rate limiting to prevent brute-force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: { error: 'Too many authentication attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Authentication endpoints
 */

router.post('/register', authLimiter, validate(registerSchema), register);
router.get('/csrf', issueCsrfToken);

// Accept optional mfaCode for 2FA
const mfaLoginSchema = loginSchema.extend({
  mfaCode: z.string().optional(),
  recoveryCode: z.string().optional()
});
router.post('/login', authLimiter, validate(mfaLoginSchema), login);

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
router.post('/forgot-password', authLimiter, validate(z.object({ email: z.string().email() })), forgotPassword);
router.post('/reset-password', authLimiter, validate(z.object({ token: z.string(), newPassword: z.string().min(15).max(1024) })), resetPassword);

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
  authLimiter,
  validate(z.object({ email: z.string().email() })),
  startPasskeyAuthentication
);
router.post(
  '/passkeys/authenticate/verify',
  authLimiter,
  validate(z.object({ credential: z.any() })),
  verifyPasskeyAuthentication
);

export default router;
