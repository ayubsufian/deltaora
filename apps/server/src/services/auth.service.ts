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
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
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
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
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
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000,
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
      reauthenticatedAt: options.markReauthenticated ? new Date() : undefined,
      mfaVerifiedAt: options.markMfaVerified ? new Date() : undefined,
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
        ...(options.markReauthenticated ? { reauthenticatedAt: new Date() } : {}),
        ...(options.markMfaVerified ? { mfaVerifiedAt: new Date() } : {}),
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
