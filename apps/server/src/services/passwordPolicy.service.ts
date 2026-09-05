import crypto from 'crypto';
import { readFile } from 'fs/promises';
import path from 'path';
import { env } from '../config/env';

const COMMON_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'letmein123',
  'adminadmin',
  'welcome123',
  'changeme',
  'iloveyou',
  'deltaora',
  'deltaora123',
  'deltaoradeltaora',
  'changeme123',
  'defaultpassword',
  'newpassword',
  'newpassword123',
  'passwordpassword',
]);

const PWNED_PASSWORDS_RANGE_URL = 'https://api.pwnedpasswords.com/range';
const HASH_PREFIX_LENGTH = 5;
const HASH_SUFFIX_LENGTH = 35;
const SHA1_HEX_PATTERN = /^[0-9A-F]+$/;

interface PasswordPolicyContext {
  email?: string;
  name?: string;
  requireMfaBoundMinimum?: boolean;
}

interface CachedRange {
  suffixes: Set<string>;
  expiresAt: number;
}

const rangeCache = new Map<string, CachedRange>();

const getPasswordHashParts = (password: string) => {
  const hash = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  return {
    prefix: hash.slice(0, HASH_PREFIX_LENGTH),
    suffix: hash.slice(HASH_PREFIX_LENGTH),
  };
};

const parseRangeResponse = (body: string) => {
  const suffixes = new Set<string>();

  for (const line of body.split(/\r?\n/)) {
    const [rawSuffix, rawCount] = line.trim().split(':');
    const suffix = rawSuffix?.trim().toUpperCase();
    const count = Number.parseInt(rawCount || '', 10);

    if (
      suffix?.length === HASH_SUFFIX_LENGTH &&
      SHA1_HEX_PATTERN.test(suffix) &&
      Number.isFinite(count) &&
      count > 0
    ) {
      suffixes.add(suffix);
    }
  }

  return suffixes;
};

const getCachedRange = (prefix: string) => {
  const cached = rangeCache.get(prefix);
  if (!cached) return null;

  if (cached.expiresAt <= Date.now()) {
    rangeCache.delete(prefix);
    return null;
  }

  rangeCache.delete(prefix);
  rangeCache.set(prefix, cached);
  return cached.suffixes;
};

const cacheRange = (prefix: string, suffixes: Set<string>) => {
  if (env.PASSWORD_BREACH_SCREENING_CACHE_MAX_PREFIXES <= 0) return;

  rangeCache.set(prefix, {
    suffixes,
    expiresAt: Date.now() + env.PASSWORD_BREACH_SCREENING_CACHE_TTL_SECONDS * 1000,
  });

  while (rangeCache.size > env.PASSWORD_BREACH_SCREENING_CACHE_MAX_PREFIXES) {
    const oldestPrefix = rangeCache.keys().next().value;
    if (!oldestPrefix) break;
    rangeCache.delete(oldestPrefix);
  }
};

const readLocalRange = async (prefix: string) => {
  if (!env.PASSWORD_BREACH_SCREENING_LOCAL_DIR) {
    throw new Error('PASSWORD_BREACH_SCREENING_LOCAL_DIR is required when local breach screening is enabled');
  }

  const baseDir = path.resolve(env.PASSWORD_BREACH_SCREENING_LOCAL_DIR);
  const prefixFile = path.resolve(baseDir, `${prefix}.txt`);

  if (!prefixFile.startsWith(`${baseDir}${path.sep}`)) {
    throw new Error('Invalid local breach screening prefix path');
  }

  return parseRangeResponse(await readFile(prefixFile, 'utf8'));
};

const fetchRemoteRange = async (prefix: string) => {
  const response = await fetch(`${env.PWNED_PASSWORDS_RANGE_URL || PWNED_PASSWORDS_RANGE_URL}/${prefix}`, {
    headers: {
      Accept: 'text/plain',
      'Add-Padding': 'true',
      'User-Agent': env.PWNED_PASSWORDS_USER_AGENT,
    },
    signal: AbortSignal.timeout(env.PASSWORD_BREACH_SCREENING_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Compromised password check failed with status ${response.status}`);
  }

  return parseRangeResponse(await response.text());
};

const getRangeSuffixes = async (prefix: string) => {
  const cached = getCachedRange(prefix);
  if (cached) return cached;

  const suffixes = env.PASSWORD_BREACH_SCREENING_MODE === 'local'
    ? await readLocalRange(prefix)
    : await fetchRemoteRange(prefix);

  cacheRange(prefix, suffixes);
  return suffixes;
};

const hasCompromisedPasswordMatch = async (password: string) => {
  if (env.PASSWORD_BREACH_SCREENING_MODE === 'disabled') {
    return false;
  }

  const { prefix, suffix } = getPasswordHashParts(password);
  const suffixes = await getRangeSuffixes(prefix);
  return suffixes.has(suffix);
};

export const validatePasswordPolicy = async (
  password: string,
  context: PasswordPolicyContext = {}
): Promise<string[]> => {
  const errors: string[] = [];
  const normalized = password.normalize('NFC');
  const minLength = context.requireMfaBoundMinimum ? 8 : 15;

  if (normalized.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long.`);
  }

  if (normalized.length > 1024) {
    errors.push('Password must be 1024 characters or fewer.');
  }

  const lower = normalized.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) {
    errors.push('Choose a less common password.');
  }

  try {
    if (await hasCompromisedPasswordMatch(normalized)) {
      errors.push('Choose a password that has not appeared in known data breaches.');
    }
  } catch {
    if (env.PASSWORD_BREACH_SCREENING_FAILURE_POLICY === 'block') {
      errors.push('Password breach screening is temporarily unavailable. Please try again.');
    }
  }

  const emailParts = context.email?.toLowerCase().split('@');
  const emailLocal = emailParts?.[0];
  const emailDomain = emailParts?.[1]?.split('.')[0];

  const containsEmail =
    (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) ||
    (emailDomain && emailDomain.length >= 4 && lower.includes(emailDomain));

  if (containsEmail) {
    errors.push('Password must not contain your email address.');
  }

  const nameParts = context.name
    ? context.name.toLowerCase().split(/[\s_-]+/).map(p => p.replace(/[^a-z0-9]/g, '')).filter(p => p.length >= 4)
    : [];
  const passwordStripped = lower.replace(/[^a-z0-9]/g, '');
  if (nameParts.some(part => passwordStripped.includes(part))) {
    errors.push('Password must not contain your name.');
  }

  return errors;
};
