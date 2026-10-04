const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;
const MAX_RETRY_AFTER_MS = 24 * 60 * 60 * 1000;
const MAX_TRANSIENT_RETRY_MS = 15 * 60 * 1000;

export interface RetryableCrawlError extends Error {
  statusCode?: number;
  retryAfterMs?: number;
}

/** Parses both forms permitted by RFC 9110: delay-seconds and an HTTP date. */
export const parseRetryAfter = (value: string | null | undefined, now = Date.now()): number | undefined => {
  if (!value) return undefined;

  const trimmed = value.trim();
  const delaySeconds = /^\d+$/.test(trimmed) ? Number(trimmed) : undefined;
  const requestedDelay = delaySeconds === undefined ? Date.parse(trimmed) - now : delaySeconds * 1000;

  if (!Number.isFinite(requestedDelay)) return undefined;
  return Math.min(Math.max(0, requestedDelay), MAX_RETRY_AFTER_MS);
};

/** Removes credentials, signed parameters, and fragments before an URL is persisted or logged. */
export const redactUrlForLogs = (rawUrl: string): string => {
  try {
    const url = new URL(rawUrl);
    url.username = '';
    url.password = '';
    url.search = url.search ? '?[redacted]' : '';
    url.hash = '';
    return url.href;
  } catch {
    return '[invalid URL]';
  }
};

export const getCrawlRetryDelay = (attemptsMade: number, error: RetryableCrawlError): number => {
  if (error.statusCode === 429) {
    // Retry-After is a minimum delay. Add only positive jitter to avoid a
    // thundering herd while never retrying before the target permits it.
    const minimumDelay = error.retryAfterMs ?? DEFAULT_RATE_LIMIT_RETRY_MS;
    return minimumDelay + Math.floor(Math.random() * Math.max(1_000, minimumDelay * 0.1));
  }

  if (error.statusCode === 408 || (error.statusCode !== undefined && error.statusCode >= 500)) {
    const exponentialDelay = Math.min(30_000 * 2 ** Math.max(0, attemptsMade - 1), MAX_TRANSIENT_RETRY_MS);
    return exponentialDelay + Math.floor(Math.random() * exponentialDelay * 0.1);
  }

  return -1;
};
