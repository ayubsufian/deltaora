import test from 'node:test';
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

test('CSRF tokens validate only when the signed header and cookie match', async () => {
  const { generateCsrfToken, verifyCsrfToken } = await import('../services/security.service');
  const token = generateCsrfToken();

  assert.equal(verifyCsrfToken(token, token), true);
  assert.equal(verifyCsrfToken(token, undefined), false);
  assert.equal(verifyCsrfToken(`${token.slice(0, -1)}x`, token), false);
  assert.equal(verifyCsrfToken(`${token}tampered`, `${token}tampered`), false);
});

test('MFA secrets are encrypted and reversible with the configured key', async () => {
  const { decryptSecret, encryptSecret } = await import('../services/security.service');
  const secret = 'JBSWY3DPEHPK3PXP';
  const encrypted = encryptSecret(secret);

  assert.notEqual(encrypted, secret);
  assert.match(encrypted, /^v1\./);
  assert.equal(decryptSecret(encrypted), secret);
});

test('recovery codes are hashed and single-code verification returns the matching hash', async () => {
  const { generateRecoveryCodes, verifyRecoveryCode } = await import('../services/security.service');
  const { codes, hashes } = await generateRecoveryCodes(2);

  assert.equal(codes.length, 2);
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0], codes[0]);
  assert.equal(await verifyRecoveryCode(hashes, 'not-a-code'), null);

  const matchingHash = await verifyRecoveryCode(hashes, codes[0]);
  assert.ok(matchingHash);
  assert.ok(hashes.includes(matchingHash));
});
