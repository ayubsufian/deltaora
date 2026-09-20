import { Request, Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { User } from '../models/User';
import { env } from '../config/env';
import { ForbiddenError } from '@casl/ability';
import mongoose from 'mongoose';
import { logAuditEvent } from '../services/audit.service';
import { AuditLog } from '../models/AuditLog';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { AISummary } from '../models/AISummary';
import { CrawlerAuthSession } from '../models/CrawlerAuthSession';
import { sendEmail } from '../services/email.service';
import { workspaceInviteEmail } from '../utils/emailTemplates';
import { WorkspaceInvite } from '../models/WorkspaceInvite';
import { randomToken, sha256 } from '../services/security.service';

const workspaceSummary = (workspace: any, userId: string) => ({
  id: workspace.id,
  name: workspace.name,
  emoji: workspace.emoji || '📗',
  role: workspace.members.find((member: any) => member.userId.toString() === userId)?.role,
  ownerId: workspace.ownerId.toString(),
  memberCount: workspace.members.length,
  createdAt: workspace.createdAt,
});

export const listWorkspaces = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaces = await Workspace.find({ 'members.userId': req.user!.userId }).sort({ createdAt: 1 });
    res.json(workspaces.map(workspace => workspaceSummary(workspace, req.user!.userId)));
  } catch (error) {
    next(error);
  }
};

export const createWorkspace = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = req.body.name.trim();
    const emoji = typeof req.body.emoji === 'string' && req.body.emoji.trim() ? req.body.emoji.trim() : '📗';
    const activeWorkspaceId = req.headers['x-workspace-id'] as string | undefined;
    const sourceWorkspace = activeWorkspaceId && mongoose.Types.ObjectId.isValid(activeWorkspaceId)
      ? await Workspace.findById(activeWorkspaceId)
      : null;
    const canCopyMembers = sourceWorkspace?.members.some(member => member.userId.toString() === req.user!.userId);
    const members = canCopyMembers
      ? sourceWorkspace!.members.map(member => ({
          userId: member.userId,
          role: member.userId.toString() === req.user!.userId ? 'owner' : member.role,
          joinedAt: new Date(),
        }))
      : [{ userId: req.user!.userId, role: 'owner', joinedAt: new Date() }];

    const workspace = await Workspace.create({
      name,
      emoji,
      ownerId: req.user!.userId,
      members,
    });

    await logAuditEvent({
      workspaceId: workspace.id,
      actorId: req.user!.userId,
      action: 'workspace.created',
      metadata: { name, emoji, copiedMemberCount: members.length },
      req,
    });

    res.status(201).json(workspaceSummary(workspace, req.user!.userId));
  } catch (error) {
    next(error);
  }
};

export const transferWorkspaceOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    const { userId } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const currentOwner = workspace.members.find(member => member.userId.toString() === req.user!.userId);
    if (!currentOwner || currentOwner.role !== 'owner') {
      return res.status(403).json({ error: 'Only a workspace owner can transfer ownership' });
    }

    const nextOwner = workspace.members.find(member => member.userId.toString() === userId);
    if (!nextOwner) return res.status(404).json({ error: 'Target user is not a workspace member' });

    const previousOwnerId = workspace.ownerId.toString();
    workspace.ownerId = new mongoose.Types.ObjectId(userId);
    nextOwner.role = 'owner';
    currentOwner.role = 'owner';
    await workspace.save();

    await logAuditEvent({
      workspaceId,
      actorId: req.user!.userId,
      action: 'workspace.ownership_transferred',
      resourceId: userId,
      metadata: { previousOwnerId, newOwnerId: userId },
      req,
    });

    res.json({ message: 'Workspace ownership transferred' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const deleteWorkspace = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });

    const requester = workspace.members.find(member => member.userId.toString() === req.user!.userId);
    if (!requester || requester.role !== 'owner') {
      return res.status(403).json({ error: 'Only a workspace owner can delete this workspace' });
    }

    const remainingWorkspaceCount = await Workspace.countDocuments({ 'members.userId': req.user!.userId, _id: { $ne: workspace._id } });
    if (remainingWorkspaceCount === 0) {
      return res.status(400).json({ error: 'Create or join another workspace before deleting your last workspace' });
    }

    const relatedDiffs = await Diff.find({ workspaceId }).select('_id');
    const diffIds = relatedDiffs.map(diff => diff._id);

    await logAuditEvent({
      workspaceId,
      actorId: req.user!.userId,
      action: 'workspace.deleted',
      metadata: { name: workspace.name },
      req,
    });

    await Promise.all([
      MonitoredPage.deleteMany({ workspaceId }),
      Snapshot.deleteMany({ workspaceId }),
      Diff.deleteMany({ workspaceId }),
      AISummary.deleteMany({ workspaceId, ...(diffIds.length > 0 ? { diffId: { $in: diffIds } } : {}) }),
      CrawlerAuthSession.deleteMany({ workspaceId }),
      WorkspaceInvite.deleteMany({ workspaceId }),
      Workspace.deleteOne({ _id: workspaceId }),
    ]);

    res.json({ message: 'Workspace deleted' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const getMembers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'Workspace');

    const workspace = await Workspace.findById(workspaceId).populate('members.userId', 'name email avatarUrl');
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const members = workspace.members.map(member => ({
      id: (member.userId as any)._id,
      name: (member.userId as any).name,
      email: (member.userId as any).email,
      avatarUrl: (member.userId as any).avatarUrl || null,
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
      emoji: workspace.emoji || '📗',
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
    if (typeof req.body.emoji === 'string') {
      update.emoji = req.body.emoji.trim() || '📗';
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
      emoji: workspace.emoji || '📗',
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
    const { role } = req.body; // 'editor' | 'viewer'
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    // Only owners can invite people
    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const validRoles = ['editor', 'viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role for invitation' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (email) {
      const invitee = await User.findOne({ email }).select('_id email name');
      if (invitee) {
        const existingMember = workspace.members.find(member => member.userId.toString() === invitee.id);

        if (existingMember) {
          await logAuditEvent({
            workspaceId: workspaceId as string,
            actorId: req.user!.userId,
            action: 'member.invite_skipped_existing_member',
            resourceId: invitee.id,
            metadata: { email, role: existingMember.role },
            req,
          });

          return res.status(409).json({
            code: 'WORKSPACE_MEMBER_EXISTS',
            error: `${email} is already a member of this workspace`,
            member: {
              id: invitee.id,
              email: invitee.email,
              name: invitee.name,
              role: existingMember.role,
            },
          });
        }
      }
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

      await sendEmail({
        to: email,
        subject: `You've been invited to ${workspace.name || 'a workspace'} on Deltaora`,
        htmlContent: workspaceInviteEmail(
          inviter?.name || 'A team member',
          workspace.name || 'a workspace',
          joinUrl,
          env.CLIENT_URL
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

    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'member.invited',
      metadata: { role, method: 'link' },
      req,
    });

    res.json({ inviteToken, expiresIn: '48h', emailSent: false });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const listInvites = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const invites = await WorkspaceInvite.find({
      workspaceId,
      acceptedAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    })
      .populate('inviterId', 'name email')
      .sort({ createdAt: -1 });

    res.json(invites.map(invite => ({
      id: invite.id,
      inviteeEmail: invite.inviteeEmail || null,
      role: invite.role,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
      inviter: invite.inviterId
        ? {
            id: (invite.inviterId as any)._id,
            name: (invite.inviterId as any).name,
            email: (invite.inviterId as any).email,
          }
        : null,
    })));
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const revokeInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const invite = await WorkspaceInvite.findOneAndUpdate(
      {
        _id: req.params.inviteId,
        workspaceId,
        acceptedAt: { $exists: false },
        revokedAt: { $exists: false },
      },
      { $set: { revokedAt: new Date() } },
      { new: true }
    );

    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    await logAuditEvent({
      workspaceId,
      actorId: req.user!.userId,
      action: 'member.invite_revoked',
      resourceId: invite.id,
      metadata: { email: invite.inviteeEmail, role: invite.role },
      req,
    });

    res.json({ message: 'Invite revoked' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const resendInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) return res.status(400).json({ error: 'No workspace context' });

    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const invite = await WorkspaceInvite.findOne({
      _id: req.params.inviteId,
      workspaceId,
      acceptedAt: { $exists: false },
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });

    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    if (!invite.inviteeEmail) return res.status(400).json({ error: 'Only email invites can be resent' });

    const inviteToken = randomToken(32);
    invite.tokenHash = sha256(inviteToken);
    invite.expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await invite.save();

    const [inviter, workspace] = await Promise.all([
      User.findById(req.user!.userId),
      Workspace.findById(workspaceId),
    ]);

    await sendEmail({
      to: invite.inviteeEmail,
      subject: `Reminder: you've been invited to ${workspace?.name || 'a workspace'} on Deltaora`,
      htmlContent: workspaceInviteEmail(
        inviter?.name || 'A team member',
        workspace?.name || 'a workspace',
        `${env.CLIENT_URL}/join?token=${inviteToken}`,
        env.CLIENT_URL
      ),
    });

    await logAuditEvent({
      workspaceId,
      actorId: req.user!.userId,
      action: 'member.invite_resent',
      resourceId: invite.id,
      metadata: { email: invite.inviteeEmail, role: invite.role },
      req,
    });

    res.json({ message: 'Invite resent', expiresIn: '48h' });
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

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const targetMember = workspace.members.find(m => m.userId.toString() === userId);
    if (!targetMember) {
      return res.status(404).json({ error: 'User is not a member of this workspace' });
    }

    const ownerCount = workspace.members.filter(m => m.role === 'owner').length;
    if (targetMember.role === 'owner' && role !== 'owner' && ownerCount <= 1) {
      return res.status(400).json({ error: 'Cannot change role of the last owner in the workspace' });
    }

    const targetUserId = new mongoose.Types.ObjectId(userId);
    const updateFilter: any = {
      _id: workspaceId,
      members: { $elemMatch: { userId: targetUserId } },
    };

    if (targetMember.role === 'owner' && role !== 'owner') {
      updateFilter.$expr = {
        $gt: [
          {
            $size: {
              $filter: {
                input: '$members',
                as: 'member',
                cond: { $eq: ['$$member.role', 'owner'] },
              },
            },
          },
          1,
        ],
      };
    }

    const update = await Workspace.updateOne(
      updateFilter,
      { $set: { 'members.$[member].role': role } },
      { arrayFilters: [{ 'member.userId': targetUserId }] }
    );

    if (update.modifiedCount === 0 && targetMember.role !== role) {
      return res.status(409).json({ error: 'Member role changed concurrently. Refresh and try again.' });
    }
    
    // Log Audit Event
    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'role.changed',
      resourceId: userId,
      metadata: { previousRole: targetMember.role, newRole: role },
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

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    // Users can remove themselves, otherwise they need 'manage' capability
    if (userId !== requesterId) {
      ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');
    }

    if (userId === requesterId) {
      const remainingWorkspaceCount = await Workspace.countDocuments({ 'members.userId': requesterId, _id: { $ne: workspaceId } });
      if (remainingWorkspaceCount === 0) {
        return res.status(400).json({ error: 'Create or join another workspace before leaving your last workspace' });
      }
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

    const targetUserId = new mongoose.Types.ObjectId(userId);
    const updateFilter: any = {
      _id: workspaceId,
      members: { $elemMatch: { userId: targetUserId } },
    };

    if (memberToRemove.role === 'owner') {
      updateFilter.$expr = {
        $gt: [
          {
            $size: {
              $filter: {
                input: '$members',
                as: 'member',
                cond: { $eq: ['$$member.role', 'owner'] },
              },
            },
          },
          1,
        ],
      };
    }

    const nextPrimaryOwner = workspace.ownerId.toString() === userId
      ? workspace.members.find(member => member.role === 'owner' && member.userId.toString() !== userId)
      : null;

    const update = await Workspace.updateOne(
      updateFilter,
      {
        $pull: { members: { userId: targetUserId } },
        ...(nextPrimaryOwner ? { $set: { ownerId: nextPrimaryOwner.userId } } : {}),
      }
    );

    if (update.modifiedCount === 0) {
      return res.status(409).json({ error: 'Workspace membership changed concurrently. Refresh and try again.' });
    }
    
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

    if (exportFormat === 'csv') {
      const logs = await AuditLog.find(query)
        .sort({ createdAt: -1 })
        .populate('actorId', 'name email');
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

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
      .sort({ createdAt: -1 })
      .populate('actorId', 'name email')
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(query),
    ]);

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
