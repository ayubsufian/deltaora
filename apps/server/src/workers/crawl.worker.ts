import { Worker, Queue } from 'bullmq';
import { env } from '../config/env';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { Job as JobModel } from '../models/Job';
import { CrawlError, scrapeTarget } from '../services/scraper.service';
import { getCrawlRetryDelay, redactUrlForLogs, RetryableCrawlError } from '../services/crawlRetry.service';
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
      lastResolvedUrl: redactUrlForLogs(scrape.finalUrl),
      lastCrawlRecommendation: undefined,
    });
    await JobModel.findByIdAndUpdate(dbJobId, { status: JobStatus.COMPLETED, completedAt: new Date() });

  } catch (error) {
    const err = error as Error & { code?: string; statusCode?: number; crawlStatus?: CrawlStatus };
    const baseCrawlStatus =
      err instanceof CrawlError ? err.crawlStatus :
      err.statusCode === 429 ? CrawlStatus.RATE_LIMITED :
      err.statusCode === 403 ? CrawlStatus.BLOCKED :
      err.statusCode === 415 ? CrawlStatus.UNSUPPORTED :
      err.statusCode === 401 ? CrawlStatus.AUTH_REQUIRED :
      CrawlStatus.FAILED;
    const page = await MonitoredPage.findById(pageId);
    const shouldManualReview =
      baseCrawlStatus === CrawlStatus.BLOCKED &&
      page?.crawlerConfig?.compliance?.blockedHandling === 'manual_review';
    const crawlStatus = shouldManualReview ? CrawlStatus.MANUAL_REVIEW : baseCrawlStatus;
    const retryDelay = getCrawlRetryDelay(job.attemptsMade + 1, err as RetryableCrawlError);
    const willRetry = retryDelay >= 0 && job.attemptsMade + 1 < (job.opts.attempts ?? 1);
    const recommendation =
      crawlStatus === CrawlStatus.MANUAL_REVIEW
        ? 'Review the site manually or use an authorized data source; Deltaora detected an access block and will not bypass anti-bot controls.'
        : crawlStatus === CrawlStatus.AUTH_REQUIRED
          ? 'Connect a recorded auth session or provide authorized cookies/storage state for this workspace.'
          : crawlStatus === CrawlStatus.UNSUPPORTED
          ? 'Enable binary fingerprinting or add a supported extractor for this content type.'
          : crawlStatus === CrawlStatus.RATE_LIMITED
            ? willRetry
              ? 'The target rate-limited this crawl. Deltaora will retry automatically after the requested backoff.'
              : 'The target rate-limited this crawl repeatedly. Check the provider quota and try again after its rate limit resets.'
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
    await JobModel.findByIdAndUpdate(
      dbJobId,
      willRetry
        ? { status: JobStatus.PENDING, error: err.message }
        : { status: JobStatus.FAILED, completedAt: new Date(), error: err.message }
    );
    throw error;
  }
}, {
  connection: { url: env.REDIS_URL },
  concurrency: 5,
  limiter: { max: 30, duration: 60_000 },
  settings: {
    backoffStrategy: (attemptsMade, type, error) =>
      type === 'crawl-http' && error
        ? getCrawlRetryDelay(attemptsMade, error as RetryableCrawlError)
        : -1,
  },
});

crawlWorker.on('failed', (job, err) => {
  const safeMessage = err instanceof Error ? err.message.replace(/https?:\/\/\S+/g, redactUrlForLogs) : String(err);
  const retryDelay = getCrawlRetryDelay(job?.attemptsMade ?? 1, err as RetryableCrawlError);
  const willRetry = retryDelay >= 0 && (job?.attemptsMade ?? 1) < (job?.opts.attempts ?? 1);

  if (willRetry) {
    console.warn(`Crawl job ${job?.id} is retrying after a transient failure: ${safeMessage}`);
    return;
  }

  console.error(`Crawl job ${job?.id} failed permanently: ${safeMessage}`);
});
