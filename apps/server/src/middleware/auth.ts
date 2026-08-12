import { Request, Response, NextFunction } from 'express';
import { ACCESS_TOKEN_COOKIE, verifyAccessToken } from '../services/auth.service';
import { UserSession } from '../models/UserSession';
import { User } from '../models/User';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
        sessionId: string;
      };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.split(' ')[1]
      : req.cookies?.[ACCESS_TOKEN_COOKIE];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const decoded = verifyAccessToken(token);

    const [user, session] = await Promise.all([
      User.findById(decoded.userId).select('status role'),
      UserSession.findOne({
        _id: decoded.sessionId,
        userId: decoded.userId,
        revokedAt: { $exists: false },
        expiresAt: { $gt: new Date() },
      }).select('_id'),
    ]);

    if (!user || user.status !== 'active' || !session) {
      return res.status(401).json({ error: 'Unauthorized: Session expired or revoked' });
    }

    decoded.role = user.role;
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
