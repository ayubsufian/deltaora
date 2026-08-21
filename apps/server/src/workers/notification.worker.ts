import { Worker } from 'bullmq';
import { env } from '../config/env';
import { MonitoredPage } from '../models/MonitoredPage';
import { createNotification } from '../services/notification.service';

export const notificationWorker = new Worker('notificationQueue', async job => {
  const { pageId, summaryId, summaryText } = job.data;

  const page = await MonitoredPage.findById(pageId);
  if (!page) throw new Error('Page not found');

  await createNotification(page.userId, page.id, summaryId, page.title, summaryText, page.url);

}, { connection: { url: env.REDIS_URL }, concurrency: 10 });

notificationWorker.on('failed', (job, err) => {
  console.error(`Notification job ${job?.id} failed with error:`, err);
});
