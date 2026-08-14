import { Router } from 'express';
import {
  changePassword,
  deleteAccount,
  disableMfa,
  exportAccountData,
  getPreferences,
  deletePasskey,
  listPasskeys,
  listSessions,
  regenerateMfaRecoveryCodes,
  revokeOtherSessions,
  revokeSession,
  setUserStatus,
  updateProfile,
  updatePreferences,
} from '../controllers/user.controller';
import { requireAdminMfa, requireAuth, requireRecentStepUp, requireVerifiedEmail } from '../middleware/auth';
import { authorize, resolveAbility } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);
router.use(requireVerifiedEmail);

router.patch(
  '/me',
  requireRecentStepUp(),
  validate(z.object({
    name: z.string().min(2).max(50).optional(),
    email: z.string().email().optional(),
  })),
  updateProfile
);
router.get('/me/preferences', getPreferences);
router.patch('/me/preferences', updatePreferences);
router.post(
  '/me/password',
  validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(15).max(1024) })),
  changePassword
);
router.post(
  '/me/mfa/disable',
  requireRecentStepUp({ requireMfa: true }),
  validate(z.object({ currentPassword: z.string().min(1).optional() })),
  disableMfa
);
router.post('/me/mfa/recovery-codes', requireRecentStepUp({ requireMfa: true }), regenerateMfaRecoveryCodes);
router.get('/me/sessions', listSessions);
router.delete('/me/sessions/others', requireRecentStepUp(), revokeOtherSessions);
router.delete('/me/sessions/:sessionId', requireRecentStepUp(), revokeSession);
router.get('/me/passkeys', listPasskeys);
router.delete('/me/passkeys/:passkeyId', requireRecentStepUp(), deletePasskey);
router.get('/me/export', exportAccountData);
router.delete('/me', requireRecentStepUp(), deleteAccount);

router.patch(
  '/:userId/status',
  requireAdminMfa,
  resolveAbility,
  authorize('manage', 'User'),
  requireRecentStepUp({ requireMfa: true }),
  validate(z.object({ status: z.enum(['active', 'suspended']) })),
  setUserStatus
);

export default router;
