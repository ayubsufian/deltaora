import { Request, Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { User } from '../models/User';
import { env } from '../config/env';
import { ForbiddenError } from '@casl/ability';
import mongoose from 'mongoose';
import { logAuditEvent } from '../services/audit.service';
import { AuditLog } from '../models/AuditLog';
import { ApiKey } from '../models/ApiKey';
import { MonitoredPage } from '../models/MonitoredPage';
import { WebhookEndpoint } from '../models/WebhookEndpoint';
import { sendEmail } from '../services/email.service';
import { workspaceInviteEmail } from '../utils/emailTemplates';
import { WorkspaceInvite } from '../models/WorkspaceInvite';
import { encryptSecret, randomToken, sha256 } from '../services/security.service';
import { assertSafeScrapeUrl } from '../services/urlSafety.service';

export const getMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'Workspace');

    const workspace = await Workspace.findById(workspaceId).populate('members.userId', 'name email');
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const members = workspace.members.map(member => ({
      id: (member.userId as any)._id,
      name: (member.userId as any).name,
      email: (member.userId as any).email,
      role: member.role,
      joinedAt: member.joinedAt,
    }));

    res.json(members);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const getWorkspaceSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'Workspace');

    const [workspace, pageCount] = await Promise.all([
      Workspace.findById(workspaceId),
      MonitoredPage.countDocuments({ workspaceId }),
    ]);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json({
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
      maxPages: workspace.maxPages,
      pageCount,
      crawlerDefaults: workspace.crawlerDefaults,
      notificationDefaults: workspace.notificationDefaults,
    });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const updateWorkspaceSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const update: any = {};
    if (typeof req.body.name === 'string') {
      update.name = req.body.name.trim();
    }
    if (req.body.crawlerDefaults) {
      update.crawlerDefaults = req.body.crawlerDefaults;
    }
    if (req.body.notificationDefaults) {
      update.notificationDefaults = req.body.notificationDefaults;
    }

    const workspace = await Workspace.findByIdAndUpdate(
      workspaceId,
      { $set: update },
      { new: true }
    );

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'workspace.settings_updated',
      metadata: update,
      req,
    });

    res.json({
      id: workspace.id,
      name: workspace.name,
      plan: workspace.plan,
      maxPages: workspace.maxPages,
      crawlerDefaults: workspace.crawlerDefaults,
      notificationDefaults: workspace.notificationDefaults,
    });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const generateInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    const { role, email } = req.body; // 'editor' | 'viewer', optional email

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    // Only owners can invite people
    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const validRoles = ['editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role for invitation' });
    }

    const inviteToken = randomToken(32);
    await WorkspaceInvite.create({
      workspaceId,
      role,
      inviterId: req.user!.userId,
      inviteeEmail: email,
      tokenHash: sha256(inviteToken),
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    });

    const joinUrl = `${env.CLIENT_URL}/join?token=${inviteToken}`;

    // 2026 Standard: If an email is provided, automatically send the invite
    if (email) {
      const inviter = await User.findById(req.user!.userId);
      const workspace = await Workspace.findById(workspaceId);

      await sendEmail({
        to: email,
        subject: `You've been invited to ${workspace?.name || 'a workspace'} on Deltaora`,
        htmlContent: workspaceInviteEmail(
          inviter?.name || 'A team member',
          workspace?.name || 'a workspace',
          joinUrl
        ),
      });

      // Log audit event for the email invite
      await logAuditEvent({
        workspaceId: workspaceId as string,
        actorId: req.user!.userId,
        action: 'member.invited',
        metadata: { email, role, method: 'email' },
        req,
      });

      return res.json({ inviteToken, expiresIn: '48h', emailSent: true });
    }

    res.json({ inviteToken, expiresIn: '48h', emailSent: false });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};


export const joinWorkspace = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { inviteToken } = req.body;
    const userId = req.user!.userId;

    if (!inviteToken) {
      return res.status(400).json({ error: 'Invite token is required' });
    }

    const invite = await WorkspaceInvite.findOne({
      tokenHash: sha256(inviteToken),
      acceptedAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!invite) {
      return res.status(400).json({ error: 'Invalid or expired invite token' });
    }

    const workspaceId = invite.workspaceId.toString();
    const { role } = invite;
    const user = await User.findById(userId).select('email');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (invite.inviteeEmail && invite.inviteeEmail !== user.email.toLowerCase()) {
      return res.status(403).json({ error: 'This invite was sent to a different email address' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace no longer exists' });
    }

    const existingMember = workspace.members.find(m => m.userId.toString() === userId);
    if (existingMember) {
      return res.status(409).json({ error: 'You are already a member of this workspace' });
    }

    workspace.members.push({
      userId: new mongoose.Types.ObjectId(userId),
      role,
      joinedAt: new Date(),
    });

    invite.acceptedAt = new Date();
    await workspace.save();
    await invite.save();
    
    // Log Audit Event
    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: userId,
      action: 'workspace.joined',
      metadata: { role, method: 'invite_link' },
      req
    });

    res.json({ message: 'Successfully joined workspace', workspaceId });
  } catch (error) {
    next(error);
  }
};

export const updateMemberRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    const { userId } = req.params;
    const { role } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    if (!['owner', 'editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Prevent changing the last owner's role
    if (role !== 'owner') {
      const ownerCount = workspace.members.filter(m => m.role === 'owner').length;
      const targetMember = workspace.members.find(m => m.userId.toString() === userId);
      
      if (targetMember?.role === 'owner' && ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot change role of the last owner in the workspace' });
      }
    }

    const memberIndex = workspace.members.findIndex(m => m.userId.toString() === userId);
    if (memberIndex === -1) {
      return res.status(404).json({ error: 'User is not a member of this workspace' });
    }

    const previousRole = workspace.members[memberIndex].role;
    workspace.members[memberIndex].role = role;
    await workspace.save();
    
    // Log Audit Event
    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'role.changed',
      resourceId: userId,
      metadata: { previousRole, newRole: role },
      req
    });

    res.json({ message: 'Member role updated successfully' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const removeMember = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    const { userId } = req.params;
    const requesterId = req.user!.userId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    // Users can remove themselves, otherwise they need 'manage' capability
    if (userId !== requesterId) {
      ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const memberToRemove = workspace.members.find(m => m.userId.toString() === userId);
    if (!memberToRemove) {
      return res.status(404).json({ error: 'User is not a member of this workspace' });
    }

    // Prevent removing the last owner
    if (memberToRemove.role === 'owner') {
      const ownerCount = workspace.members.filter(m => m.role === 'owner').length;
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Cannot remove the last owner of the workspace' });
      }
    }

    workspace.members = workspace.members.filter(m => m.userId.toString() !== userId);
    await workspace.save();
    
    // Log Audit Event
    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: requesterId,
      action: requesterId === userId ? 'workspace.left' : 'member.removed',
      resourceId: userId,
      metadata: { role: memberToRemove.role },
      req
    });

    res.json({ message: 'Member removed successfully' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const listWebhooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const webhooks = await WebhookEndpoint.find({ workspaceId }).sort({ createdAt: -1 });
    res.json(webhooks);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const createWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');
    const safeUrl = await assertSafeScrapeUrl(req.body.url, 'Webhook URL');

    const webhook = await WebhookEndpoint.create({
      workspaceId,
      createdBy: req.user!.userId,
      name: req.body.name,
      url: safeUrl.href,
      events: req.body.events,
      secretEncrypted: req.body.secret ? encryptSecret(req.body.secret) : undefined,
      isActive: true,
    });

    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'webhook.created',
      resourceId: webhook.id,
      metadata: { name: webhook.name, url: webhook.url, events: webhook.events },
      req,
    });

    res.status(201).json(webhook);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const updateWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const update: any = {};
    if (typeof req.body.name === 'string') update.name = req.body.name;
    if (typeof req.body.url === 'string') update.url = (await assertSafeScrapeUrl(req.body.url, 'Webhook URL')).href;
    if (Array.isArray(req.body.events)) update.events = req.body.events;
    if (typeof req.body.secret === 'string') update.secretEncrypted = req.body.secret ? encryptSecret(req.body.secret) : undefined;
    if (typeof req.body.isActive === 'boolean') update.isActive = req.body.isActive;

    const webhook = await WebhookEndpoint.findOneAndUpdate(
      { _id: req.params.webhookId, workspaceId },
      { $set: update },
      { new: true }
    );

    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'webhook.updated',
      resourceId: webhook.id,
      metadata: { name: webhook.name, url: webhook.url, events: webhook.events, isActive: webhook.isActive },
      req,
    });

    res.json(webhook);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const deleteWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const webhook = await WebhookEndpoint.findOneAndDelete({ _id: req.params.webhookId, workspaceId });
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'webhook.deleted',
      resourceId: webhook.id,
      metadata: { name: webhook.name },
      req,
    });

    res.json({ message: 'Webhook deleted' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const listApiKeys = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const keys = await ApiKey.find({ workspaceId, revokedAt: { $exists: false } }).sort({ createdAt: -1 });
    res.json(keys);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const createApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const token = `dlt_${randomToken(32)}`;
    const key = await ApiKey.create({
      workspaceId,
      createdBy: req.user!.userId,
      name: req.body.name,
      keyHash: sha256(token),
      keyPrefix: token.slice(0, 12),
      scopes: req.body.scopes,
      expiresAt: req.body.expiresAt ? new Date(req.body.expiresAt) : undefined,
    });

    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'api_key.created',
      resourceId: key.id,
      metadata: { name: key.name, scopes: key.scopes, expiresAt: key.expiresAt },
      req,
    });

    res.status(201).json({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      scopes: key.scopes,
      expiresAt: key.expiresAt,
      createdAt: key.createdAt,
      token,
    });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const revokeApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const key = await ApiKey.findOneAndUpdate(
      { _id: req.params.keyId, workspaceId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
      { new: true }
    );

    if (!key) return res.status(404).json({ error: 'API key not found' });

    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'api_key.revoked',
      resourceId: key.id,
      metadata: { name: key.name },
      req,
    });

    res.json({ message: 'API key revoked' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 25)));
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;
    const actor = typeof req.query.actor === 'string' ? req.query.actor : undefined;
    const exportFormat = req.query.export;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    // Only owners should see audit logs in a strict SOC2 environment
    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const query: any = { workspaceId };
    if (action) query.action = { $regex: action, $options: 'i' };
    if (actor && mongoose.Types.ObjectId.isValid(actor)) query.actorId = actor;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
      .sort({ createdAt: -1 })
      .populate('actorId', 'name email')
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);

    if (exportFormat === 'csv') {
      const rows = [
        ['createdAt', 'actor', 'email', 'action', 'resourceId', 'ipAddress', 'metadata'],
        ...logs.map(log => [
          log.createdAt.toISOString(),
          (log.actorId as any)?.name || 'System',
          (log.actorId as any)?.email || '',
          log.action,
          log.resourceId || '',
          log.ipAddress || '',
          JSON.stringify(log.metadata || {}),
        ]),
      ];
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="deltaora-audit-logs.csv"');
      return res.send(rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n'));
    }

    res.json({
      data: logs,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};
