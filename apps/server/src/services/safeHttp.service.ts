import { env } from '../config/env';
import { assertSafeScrapeUrl } from './urlSafety.service';

export interface SafeFetchResult {
  finalUrl: string;
  status: number;
  contentType: string;
  headers: Headers;
  buffer: Buffer;
}

export async function fetchBufferSafely(
  rawUrl: string,
  options: { method?: 'GET' | 'HEAD'; maxBytes?: number; headers?: Record<string, string> } = {}
): Promise<SafeFetchResult> {
  let currentUrl = (await assertSafeScrapeUrl(rawUrl)).href;
  const maxBytes = options.maxBytes ?? env.CRAWLER_MAX_BYTES;
  const method = options.method ?? 'GET';

  for (let redirectCount = 0; redirectCount <= env.CRAWLER_MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(currentUrl, {
      method,
      redirect: 'manual',
      headers: {
        'User-Agent': env.CRAWLER_USER_AGENT,
        'Accept': method === 'HEAD' ? '*/*' : 'text/html,application/xhtml+xml,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,text/csv,application/json,image/*,audio/*,video/*,*/*;q=0.8',
        ...options.headers,
      },
      signal: AbortSignal.timeout(30_000),
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) {
        return {
          finalUrl: currentUrl,
          status: response.status,
          contentType: response.headers.get('content-type') || '',
          headers: response.headers,
          buffer: Buffer.alloc(0),
        };
      }

      currentUrl = (await assertSafeScrapeUrl(new URL(location, currentUrl).href, 'redirect URL')).href;
      continue;
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength && Number(contentLength) > maxBytes) {
      throw new Error(`Response is too large (${contentLength} bytes)`);
    }

    if (method === 'HEAD') {
      return {
        finalUrl: currentUrl,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        headers: response.headers,
        buffer: Buffer.alloc(0),
      };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return {
        finalUrl: currentUrl,
        status: response.status,
        contentType: response.headers.get('content-type') || '',
        headers: response.headers,
        buffer: Buffer.alloc(0),
      };
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        throw new Error(`Response exceeded ${maxBytes} byte limit`);
      }
      chunks.push(Buffer.from(value));
    }

    return {
      finalUrl: currentUrl,
      status: response.status,
      contentType: response.headers.get('content-type') || '',
      headers: response.headers,
      buffer: Buffer.concat(chunks),
    };
  }

  throw new Error(`Too many redirects while fetching ${rawUrl}`);
}
