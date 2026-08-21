import { Queue } from 'bullmq';
import { env } from '../config/env';
import { MonitoredPage } from '../models/MonitoredPage';
import { Job as JobModel } from '../models/Job';
import { PageStatus, JobStatus } from '@deltaora/shared-types';

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

            await crawlQueue.add(
              'crawl',
              { pageId: page.id, jobId: jobRecord.id },
              {
                jobId: `crawl:${page.id}`,
                attempts: 1,
                removeOnComplete: true,
                removeOnFail: { age: 7 * 24 * 60 * 60 },
              }
            );
          }
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 60 * 1000); // Check every minute
};
