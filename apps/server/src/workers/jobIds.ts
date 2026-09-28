/**
 * Returns a BullMQ-safe ID for a crawl job.
 *
 * BullMQ uses `:` when building Redis keys, so custom job IDs must not contain
 * it. Mongoose ObjectIds are 24-character hexadecimal strings; validating that
 * invariant keeps an unexpected identifier from becoming a Redis-key bug.
 */
export const createCrawlQueueJobId = (databaseJobId: string): string => {
  if (!/^[a-f\d]{24}$/i.test(databaseJobId)) {
    throw new Error('Expected a MongoDB ObjectId when creating a crawl queue job ID.');
  }

  return `crawl-${databaseJobId}`;
};
