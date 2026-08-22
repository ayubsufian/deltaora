import { Worker } from 'bullmq';
import { env } from '../config/env';
import { MonitoredPage } from '../models/MonitoredPage';
import { Workspace } from '../models/Workspace';
import { createNotification } from '../services/notification.service';

export const notificationWorker = new Worker('notificationQueue', async job => {
  const { pageId, summaryId, summaryText, importance } = job.data;

  const page = await MonitoredPage.findById(pageId);
  if (!page) throw new Error('Page not found');

  // 2026 standard: Notify all workspace members, not just the page creator
  const workspace = await Workspace.findById(page.workspaceId);
  if (!workspace) throw new Error('Workspace not found');

  const importanceRank: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  const changeImportance = importanceRank[importance] ?? 1;

  await Promise.allSettled(
    workspace.members.map(async (member) => {
      try {
        await createNotification(
          member.userId.toString(),
          page.id,
          summaryId,
          page.title,
          summaryText,
          page.url,
          changeImportance,
        );
      } catch (err) {
        console.error(`Failed to notify member ${member.userId}:`, err);
      }
    })
  );

}, { connection: { url: env.REDIS_URL }, concurrency: 10 });

notificationWorker.on('failed', (job, err) => {
  console.error(`Notification job ${job?.id} failed with error:`, err);
});
