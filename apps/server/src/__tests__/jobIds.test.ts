import assert from 'node:assert/strict';
import test from 'node:test';
import { createCrawlQueueJobId } from '../workers/jobIds';

test('crawl queue IDs are BullMQ-safe and unique per execution record', () => {
  const first = createCrawlQueueJobId('66e19cc77d7ef4df8a7a49c1');
  const second = createCrawlQueueJobId('66e19cc77d7ef4df8a7a49c2');

  assert.equal(first, 'crawl-66e19cc77d7ef4df8a7a49c1');
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /:/);
  assert.doesNotMatch(first, /^\d+$/);
});

test('crawl queue IDs reject values that are not MongoDB ObjectIds', () => {
  assert.throws(
    () => createCrawlQueueJobId('crawl:66e19cc77d7ef4df8a7a49c1'),
    /MongoDB ObjectId/
  );
});
