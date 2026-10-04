import assert from 'node:assert/strict';
import test from 'node:test';
import { getCrawlRetryDelay, parseRetryAfter, redactUrlForLogs } from '../services/crawlRetry.service';

test('parses both Retry-After formats and caps untrusted waits', () => {
  const now = Date.UTC(2026, 8, 28, 12, 0, 0);

  assert.equal(parseRetryAfter('120', now), 120_000);
  assert.equal(parseRetryAfter('Mon, 28 Sep 2026 12:02:00 GMT', now), 120_000);
  assert.equal(parseRetryAfter('not-valid', now), undefined);
  assert.equal(parseRetryAfter('999999999', now), 86_400_000);
});

test('redacts URL credentials and signed query data before logging', () => {
  const safeUrl = redactUrlForLogs('https://user:password@example.com/v1/latest?access_key=secret-value#fragment');

  assert.equal(safeUrl, 'https://example.com/v1/latest?[redacted]');
  assert.doesNotMatch(safeUrl, /secret-value|password|fragment/);
});

test('retries only transient HTTP failures', () => {
  assert.ok(getCrawlRetryDelay(1, Object.assign(new Error('rate limited'), { statusCode: 429, retryAfterMs: 120_000 })) >= 120_000);
  assert.ok(getCrawlRetryDelay(1, Object.assign(new Error('unavailable'), { statusCode: 503 })) >= 30_000);
  assert.equal(getCrawlRetryDelay(1, Object.assign(new Error('not found'), { statusCode: 404 })), -1);
});
