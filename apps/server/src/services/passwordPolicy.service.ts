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
]);

interface PasswordPolicyContext {
  email?: string;
  name?: string;
  requireMfaBoundMinimum?: boolean;
}

export const validatePasswordPolicy = (
  password: string,
  context: PasswordPolicyContext = {}
): string[] => {
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
