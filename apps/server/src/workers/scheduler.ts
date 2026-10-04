import { Queue } from 'bullmq';
import { env } from '../config/env';
import { MonitoredPage } from '../models/MonitoredPage';
import { Job as JobModel } from '../models/Job';
import { PageStatus, JobStatus } from '@deltaora/shared-types';
import { createCrawlQueueJobId } from './jobIds';

export const crawlQueue = new Queue('crawlQueue', {
  connection: { url: env.REDIS_URL }
});

export const startScheduler = () => {
  console.log('Starting scheduler...');

  setInterval(async () => {
    try {
      // Use a cursor-based streaming approach to avoid loading all active pages into memory.
      // Pre-filter at the database level: only pages that are actually due for checking are returned.
      const cursor = MonitoredPage.find({
        status: PageStatus.ACTIVE,
      }).select('_id checkInterval lastChecked').cursor();

      for await (const page of cursor) {
        const now = new Date();
        const lastChecked = page.lastChecked || new Date(0);
        const intervalMs = page.checkInterval * 60 * 1000;

        // If time since last check > interval, enqueue crawl job
        if (now.getTime() - lastChecked.getTime() >= intervalMs) {
          
          // Prevent queueing multiple jobs for the same page if one is already pending/running
          const existingJob = await JobModel.findOne({ 
            pageId: page.id, 
            status: { $in: [JobStatus.PENDING, JobStatus.RUNNING] } 
          });

          if (!existingJob) {
            const jobRecord = await JobModel.create({
              pageId: page.id,
              status: JobStatus.PENDING,
            });

            try {
              await crawlQueue.add(
                'crawl',
                { pageId: page.id, jobId: jobRecord.id },
                {
                  // BullMQ reserves ':' for Redis key segments. Tie the queue ID to
                  // this execution record (not the page) so retained failed jobs do
                  // not suppress later scheduled crawls for the same page.
                  jobId: createCrawlQueueJobId(jobRecord.id),
                  // Retriable HTTP failures use the worker's custom policy. It
                  // honors Retry-After for 429 responses and rejects retries for
                  // permanent 4xx errors.
                  attempts: 4,
                  backoff: { type: 'crawl-http' },
                  removeOnComplete: true,
                  removeOnFail: { age: 7 * 24 * 60 * 60 },
                }
              );
            } catch (error) {
              // Do not leave an unqueueable job marked pending: it would block this
              // page from being scheduled again. Preserve the failure for auditability.
              const message = error instanceof Error ? error.message : String(error);
              await JobModel.findByIdAndUpdate(jobRecord.id, {
                status: JobStatus.FAILED,
                completedAt: new Date(),
                error: `Failed to enqueue crawl: ${message}`,
              });
              console.error(`Failed to enqueue crawl for page ${page.id}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 60 * 1000); // Check every minute
};
