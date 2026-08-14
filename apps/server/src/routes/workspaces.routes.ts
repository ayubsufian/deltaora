import { Router } from 'express';
import { getMembers, generateInvite, joinWorkspace, updateMemberRole, removeMember, getAuditLogs } from '../controllers/workspaces.controller';
import { requireAuth, requireRecentStepUp, requireVerifiedEmail } from '../middleware/auth';
import { resolveAbility } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);
router.use(requireVerifiedEmail);

// Join workspace doesn't need resolveAbility because they aren't in the workspace yet
router.post('/join', validate(z.object({ inviteToken: z.string() })), joinWorkspace);

router.get('/:id/members', resolveAbility, getMembers);
router.get('/:id/audit-logs', resolveAbility, getAuditLogs);

router.post(
  '/:id/invites',
  resolveAbility,
  requireRecentStepUp(),
  validate(z.object({ role: z.enum(['editor', 'viewer']), email: z.string().email().optional() })),
  generateInvite
);

router.patch(
  '/:id/members/:userId',
  resolveAbility,
  requireRecentStepUp(),
  validate(z.object({ role: z.enum(['owner', 'editor', 'viewer']) })),
  updateMemberRole
);

router.delete('/:id/members/:userId', resolveAbility, requireRecentStepUp(), removeMember);

export default router;
