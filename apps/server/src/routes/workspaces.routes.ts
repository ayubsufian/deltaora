import { Router } from 'express';
import { getMembers, generateInvite, joinWorkspace, updateMemberRole, removeMember, getAuditLogs } from '../controllers/workspaces.controller';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth';
import { resolveAbility } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);
router.use(requireVerifiedEmail);

// Join workspace doesn't need resolveAbility because they aren't in the workspace yet
router.post('/join', validate(z.object({ inviteToken: z.string() })), joinWorkspace);

// All other routes require workspace context
router.use(resolveAbility);

router.get('/:id/members', getMembers);
router.get('/:id/audit-logs', getAuditLogs);

router.post(
  '/:id/invites',
  validate(z.object({ role: z.enum(['editor', 'viewer']) })),
  generateInvite
);

router.patch(
  '/:id/members/:userId',
  validate(z.object({ role: z.enum(['owner', 'editor', 'viewer']) })),
  updateMemberRole
);

router.delete('/:id/members/:userId', removeMember);

export default router;
