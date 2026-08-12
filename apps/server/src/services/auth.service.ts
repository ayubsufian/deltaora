import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { Request, Response } from 'express';
import { UserSession } from '../models/UserSession';
import { getRequestIp, sha256 } from './security.service';

export const ACCESS_TOKEN_COOKIE = 'accessToken';
export const REFRESH_TOKEN_COOKIE = 'refreshToken';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AccessTokenPayload {
  userId: string;
  role: string;
  sessionId: string;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
}

export const setAuthCookies = (
  res: Response,
  { accessToken, refreshToken }: { accessToken: string; refreshToken: string }
) => {
  const secure = env.NODE_ENV === 'production';

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
};

export const clearAuthCookies = (res: Response) => {
  res.clearCookie(ACCESS_TOKEN_COOKIE);
  res.clearCookie(REFRESH_TOKEN_COOKIE);
};

export const generateTokens = async (
  userId: string,
  role: string,
  req?: Request,
  existingSessionId?: string
) => {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  let sessionId = existingSessionId;

  if (!sessionId) {
    const session = await UserSession.create({
      userId,
      refreshTokenHash: 'pending',
      userAgent: req?.headers['user-agent'],
      ipAddress: getRequestIp(req),
      expiresAt,
      lastSeenAt: new Date(),
    });
    sessionId = session.id;
  }

  const accessToken = jwt.sign({ userId, role, sessionId }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });

  const refreshToken = jwt.sign({ userId, sessionId }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
  });

  const refreshTokenHash = sha256(refreshToken);

  await UserSession.findOneAndUpdate(
    { _id: sessionId, userId, revokedAt: { $exists: false } },
    {
      $set: {
        refreshTokenHash,
        expiresAt,
        lastSeenAt: new Date(),
        userAgent: req?.headers['user-agent'],
        ipAddress: getRequestIp(req),
      },
    }
  );

  await redis.set(`refresh_token:${sessionId}`, refreshTokenHash, 'EX', REFRESH_TOKEN_TTL_SECONDS);

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
};

export const revokeRefreshToken = async (userId: string, token: string) => {
  const decoded = verifyRefreshToken(token);
  const tokenHash = sha256(token);

  await UserSession.findOneAndUpdate(
    { _id: decoded.sessionId, userId, refreshTokenHash: tokenHash },
    { $set: { revokedAt: new Date(), revokedReason: 'logout' } }
  );
  await redis.del(`refresh_token:${decoded.sessionId}`);
};

export const revokeAllUserSessions = async (userId: string, reason: string) => {
  const sessions = await UserSession.find({ userId, revokedAt: { $exists: false } }).select('_id');
  await UserSession.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date(), revokedReason: reason } }
  );
  if (sessions.length > 0) {
    await redis.del(...sessions.map(session => `refresh_token:${session.id}`));
  }
};
