import { Router } from 'express';
import {
  createWorkspace,
  deleteWorkspace,
  generateInvite,
  getAuditLogs,
  getMembers,
  getWorkspaceSettings,
  joinWorkspace,
  listInvites,
  listWorkspaces,
  removeMember,
  resendInvite,
  revokeInvite,
  transferWorkspaceOwnership,
  updateMemberRole,
  updateWorkspaceSettings,
} from '../controllers/workspaces.controller';
import { requireAuth, requireRecentStepUp, requireVerifiedEmail } from '../middleware/auth';
import { resolveAbility } from '../middleware/authorize';
import { validate } from '../middleware/validate';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);
router.use(requireVerifiedEmail);

// Join workspace doesn't need resolveAbility because they aren't in the workspace yet
router.post('/join', validate(z.object({ inviteToken: z.string() })), joinWorkspace);
router.get('/', listWorkspaces);
router.post('/', validate(z.object({
  name: z.string().trim().min(2).max(100),
  emoji: z.string().trim().min(1).max(8).optional(),
}).strict()), createWorkspace);

const crawlerDefaultsSchema = z.object({
  respectRobots: z.boolean(),
  blockedHandling: z.enum(['fail', 'manual_review']),
  apiCapture: z.boolean(),
  screenshotDiff: z.boolean(),
  includeFeeds: z.boolean(),
}).strict();

const notificationDefaultsSchema = z.object({
  minimumImportance: z.enum(['low', 'medium', 'high', 'critical']),
}).strict();

router.get('/:id/settings', resolveAbility, getWorkspaceSettings);
router.patch(
  '/:id/settings',
  resolveAbility,
  validate(z.object({
    name: z.string().trim().min(2).max(100).optional(),
    emoji: z.string().trim().min(1).max(8).optional(),
    crawlerDefaults: crawlerDefaultsSchema.optional(),
    notificationDefaults: notificationDefaultsSchema.optional(),
  }).strict()),
  updateWorkspaceSettings
);

router.get('/:id/members', resolveAbility, getMembers);
router.get('/:id/audit-logs', resolveAbility, getAuditLogs);
router.post(
  '/:id/transfer-ownership',
  resolveAbility,
  requireRecentStepUp(),
  validate(z.object({ userId: z.string().regex(/^[0-9a-fA-F]{24}$/) }).strict()),
  transferWorkspaceOwnership
);
router.delete('/:id', resolveAbility, requireRecentStepUp(), deleteWorkspace);

router.post(
  '/:id/invites',
  resolveAbility,
  requireRecentStepUp(),
  validate(z.object({ role: z.enum(['editor', 'viewer']), email: z.string().trim().toLowerCase().email().optional() })),
  generateInvite
);
router.get('/:id/invites', resolveAbility, listInvites);
router.post('/:id/invites/:inviteId/resend', resolveAbility, requireRecentStepUp(), resendInvite);
router.delete('/:id/invites/:inviteId', resolveAbility, requireRecentStepUp(), revokeInvite);

router.patch(
  '/:id/members/:userId',
  resolveAbility,
  requireRecentStepUp(),
  validate(z.object({ role: z.enum(['owner', 'editor', 'viewer']) }).strict()),
  updateMemberRole
);

router.delete('/:id/members/:userId', resolveAbility, requireRecentStepUp(), removeMember);

export default router;
