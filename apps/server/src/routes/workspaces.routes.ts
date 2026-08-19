import { Router } from 'express';
import {
  createApiKey,
  createWebhook,
  deleteWebhook,
  generateInvite,
  getAuditLogs,
  getMembers,
  getWorkspaceSettings,
  joinWorkspace,
  listApiKeys,
  listWebhooks,
  removeMember,
  revokeApiKey,
  updateMemberRole,
  updateWebhook,
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

const webhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.enum(['page.changed', 'page.failed', 'page.blocked', 'summary.created'])).min(1).max(10),
  secret: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
}).strict();

const apiKeySchema = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.enum(['pages:read', 'pages:write', 'notifications:read', 'webhooks:write'])).min(1).max(10),
  expiresAt: z.string().datetime().optional(),
}).strict();

router.get('/:id/settings', resolveAbility, getWorkspaceSettings);
router.patch(
  '/:id/settings',
  resolveAbility,
  requireRecentStepUp(),
  validate(z.object({
    name: z.string().min(2).max(100).optional(),
    crawlerDefaults: crawlerDefaultsSchema.optional(),
    notificationDefaults: notificationDefaultsSchema.optional(),
  }).strict()),
  updateWorkspaceSettings
);

router.get('/:id/members', resolveAbility, getMembers);
router.get('/:id/audit-logs', resolveAbility, getAuditLogs);
router.get('/:id/webhooks', resolveAbility, listWebhooks);
router.post('/:id/webhooks', resolveAbility, requireRecentStepUp(), validate(webhookSchema), createWebhook);
router.patch('/:id/webhooks/:webhookId', resolveAbility, requireRecentStepUp(), validate(webhookSchema.partial()), updateWebhook);
router.delete('/:id/webhooks/:webhookId', resolveAbility, requireRecentStepUp(), deleteWebhook);
router.get('/:id/api-keys', resolveAbility, listApiKeys);
router.post('/:id/api-keys', resolveAbility, requireRecentStepUp(), validate(apiKeySchema), createApiKey);
router.delete('/:id/api-keys/:keyId', resolveAbility, requireRecentStepUp(), revokeApiKey);

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
