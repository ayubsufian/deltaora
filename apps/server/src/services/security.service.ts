import crypto from 'crypto';
import * as argon2 from 'argon2';
import { Request } from 'express';

export const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 32) =>
  crypto.randomBytes(bytes).toString('base64url');

export const getRequestIp = (req?: Request) => {
  const forwarded = req?.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return forwarded[0];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  return req?.ip || 'unknown';
};

export const hashRecoveryCode = (code: string) => argon2.hash(code);

export const generateRecoveryCodes = async (count = 10) => {
  const codes = Array.from({ length: count }, () => randomToken(9).match(/.{1,4}/g)!.join('-'));
  const hashes = await Promise.all(codes.map(hashRecoveryCode));
  return { codes, hashes };
};

export const verifyRecoveryCode = async (hashes: string[] = [], code: string) => {
  for (const hash of hashes) {
    if (await argon2.verify(hash, code)) {
      return hash;
    }
  }
  return null;
};
