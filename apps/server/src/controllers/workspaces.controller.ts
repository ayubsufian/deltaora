import { Request, Response, NextFunction } from 'express';
import { Workspace } from '../models/Workspace';
import { User } from '../models/User';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { ForbiddenError } from '@casl/ability';
import mongoose from 'mongoose';
import { logAuditEvent } from '../services/audit.service';
import { AuditLog } from '../models/AuditLog';
import { sendEmail } from '../services/email.service';
import { workspaceInviteEmail } from '../utils/emailTemplates';

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

    // Generate a secure JWT for the invite link (valid for 48 hours)
    const inviteToken = jwt.sign(
      { workspaceId, role, inviterId: req.user!.userId },
      env.JWT_SECRET,
      { expiresIn: '48h' }
    );

    const joinUrl = `http://localhost:5173/join?token=${inviteToken}`;

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

    let decoded: any;
    try {
      decoded = jwt.verify(inviteToken, env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({ error: 'Invalid or expired invite token' });
    }

    const { workspaceId, role } = decoded;

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

    await workspace.save();
    
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

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    // Only owners should see audit logs in a strict SOC2 environment
    ForbiddenError.from(req.ability!).throwUnlessCan('manage', 'Workspace');

    const logs = await AuditLog.find({ workspaceId })
      .sort({ createdAt: -1 })
      .populate('actorId', 'name email')
      .limit(100); // Pagination in a real app

    res.json(logs);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};
