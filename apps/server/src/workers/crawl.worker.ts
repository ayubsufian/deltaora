import { Worker, Queue } from 'bullmq';
import { env } from '../config/env';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { Job as JobModel } from '../models/Job';
import { CrawlError, scrapeTarget } from '../services/scraper.service';
import { generateDiff } from '../services/diff.service';
import { CrawlStatus, JobStatus } from '@deltaora/shared-types';

export const summaryQueue = new Queue('summaryQueue', {
  connection: { url: env.REDIS_URL }
});

export const crawlWorker = new Worker('crawlQueue', async job => {
  const { pageId, jobId: dbJobId } = job.data;
  
  await JobModel.findByIdAndUpdate(dbJobId, { status: JobStatus.RUNNING, startedAt: new Date() });

  try {
    const page = await MonitoredPage.findById(pageId).select('+crawlerAuthEncrypted');
    if (!page) throw new Error('Page not found');
    const workspaceId = page.workspaceId;

    const scrape = await scrapeTarget(page.url, page.crawlerConfig, page.crawlerAuthEncrypted, {
      workspaceId: workspaceId.toString(),
    });
    const { content, contentHash } = scrape;

    const latestSnapshot = await Snapshot.findOne({ pageId, workspaceId }).sort({ createdAt: -1 });

    if (!latestSnapshot) {
      // First time checking this page
      await Snapshot.create({ pageId, workspaceId, content, contentHash });
    } else if (latestSnapshot.contentHash !== contentHash) {
      // Content changed!
      const newSnapshot = await Snapshot.create({ pageId, workspaceId, content, contentHash });
      
      const diffResult = generateDiff(latestSnapshot.content, content);
      
      // Only proceed if there are actual text changes (sometimes hash differs due to invisible whitespace, though extractor handles most)
      if (diffResult.changeScore > 0) {
        const diff = await Diff.create({
          pageId,
          workspaceId,
          previousSnapshotId: latestSnapshot.id,
          currentSnapshotId: newSnapshot.id,
          addedText: diffResult.addedText,
          removedText: diffResult.removedText,
          changeScore: diffResult.changeScore
        });

        // Enqueue AI Summary job
        await summaryQueue.add('summarize', { diffId: diff.id, pageId: page.id, workspaceId: workspaceId.toString() });
      }
    }

    await MonitoredPage.findByIdAndUpdate(pageId, {
      lastChecked: new Date(),
      lastCrawlStatus: CrawlStatus.SUCCESS,
      lastCrawlError: undefined,
      lastCrawlCode: undefined,
      lastHttpStatus: scrape.httpStatus,
      lastContentType: scrape.contentType,
      lastResolvedUrl: scrape.finalUrl,
      lastCrawlRecommendation: undefined,
    });
    await JobModel.findByIdAndUpdate(dbJobId, { status: JobStatus.COMPLETED, completedAt: new Date() });

  } catch (error) {
    const err = error as Error & { code?: string; statusCode?: number; crawlStatus?: CrawlStatus };
    const baseCrawlStatus =
      err instanceof CrawlError ? err.crawlStatus :
      err.statusCode === 403 ? CrawlStatus.BLOCKED :
      err.statusCode === 415 ? CrawlStatus.UNSUPPORTED :
      err.statusCode === 401 ? CrawlStatus.AUTH_REQUIRED :
      CrawlStatus.FAILED;
    const page = await MonitoredPage.findById(pageId);
    const shouldManualReview =
      baseCrawlStatus === CrawlStatus.BLOCKED &&
      page?.crawlerConfig?.compliance?.blockedHandling === 'manual_review';
    const crawlStatus = shouldManualReview ? CrawlStatus.MANUAL_REVIEW : baseCrawlStatus;
    const recommendation =
      crawlStatus === CrawlStatus.MANUAL_REVIEW
        ? 'Review the site manually or use an official API/webhook; Deltaora detected an access block and will not bypass anti-bot controls.'
        : crawlStatus === CrawlStatus.AUTH_REQUIRED
          ? 'Connect a recorded auth session or provide authorized cookies/storage state for this workspace.'
          : crawlStatus === CrawlStatus.UNSUPPORTED
            ? 'Enable binary fingerprinting or add a supported extractor for this content type.'
            : err.code === 'robots_disallowed'
              ? 'Robots policy prevents crawling this URL. Keep robots enabled for public sites or use an approved enterprise allowlist for owned/internal sites.'
              : undefined;

    await MonitoredPage.findByIdAndUpdate(pageId, {
      lastChecked: new Date(),
      lastCrawlStatus: crawlStatus,
      lastCrawlError: err.message,
      lastCrawlCode: err.code || 'crawl_failed',
      lastHttpStatus: err.statusCode,
      lastCrawlRecommendation: recommendation,
    });
    await JobModel.findByIdAndUpdate(dbJobId, {
      status: JobStatus.FAILED,
      completedAt: new Date(),
      error: err.message,
    });
    throw error;
  }
}, {
  connection: { url: env.REDIS_URL },
  concurrency: 5,
  limiter: { max: 30, duration: 60_000 },
});

crawlWorker.on('failed', (job, err) => {
  console.error(`Crawl job ${job?.id} failed with error:`, err);
});
