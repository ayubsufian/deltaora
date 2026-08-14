import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { CookieOptions, Request, Response } from 'express';
import { UserSession } from '../models/UserSession';
import { generateCsrfToken, getRequestIp, sha256 } from './security.service';

const production = env.NODE_ENV === 'production';

export const ACCESS_TOKEN_COOKIE = production ? '__Host-deltaora-access' : 'deltaora.accessToken';
export const REFRESH_TOKEN_COOKIE = production ? '__Host-deltaora-refresh' : 'deltaora.refreshToken';
export const CSRF_COOKIE = production ? '__Host-deltaora-csrf' : 'deltaora.csrfToken';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_IDLE_TTL_SECONDS = 12 * 60 * 60;
const REFRESH_TOKEN_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const STEP_UP_TTL_MS = 10 * 60 * 1000;

export interface AccessTokenPayload {
  userId: string;
  role: string;
  sessionId: string;
  mfaEnabled?: boolean;
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
}

const baseCookieOptions = (): CookieOptions => ({
  secure: production,
  sameSite: 'strict',
  path: '/',
});

export const setCsrfCookie = (res: Response) => {
  const csrfToken = generateCsrfToken();
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: REFRESH_TOKEN_IDLE_TTL_SECONDS * 1000,
  });
  return csrfToken;
};

export const setAuthCookies = (
  res: Response,
  { accessToken, refreshToken }: { accessToken: string; refreshToken: string }
) => {
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: ACCESS_TOKEN_TTL_SECONDS * 1000,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: REFRESH_TOKEN_IDLE_TTL_SECONDS * 1000,
  });

  setCsrfCookie(res);
};

export const clearAuthCookies = (res: Response) => {
  const clearOptions = baseCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, clearOptions);
  res.clearCookie(REFRESH_TOKEN_COOKIE, clearOptions);
  res.clearCookie(CSRF_COOKIE, clearOptions);
};

export const generateTokens = async (
  userId: string,
  role: string,
  req?: Request,
  existingSessionId?: string,
  options: { markReauthenticated?: boolean; markMfaVerified?: boolean } = {}
) => {
  const now = new Date();
  let absoluteExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_ABSOLUTE_TTL_SECONDS * 1000);
  let sessionId = existingSessionId;

  if (!sessionId) {
    const session = await UserSession.create({
      userId,
      refreshTokenHash: 'pending',
      userAgent: req?.headers['user-agent'],
      ipAddress: getRequestIp(req),
      expiresAt: new Date(now.getTime() + REFRESH_TOKEN_IDLE_TTL_SECONDS * 1000),
      absoluteExpiresAt,
      lastSeenAt: now,
      reauthenticatedAt: options.markReauthenticated ? now : undefined,
      mfaVerifiedAt: options.markMfaVerified ? now : undefined,
    });
    sessionId = session.id;
  } else {
    const existingSession = await UserSession.findOne({
      _id: sessionId,
      userId,
      revokedAt: { $exists: false },
      absoluteExpiresAt: { $gt: now },
    }).select('absoluteExpiresAt');

    if (!existingSession) {
      throw new Error('Session expired or revoked');
    }

    absoluteExpiresAt = existingSession.absoluteExpiresAt;
  }

  const idleExpiresAt = new Date(now.getTime() + REFRESH_TOKEN_IDLE_TTL_SECONDS * 1000);
  const expiresAt = idleExpiresAt < absoluteExpiresAt ? idleExpiresAt : absoluteExpiresAt;

  const accessToken = jwt.sign({ userId, role, sessionId }, env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });

  const refreshToken = jwt.sign({ userId, sessionId }, env.JWT_REFRESH_SECRET, {
    expiresIn: Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)),
  });

  const refreshTokenHash = sha256(refreshToken);

  await UserSession.findOneAndUpdate(
    { _id: sessionId, userId, revokedAt: { $exists: false } },
    {
      $set: {
        refreshTokenHash,
        expiresAt,
        absoluteExpiresAt,
        lastSeenAt: now,
        userAgent: req?.headers['user-agent'],
        ipAddress: getRequestIp(req),
        ...(options.markReauthenticated ? { reauthenticatedAt: now } : {}),
        ...(options.markMfaVerified ? { mfaVerifiedAt: now } : {}),
      },
    }
  );

  await redis.set(
    `refresh_token:${sessionId}`,
    refreshTokenHash,
    'EX',
    Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000))
  );

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

export const markSessionReauthenticated = async (
  userId: string,
  sessionId: string,
  options: { mfaVerified?: boolean } = {}
) => {
  const now = new Date();
  await UserSession.updateOne(
    { _id: sessionId, userId, revokedAt: { $exists: false }, expiresAt: { $gt: now } },
    {
      $set: {
        reauthenticatedAt: now,
        ...(options.mfaVerified ? { mfaVerifiedAt: now } : {}),
      },
    }
  );
};
