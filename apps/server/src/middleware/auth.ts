import { Request, Response, NextFunction } from 'express';
import { ACCESS_TOKEN_COOKIE, STEP_UP_TTL_MS, verifyAccessToken } from '../services/auth.service';
import { UserSession } from '../models/UserSession';
import { User } from '../models/User';
import { PasskeyCredential } from '../models/PasskeyCredential';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        sessionId: string;
        mfaEnabled?: boolean;
      };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const decoded = verifyAccessToken(token);

    const [user, session] = await Promise.all([
      User.findById(decoded.userId).select('status role mfaEnabled'),
      UserSession.findOne({
        _id: decoded.sessionId,
        userId: decoded.userId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
        absoluteExpiresAt: { $gt: new Date() },
      }).select('_id'),
    ]);

    if (!user || user.status !== 'active' || !session) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or revoked' });
    }

    decoded.role = user.role;
    decoded.mfaEnabled = user.mfaEnabled;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};

export const requireVerifiedEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Must be called after requireAuth
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await User.findById(req.user.userId).select('isEmailVerified');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({ error: 'Email Verification Required', code: 'EMAIL_UNVERIFIED' });
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireAdminMfa = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role === 'admin' && !req.user.mfaEnabled) {
      const hasPasskey = await PasskeyCredential.exists({ userId: req.user.userId });
      if (!hasPasskey) {
        return res.status(403).json({
          error: 'Admin accounts must enable MFA or register a passkey before using privileged actions',
          code: 'ADMIN_STRONG_AUTH_REQUIRED',
        });
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireRecentStepUp = (options: { requireMfa?: boolean } = {}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user?.userId || !req.user.sessionId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const session = await UserSession.findOne({
        _id: req.user.sessionId,
        userId: req.user.userId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
        absoluteExpiresAt: { $gt: new Date() },
      }).select('reauthenticatedAt mfaVerifiedAt');

      const stepUpAt = options.requireMfa ? session?.mfaVerifiedAt : session?.reauthenticatedAt;
      const isFresh = stepUpAt && Date.now() - stepUpAt.getTime() <= STEP_UP_TTL_MS;

      if (!isFresh) {
        return res.status(403).json({
          error: options.requireMfa ? 'Recent MFA verification required' : 'Recent re-authentication required',
          code: options.requireMfa ? 'MFA_STEP_UP_REQUIRED' : 'STEP_UP_REQUIRED',
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
