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
      // Find all active pages
      const activePages = await MonitoredPage.find({ status: PageStatus.ACTIVE });

      for (const page of activePages) {
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

            await crawlQueue.add('crawl', { pageId: page.id, jobId: jobRecord.id });
          }
        }
      }
    } catch (error) {
      console.error('Scheduler error:', error);
    }
  }, 60 * 1000); // Check every minute
};
