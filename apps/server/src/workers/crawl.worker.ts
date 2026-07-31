import { Worker, Queue } from 'bullmq';
import { env } from '../config/env';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { Job as JobModel } from '../models/Job';
import { fetchPageHTML } from '../services/scraper.service';
import { extractCleanText } from '../services/extractor.service';
import { generateDiff } from '../services/diff.service';
import { JobStatus } from '@deltaora/shared-types';

export const summaryQueue = new Queue('summaryQueue', {
  connection: { url: env.REDIS_URL }
});

export const crawlWorker = new Worker('crawlQueue', async job => {
  const { pageId, jobId: dbJobId } = job.data;
  
  await JobModel.findByIdAndUpdate(dbJobId, { status: JobStatus.RUNNING, startedAt: new Date() });

  try {
    const page = await MonitoredPage.findById(pageId);
    if (!page) throw new Error('Page not found');

    const html = await fetchPageHTML(page.url);
    const { content, contentHash } = extractCleanText(html);

    const latestSnapshot = await Snapshot.findOne({ pageId }).sort({ createdAt: -1 });

    if (!latestSnapshot) {
      // First time checking this page
      await Snapshot.create({ pageId, content, contentHash });
    } else if (latestSnapshot.contentHash !== contentHash) {
      // Content changed!
      const newSnapshot = await Snapshot.create({ pageId, content, contentHash });
      
      const diffResult = generateDiff(latestSnapshot.content, content);
      
      // Only proceed if there are actual text changes (sometimes hash differs due to invisible whitespace, though extractor handles most)
      if (diffResult.changeScore > 0) {
        const diff = await Diff.create({
          pageId,
          previousSnapshotId: latestSnapshot.id,
          currentSnapshotId: newSnapshot.id,
          addedText: diffResult.addedText,
          removedText: diffResult.removedText,
          changeScore: diffResult.changeScore
        });

        // Enqueue AI Summary job
        await summaryQueue.add('summarize', { diffId: diff.id, pageId: page.id });
      }
    }

    await MonitoredPage.findByIdAndUpdate(pageId, { lastChecked: new Date() });
    await JobModel.findByIdAndUpdate(dbJobId, { status: JobStatus.COMPLETED, completedAt: new Date() });

  } catch (error) {
    await JobModel.findByIdAndUpdate(dbJobId, { status: JobStatus.FAILED, completedAt: new Date() });
    throw error;
  }
}, { connection: { url: env.REDIS_URL }, concurrency: 5 });

crawlWorker.on('failed', (job, err) => {
  console.error(`Crawl job ${job?.id} failed with error:`, err);
});
