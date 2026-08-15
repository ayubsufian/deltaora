import crypto from 'crypto';
import test, { afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/deltaora-test';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.JWT_SECRET = 'test-access-secret-with-at-least-thirty-two-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-with-at-least-thirty-two-characters';
process.env.CSRF_SECRET = 'test-csrf-secret-with-at-least-thirty-two-characters';
process.env.MFA_SECRET_ENCRYPTION_KEY = 'test-mfa-encryption-key-with-at-least-thirty-two-characters';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.GEMINI_API_KEY = 'test-gemini-key';
process.env.PASSWORD_BREACH_SCREENING_MODE = 'api';
process.env.PASSWORD_BREACH_SCREENING_FAILURE_POLICY = 'block';
process.env.PASSWORD_BREACH_SCREENING_CACHE_MAX_PREFIXES = '0';
process.env.PWNED_PASSWORDS_USER_AGENT = 'Deltaora test password screening';

afterEach(() => {
  mock.restoreAll();
});

const hashParts = (password: string) => {
  const hash = crypto.createHash('sha1').update(password.normalize('NFC'), 'utf8').digest('hex').toUpperCase();
  return { prefix: hash.slice(0, 5), suffix: hash.slice(5) };
};

test('password breach screening uses HIBP range privacy headers and rejects matching hashes', async () => {
  const password = 'long unique passphrase for test';
  const { prefix, suffix } = hashParts(password);

  mock.method(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(input), `https://api.pwnedpasswords.com/range/${prefix}`);

    const headers = new Headers(init?.headers);
    assert.equal(headers.get('Add-Padding'), 'true');
    assert.equal(headers.get('User-Agent'), 'Deltaora test password screening');

    return new Response(`${suffix}:7\n${'A'.repeat(35)}:0\n`, { status: 200 });
  });

  const { validatePasswordPolicy } = await import('../services/passwordPolicy.service');
  const errors = await validatePasswordPolicy(password, {
    email: 'owner@example.com',
    name: 'Delta Owner',
  });

  assert.ok(errors.includes('Choose a password that has not appeared in known data breaches.'));
});

test('password breach screening fails closed when the configured source is unavailable', async () => {
  mock.method(globalThis, 'fetch', async () => new Response('', { status: 503 }));

  const { validatePasswordPolicy } = await import('../services/passwordPolicy.service');
  const errors = await validatePasswordPolicy('another long unique passphrase', {
    email: 'owner@example.com',
    name: 'Delta Owner',
  });

  assert.ok(errors.includes('Password breach screening is temporarily unavailable. Please try again.'));
});
