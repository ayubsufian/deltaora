import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { UserSession } from '../models/UserSession';
import { Workspace } from '../models/Workspace';
import { MonitoredPage } from '../models/MonitoredPage';
import { Notification } from '../models/Notification';
import { revokeAllUserSessions } from '../services/auth.service';
import * as argon2 from 'argon2';
import { validatePasswordPolicy } from '../services/passwordPolicy.service';
import { generateRecoveryCodes } from '../services/security.service';

export const getPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId).select('emailPreferences');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ emailPreferences: user.emailPreferences });
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { marketing, notifications } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (typeof marketing === 'boolean') {
      user.emailPreferences.marketing = marketing;
    }
    if (typeof notifications === 'boolean') {
      user.emailPreferences.notifications = notifications;
    }

    await user.save();

    res.json({ message: 'Preferences updated successfully', emailPreferences: user.emailPreferences });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(userId);

    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Password change is not available for this account' });
    }

    const isValid = await argon2.verify(user.passwordHash, currentPassword);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordErrors = validatePasswordPolicy(newPassword, { email: user.email, name: user.name });
    if (passwordErrors.length > 0) {
      return res.status(400).json({ error: 'Password does not meet security requirements', details: passwordErrors });
    }

    user.passwordHash = newPassword;
    user.passwordChangedAt = new Date();
    await user.save();

    await UserSession.updateMany(
      { userId, _id: { $ne: req.user!.sessionId }, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'password_changed' } }
    );

    res.json({ message: 'Password changed successfully. Other sessions were revoked.' });
  } catch (error) {
    next(error);
  }
};

export const disableMfa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaRecoveryCodeHashes = [];
    await user.save();

    res.json({ message: 'MFA disabled successfully' });
  } catch (error) {
    next(error);
  }
};

export const regenerateMfaRecoveryCodes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.mfaEnabled) return res.status(400).json({ error: 'MFA is not enabled' });

    const { codes, hashes } = await generateRecoveryCodes();
    user.mfaRecoveryCodeHashes = hashes;
    await user.save();

    res.json({ recoveryCodes: codes });
  } catch (error) {
    next(error);
  }
};

export const listSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await UserSession.find({
      userId: req.user!.userId,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).sort({ lastSeenAt: -1 });

    res.json(sessions.map(session => ({
      id: session.id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastSeenAt: session.lastSeenAt,
      createdAt: session.createdAt,
      expiresAt: session.expiresAt,
      current: session.id === req.user!.sessionId,
    })));
  } catch (error) {
    next(error);
  }
};

export const revokeSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const session = await UserSession.findOneAndUpdate(
      { _id: sessionId, userId: req.user!.userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'user_revoked' } },
      { new: true }
    );

    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Session revoked' });
  } catch (error) {
    next(error);
  }
};

export const revokeOtherSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await UserSession.updateMany(
      { userId: req.user!.userId, _id: { $ne: req.user!.sessionId }, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokedReason: 'user_revoked_all_other' } }
    );
    res.json({ message: 'Other sessions revoked' });
  } catch (error) {
    next(error);
  }
};

export const exportAccountData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const [user, workspaces, pages, notifications] = await Promise.all([
      User.findById(userId).select('-passwordHash -mfaSecret -mfaRecoveryCodeHashes'),
      Workspace.find({ 'members.userId': userId }),
      MonitoredPage.find({ userId }),
      Notification.find({ userId }),
    ]);

    res.json({ user, workspaces, pages, notifications, exportedAt: new Date() });
  } catch (error) {
    next(error);
  }
};

export const deleteAccount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const ownedWorkspaces = await Workspace.find({ 'members.userId': userId });
    const lastOwnerWorkspace = ownedWorkspaces.find(workspace => {
      const targetMember = workspace.members.find(member => member.userId.toString() === userId);
      const ownerCount = workspace.members.filter(member => member.role === 'owner').length;
      return targetMember?.role === 'owner' && ownerCount <= 1 && workspace.members.length > 1;
    });

    if (lastOwnerWorkspace) {
      return res.status(400).json({ error: 'Transfer ownership or remove members before deleting your account.' });
    }

    user.status = 'deleted';
    user.email = `deleted-${userId}@deleted.deltaora.local`;
    user.name = 'Deleted user';
    user.passwordHash = undefined;
    user.googleId = undefined;
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaRecoveryCodeHashes = [];
    await user.save();

    await Workspace.updateMany(
      { 'members.userId': userId },
      { $pull: { members: { userId } } }
    );
    await revokeAllUserSessions(userId, 'account_deleted');

    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const setUserStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { userId } = req.params;
    const { status } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.status = status;
    await user.save();

    if (status !== 'active') {
      await revokeAllUserSessions(user.id, `admin_${status}`);
    }

    res.json({ message: `User ${status}`, user: { id: user.id, status: user.status } });
  } catch (error) {
    next(error);
  }
};
