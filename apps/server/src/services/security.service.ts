import crypto from 'crypto';
import * as argon2 from 'argon2';
import { Request } from 'express';
import { env } from '../config/env';

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

const hmac = (secret: string, value: string) =>
  crypto.createHmac('sha256', secret).update(value).digest('base64url');

export const generateCsrfToken = () => {
  const token = randomToken(32);
  return `${token}.${hmac(env.CSRF_SECRET, token)}`;
};

export const verifyCsrfToken = (token?: string, cookieToken?: string) => {
  if (!token || !cookieToken || token !== cookieToken) return false;

  const [value, signature] = token.split('.');
  if (!value || !signature) return false;

  const expected = hmac(env.CSRF_SECRET, value);
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  );
};

const encryptionKey = () =>
  crypto.createHash('sha256').update(env.MFA_SECRET_ENCRYPTION_KEY).digest();

export const encryptSecret = (plaintext: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
};

export const decryptSecret = (value: string) => {
  if (!value.startsWith('v1.')) {
    return value;
  }

  const [, iv, tag, encrypted] = value.split('.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'base64url')
  );
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};
