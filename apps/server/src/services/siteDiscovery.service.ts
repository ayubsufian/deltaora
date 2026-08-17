import { JSDOM } from 'jsdom';
import { assertRobotsAllowed } from './robots.service';
import { fetchBufferSafely } from './safeHttp.service';
import { assertSafeScrapeUrl } from './urlSafety.service';

export interface SiteDiscoveryOptions {
  maxDepth?: number;
  maxPages?: number;
  includeSubdomains?: boolean;
  includeSitemaps?: boolean;
  respectRobots?: boolean;
}

export interface DiscoveredUrl {
  url: string;
  depth: number;
  source: 'seed' | 'sitemap' | 'link' | 'canonical';
}

function normalizeUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  url.hash = '';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = '';
  }
  return url.href;
}

function isSameSite(candidate: URL, root: URL, includeSubdomains: boolean) {
  if (candidate.protocol !== 'http:' && candidate.protocol !== 'https:') return false;
  if (candidate.hostname === root.hostname) return true;
  return includeSubdomains && candidate.hostname.endsWith(`.${root.hostname}`);
}

function extractSitemapUrls(xml: string) {
  return Array.from(xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi))
    .map(match => match[1].trim())
    .filter(Boolean);
}

async function loadSitemapUrls(root: URL, options: Required<SiteDiscoveryOptions>) {
  const sitemapQueue = [
    new URL('/sitemap.xml', root.origin).href,
    new URL('/sitemap_index.xml', root.origin).href,
  ];
  const seenSitemaps = new Set<string>();
  const discovered: string[] = [];

  while (sitemapQueue.length && discovered.length < options.maxPages) {
    const sitemapUrl = sitemapQueue.shift()!;
    if (seenSitemaps.has(sitemapUrl)) continue;
    seenSitemaps.add(sitemapUrl);

    try {
      const response = await fetchBufferSafely(sitemapUrl, { maxBytes: 2_000_000 });
      if (response.status >= 400) continue;
      const body = response.buffer.toString('utf8');
      const urls = extractSitemapUrls(body);

      for (const rawUrl of urls) {
        const candidate = new URL(rawUrl, sitemapUrl);
        if (!isSameSite(candidate, root, options.includeSubdomains)) continue;

        if (candidate.pathname.toLowerCase().endsWith('.xml') && seenSitemaps.size < 100) {
          sitemapQueue.push(normalizeUrl(candidate.href));
        } else {
          discovered.push(normalizeUrl(candidate.href));
          if (discovered.length >= options.maxPages) break;
        }
      }
    } catch {
      // Sitemaps are optional discovery hints.
    }
  }

  return discovered.slice(0, options.maxPages);
}

function extractLinks(html: string, pageUrl: string, root: URL, includeSubdomains: boolean) {
  const dom = new JSDOM(html, { url: pageUrl });
  const document = dom.window.document;
  const urls = new Set<string>();

  const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href;
  if (canonical) {
    const canonicalUrl = new URL(canonical, pageUrl);
    if (isSameSite(canonicalUrl, root, includeSubdomains)) {
      urls.add(normalizeUrl(canonicalUrl.href));
    }
  }

  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
    try {
      const candidate = new URL(anchor.href, pageUrl);
      if (isSameSite(candidate, root, includeSubdomains)) {
        urls.add(normalizeUrl(candidate.href));
      }
    } catch {
      // Ignore malformed hrefs.
    }
  });

  dom.window.close();
  return Array.from(urls);
}

export async function discoverSite(rawUrl: string, options: SiteDiscoveryOptions = {}) {
  const root = await assertSafeScrapeUrl(rawUrl);
  const resolvedOptions: Required<SiteDiscoveryOptions> = {
    maxDepth: options.maxDepth ?? 1,
    maxPages: options.maxPages ?? 100,
    includeSubdomains: options.includeSubdomains ?? false,
    includeSitemaps: options.includeSitemaps ?? true,
    respectRobots: options.respectRobots ?? true,
  };

  const queue: Array<{ url: string; depth: number; source: DiscoveredUrl['source'] }> = [
    { url: normalizeUrl(root.href), depth: 0, source: 'seed' },
  ];
  const seen = new Set<string>();
  const results: DiscoveredUrl[] = [];

  if (resolvedOptions.includeSitemaps) {
    const sitemapUrls = await loadSitemapUrls(root, resolvedOptions);
    for (const sitemapUrl of sitemapUrls) {
      try {
        const candidate = await assertSafeScrapeUrl(sitemapUrl, 'sitemap URL');
        if (isSameSite(candidate, root, resolvedOptions.includeSubdomains)) {
          queue.push({ url: normalizeUrl(candidate.href), depth: 0, source: 'sitemap' });
        }
      } catch {
        // Skip unsafe or malformed sitemap entries.
      }
    }
  }

  while (queue.length && results.length < resolvedOptions.maxPages) {
    const current = queue.shift()!;
    if (seen.has(current.url)) continue;
    seen.add(current.url);

    const currentUrl = await assertSafeScrapeUrl(current.url);
    if (!isSameSite(currentUrl, root, resolvedOptions.includeSubdomains)) continue;

    if (resolvedOptions.respectRobots) {
      await assertRobotsAllowed(currentUrl.href);
    }

    results.push(current);
    if (current.depth >= resolvedOptions.maxDepth || results.length >= resolvedOptions.maxPages) continue;

    try {
      const response = await fetchBufferSafely(currentUrl.href, { maxBytes: 2_000_000 });
      if (response.status >= 400 || !response.contentType.toLowerCase().includes('html')) continue;

      for (const nextUrl of extractLinks(response.buffer.toString('utf8'), response.finalUrl, root, resolvedOptions.includeSubdomains)) {
        if (!seen.has(nextUrl)) {
          queue.push({ url: nextUrl, depth: current.depth + 1, source: 'link' });
        }
      }
    } catch {
      // Individual pages can fail without invalidating the discovery batch.
    }
  }

  return results;
}
