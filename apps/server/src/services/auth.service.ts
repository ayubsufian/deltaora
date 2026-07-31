import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { redis } from '../config/redis';
import { Types } from 'mongoose';

export const generateTokens = async (userId: string, role: string) => {
  const accessToken = jwt.sign({ userId, role }, env.JWT_SECRET, {
    expiresIn: '15m', // Short-lived access token
  });

  const refreshToken = jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
    expiresIn: '7d', // 7 days
  });

  // Store refresh token in Redis (whitelist)
  await redis.set(`refresh_token:${userId}:${refreshToken}`, 'valid', 'EX', 7 * 24 * 60 * 60);

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string) => {
  return jwt.verify(token, env.JWT_SECRET) as { userId: string; role: string };
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { userId: string };
};

export const revokeRefreshToken = async (userId: string, token: string) => {
  await redis.del(`refresh_token:${userId}:${token}`);
};
