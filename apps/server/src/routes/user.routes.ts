import { Router } from 'express';
import {
  changePassword,
  deleteAccount,
  disableMfa,
  exportAccountData,
  getPreferences,
  listSessions,
  regenerateMfaRecoveryCodes,
  revokeOtherSessions,
  revokeSession,
  setUserStatus,
  updatePreferences,
} from '../controllers/user.controller';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);
router.use(requireVerifiedEmail);

router.get('/me/preferences', getPreferences);
router.patch('/me/preferences', updatePreferences);
router.post(
  '/me/password',
  validate(z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(15).max(1024) })),
  changePassword
);
router.post(
  '/me/mfa/disable',
  validate(z.object({ currentPassword: z.string().min(1).optional() })),
  disableMfa
);
router.post('/me/mfa/recovery-codes', regenerateMfaRecoveryCodes);
router.get('/me/sessions', listSessions);
router.delete('/me/sessions/others', revokeOtherSessions);
router.delete('/me/sessions/:sessionId', revokeSession);
router.get('/me/export', exportAccountData);
router.delete('/me', deleteAccount);

router.patch(
  '/:userId/status',
  validate(z.object({ status: z.enum(['active', 'suspended']) })),
  setUserStatus
);

export default router;
