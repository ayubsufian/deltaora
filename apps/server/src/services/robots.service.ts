import robotsParser from 'robots-parser';
import { env } from '../config/env';
import { fetchBufferSafely } from './safeHttp.service';

interface RobotsCacheEntry {
  expiresAt: number;
  status: 'allowed' | 'blocked' | 'unavailable';
  body?: string;
}

export class RobotsBlockedError extends Error {
  code = 'robots_disallowed';
  statusCode = 403;

  constructor(message: string) {
    super(message);
    this.name = 'RobotsBlockedError';
  }
}

const cache = new Map<string, RobotsCacheEntry>();

function cacheEntry(origin: string, entry: Omit<RobotsCacheEntry, 'expiresAt'>) {
  cache.set(origin, {
    ...entry,
    expiresAt: Date.now() + env.CRAWLER_ROBOTS_CACHE_SECONDS * 1000,
  });
}

async function getRobotsEntry(targetUrl: URL): Promise<RobotsCacheEntry> {
  const origin = targetUrl.origin;
  const cached = cache.get(origin);

  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const robotsUrl = new URL('/robots.txt', origin).href;

  try {
    const response = await fetchBufferSafely(robotsUrl, {
      maxBytes: env.CRAWLER_ROBOTS_MAX_BYTES,
      headers: { Accept: 'text/plain,*/*;q=0.8' },
    });

    if (response.status >= 500 || response.status === 429) {
      cacheEntry(origin, { status: 'unavailable' });
    } else if (response.status === 401 || response.status === 403) {
      cacheEntry(origin, { status: 'blocked' });
    } else if (response.status >= 400) {
      cacheEntry(origin, { status: 'allowed' });
    } else {
      cacheEntry(origin, { status: 'allowed', body: response.buffer.toString('utf8') });
    }
  } catch {
    cacheEntry(origin, { status: 'unavailable' });
  }

  return cache.get(origin)!;
}

export async function assertRobotsAllowed(rawTargetUrl: string) {
  if (!env.CRAWLER_RESPECT_ROBOTS) return;

  const targetUrl = new URL(rawTargetUrl);
  const entry = await getRobotsEntry(targetUrl);

  if (entry.status === 'blocked') {
    throw new RobotsBlockedError(`robots.txt blocks access to ${targetUrl.origin}`);
  }

  if (entry.status === 'unavailable') {
    throw new RobotsBlockedError(`robots.txt is unavailable for ${targetUrl.origin}; crawler is failing closed`);
  }

  if (!entry.body) return;

  const robots = robotsParser(new URL('/robots.txt', targetUrl.origin).href, entry.body);
  const crawlerAllowed = robots.isAllowed(targetUrl.href, 'DeltaoraBot');
  const fallbackAllowed = robots.isAllowed(targetUrl.href, '*');
  const allowed = crawlerAllowed ?? fallbackAllowed ?? true;

  if (!allowed) {
    throw new RobotsBlockedError(`robots.txt disallows crawling ${targetUrl.href}`);
  }

  const crawlDelay = robots.getCrawlDelay('DeltaoraBot') ?? robots.getCrawlDelay('*');
  if (typeof crawlDelay === 'number' && crawlDelay > 0) {
    return { crawlDelayMs: crawlDelay * 1000 };
  }

  return { crawlDelayMs: 0 };
}
