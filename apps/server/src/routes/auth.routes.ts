import { Router } from 'express';
import { register, login, refresh, logout, setupMfa, verifyMfa } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
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

// Accept optional mfaCode for 2FA
const mfaLoginSchema = loginSchema.extend({
  mfaCode: z.string().optional()
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
router.post('/mfa/setup', requireAuth, setupMfa);
router.post('/mfa/verify', requireAuth, validate(z.object({ code: z.string().length(6) })), verifyMfa);

export default router;
