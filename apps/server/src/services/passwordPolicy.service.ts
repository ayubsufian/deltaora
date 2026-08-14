import crypto from 'crypto';

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

interface PasswordPolicyContext {
  email?: string;
  name?: string;
  requireMfaBoundMinimum?: boolean;
}

const hasCompromisedPasswordMatch = async (password: string) => {
  const hash = crypto.createHash('sha1').update(password, 'utf8').digest('hex').toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const response = await fetch(`${PWNED_PASSWORDS_RANGE_URL}/${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    signal: AbortSignal.timeout(3000),
  });

  if (!response.ok) {
    throw new Error(`Compromised password check failed with status ${response.status}`);
  }

  const body = await response.text();
  return body.split('\n').some(line => line.split(':')[0].trim().toUpperCase() === suffix);
};

export const validatePasswordPolicy = async (
  password: string,
  context: PasswordPolicyContext = {}
): Promise<string[]> => {
  const errors: string[] = [];
  const normalized = password.normalize('NFKC');
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
    errors.push('Password breach screening is temporarily unavailable. Please try again.');
  }

  const emailLocal = context.email?.split('@')[0]?.toLowerCase();
  if (emailLocal && emailLocal.length >= 4 && lower.includes(emailLocal)) {
    errors.push('Password must not contain your email address.');
  }

  const namePart = context.name?.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (namePart && namePart.length >= 4 && lower.replace(/[^a-z0-9]/g, '').includes(namePart)) {
    errors.push('Password must not contain your name.');
  }

  return errors;
};
