import { Worker, Queue } from 'bullmq';
import { env } from '../config/env';
import { Diff } from '../models/Diff';
import { AISummary } from '../models/AISummary';
import { generateSummary } from '../services/ai.service';

export const notificationQueue = new Queue('notificationQueue', {
  connection: { url: env.REDIS_URL }
});

export const summaryWorker = new Worker('summaryQueue', async job => {
  const { diffId, pageId } = job.data;

  const diff = await Diff.findById(diffId);
  if (!diff) throw new Error('Diff not found');

  const { summary, importance, category } = await generateSummary(diff.addedText, diff.removedText);

  const aiSummary = await AISummary.create({
    diffId,
    summary,
    importance,
    category
  });

  // Enqueue notification job
  await notificationQueue.add('notify', { 
    pageId, 
    summaryId: aiSummary.id,
    summaryText: aiSummary.summary
  });

}, { connection: { url: env.REDIS_URL }, concurrency: 3 });

summaryWorker.on('failed', (job, err) => {
  console.error(`Summary job ${job?.id} failed with error:`, err);
});
