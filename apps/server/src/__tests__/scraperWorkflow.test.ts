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
process.env.CRAWLER_ALLOW_PRIVATE_NETWORKS = 'false';

test('scraper URL safety rejects localhost, private IPs, and non-http schemes', async () => {
  const { assertSafeScrapeUrl } = await import('../services/urlSafety.service');

  await assert.rejects(() => assertSafeScrapeUrl('http://localhost:3000'), /blocked hostname/);
  await assert.rejects(() => assertSafeScrapeUrl('http://127.0.0.1:3000'), /private or reserved/);
  await assert.rejects(() => assertSafeScrapeUrl('file:///etc/passwd'), /http or https/);
});

test('HTML extraction can target include and exclude selectors', async () => {
  const { extractCleanText } = await import('../services/extractor.service');
  const html = `
    <main>
      <section class="pricing">
        <h1>Pricing</h1>
        <p>Starter is now $19.</p>
        <p class="volatile">Rendered at 10:01</p>
      </section>
      <section class="marketing"><p>Newsletter signup</p></section>
    </main>
  `;

  const result = extractCleanText(html, 'https://example.com/pricing', {
    includeSelectors: ['.pricing'],
    excludeSelectors: ['.volatile'],
  });

  assert.match(result.content, /Pricing/);
  assert.match(result.content, /Starter is now \$19/);
  assert.doesNotMatch(result.content, /Rendered at/);
  assert.doesNotMatch(result.content, /Newsletter/);
});

test('CSV extraction produces stable markdown content', async () => {
  const { extractFromBuffer } = await import('../services/extractor.service');
  const result = await extractFromBuffer(
    Buffer.from('plan,price\nstarter,19\npro,49\n'),
    'text/csv',
    'https://example.com/pricing.csv'
  );

  assert.equal(result.extractionMethod, 'csv');
  assert.match(result.content, /\| plan \| price \|/);
  assert.match(result.content, /\| starter \| 19 \|/);
});
