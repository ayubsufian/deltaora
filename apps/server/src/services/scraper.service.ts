import { chromium, Browser, BrowserContext, BrowserContextOptions, Page } from 'playwright';
import crypto from 'crypto';
import { CrawlStatus, ICrawlerAuthConfig, ICrawlerConfig, ICrawlerRecipeStep } from '@deltaora/shared-types';
import { env } from '../config/env';
import { decryptSecret } from './security.service';
import { assertRobotsAllowed } from './robots.service';
import { fetchBufferSafely } from './safeHttp.service';
import { assertSafeScrapeUrl } from './urlSafety.service';
import { extractCleanText, extractFromBuffer } from './extractor.service';
import { CrawlerAuthSession } from '../models/CrawlerAuthSession';

let browserInstance: Browser | null = null;
const hostLastStartedAt = new Map<string, number>();

export class CrawlError extends Error {
  code: string;
  statusCode: number;
  crawlStatus: CrawlStatus;

  constructor(message: string, code: string, crawlStatus: CrawlStatus, statusCode = 500) {
    super(message);
    this.name = 'CrawlError';
    this.code = code;
    this.crawlStatus = crawlStatus;
    this.statusCode = statusCode;
  }
}

export interface ScrapeResult {
  content: string;
  contentHash: string;
  finalUrl: string;
  httpStatus: number;
  contentType: string;
  extractionMethod: string;
  blockedSubresourceCount: number;
}

interface InternalCrawlerConfig extends ICrawlerConfig {
  auth?: ICrawlerAuthConfig;
}

interface ScrapeContext {
  workspaceId?: string;
}

interface CapturedApiResponse {
  url: string;
  status: number;
  contentType: string;
  body: unknown;
}

const DOCUMENT_EXTENSIONS = [
  '.pdf',
  '.docx',
  '.csv',
  '.xlsx',
  '.pptx',
  '.json',
  '.xml',
  '.txt',
  '.md',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.mp3',
  '.wav',
  '.mp4',
  '.webm',
];

const DISALLOWED_HEADER_NAMES = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'upgrade',
]);

export const getBrowser = async (): Promise<Browser> => {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--window-size=1365,900',
      ],
    });
  }
  return browserInstance;
};

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function hydrateCrawlerConfig(
  config?: ICrawlerConfig,
  crawlerAuthEncrypted?: string,
  scrapeContext: ScrapeContext = {}
): Promise<InternalCrawlerConfig> {
  const hydrated: InternalCrawlerConfig = { ...(config || {}) };

  if (hydrated.authSessionId && scrapeContext.workspaceId) {
    const session = await CrawlerAuthSession.findOne({
      _id: hydrated.authSessionId,
      workspaceId: scrapeContext.workspaceId,
    }).select('+storageStateEncrypted');

    if (session) {
      hydrated.auth = {
        ...(hydrated.auth || {}),
        storageState: JSON.parse(decryptSecret(session.storageStateEncrypted)),
      };
      await CrawlerAuthSession.findByIdAndUpdate(session.id, { lastUsedAt: new Date() });
    }
  }

  if (!crawlerAuthEncrypted) return hydrated;

  try {
    const authFromPage = JSON.parse(decryptSecret(crawlerAuthEncrypted)) as ICrawlerAuthConfig;
    return {
      ...hydrated,
      auth: {
        ...(hydrated.auth || {}),
        ...authFromPage,
      },
    };
  } catch {
    throw new CrawlError('Stored crawler auth configuration could not be decrypted', 'invalid_crawler_auth', CrawlStatus.FAILED);
  }
}

function sanitizeHeaders(headers?: Record<string, string>) {
  const sanitized: Record<string, string> = {};

  for (const [name, value] of Object.entries(headers || {})) {
    const normalizedName = name.toLowerCase();
    if (!DISALLOWED_HEADER_NAMES.has(normalizedName)) {
      sanitized[name] = value;
    }
  }

  return sanitized;
}

function isLikelyHtml(contentType: string, url: string) {
  const type = contentType.toLowerCase().split(';')[0].trim();
  const pathname = new URL(url).pathname.toLowerCase();

  if (type.includes('html') || type === 'application/xhtml+xml') return true;
  if (type && !type.startsWith('text/html')) return false;
  return !DOCUMENT_EXTENSIONS.some(extension => pathname.endsWith(extension));
}

function assertSuccessfulHttpStatus(status: number, url: string) {
  if (status === 401 || status === 403) {
    throw new CrawlError(`Authentication or permission is required for ${url}`, 'auth_required', CrawlStatus.AUTH_REQUIRED, status);
  }

  if (status >= 400) {
    throw new CrawlError(`Target returned HTTP ${status} for ${url}`, 'bad_http_status', CrawlStatus.FAILED, status);
  }
}

async function waitForHostSlot(origin: string, minDelayMs: number) {
  if (minDelayMs <= 0) return;

  const lastStartedAt = hostLastStartedAt.get(origin) || 0;
  const waitMs = Math.max(0, lastStartedAt + minDelayMs - Date.now());

  if (waitMs > 0) {
    await new Promise(resolve => setTimeout(resolve, waitMs));
  }

  hostLastStartedAt.set(origin, Date.now());
}

async function createContext(browser: Browser, targetUrl: string, config: InternalCrawlerConfig): Promise<BrowserContext> {
  const proxyUrl = env.PROXY_URL;
  const customHeaders = sanitizeHeaders(config.auth?.headers);

  const contextOptions: BrowserContextOptions = {
    userAgent: env.CRAWLER_USER_AGENT,
    viewport: { width: 1365, height: 900 },
    locale: config.behavior?.locale || 'en-US',
    timezoneId: config.behavior?.timezoneId || 'America/New_York',
    javaScriptEnabled: true,
    ignoreHTTPSErrors: false,
    extraHTTPHeaders: {
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
      'Accept-Language': config.behavior?.locale ? `${config.behavior.locale},en;q=0.8` : 'en-US,en;q=0.9',
      ...customHeaders,
    },
  };

  if (config.auth?.storageState) {
    contextOptions.storageState = config.auth.storageState as any;
  }

  if (proxyUrl) {
    const proxyUrlObj = new URL(proxyUrl);
    contextOptions.proxy = {
      server: `${proxyUrlObj.protocol}//${proxyUrlObj.hostname}:${proxyUrlObj.port}`,
      username: proxyUrlObj.username || undefined,
      password: proxyUrlObj.password || undefined,
    };
  }

  const context = await browser.newContext(contextOptions);

  if (config.auth?.cookies?.length) {
    await context.addCookies(config.auth.cookies.map(cookie => ({
      ...cookie,
      url: cookie.domain ? undefined : targetUrl,
      domain: cookie.domain,
      path: cookie.path || '/',
    })));
  }

  return context;
}

function matchesPattern(url: string, patterns: string[] = []) {
  if (!patterns.length) return false;

  return patterns.some(pattern => {
    try {
      return new RegExp(pattern).test(url);
    } catch {
      return url.includes(pattern);
    }
  });
}

function shouldCaptureApiResponse(url: string, contentType: string, config: InternalCrawlerConfig) {
  if (!config.apiCapture?.enabled) return false;
  if (!contentType.toLowerCase().includes('json')) return false;
  if (matchesPattern(url, config.apiCapture.excludeUrlPatterns)) return false;
  if (config.apiCapture.includeUrlPatterns?.length) {
    return matchesPattern(url, config.apiCapture.includeUrlPatterns);
  }
  return true;
}

function capturedApiToMarkdown(responses: CapturedApiResponse[]) {
  if (!responses.length) return '';

  return [
    '# Captured API responses',
    ...responses.map((response, index) => [
      `## Response ${index + 1}`,
      '',
      `URL: ${response.url}`,
      `Status: ${response.status}`,
      `Content type: ${response.contentType}`,
      '',
      '```json',
      JSON.stringify(response.body, null, 2),
      '```',
    ].join('\n')),
  ].join('\n\n');
}

function mergeExtractedContent(content: string, extraContent: string, mode: 'append' | 'prefer' = 'append') {
  if (!extraContent) {
    return { content, contentHash: hashContent(content) };
  }

  const merged = mode === 'prefer'
    ? extraContent
    : [content, extraContent].filter(Boolean).join('\n\n---\n\n');

  return { content: merged, contentHash: hashContent(merged) };
}

async function acceptCommonCookieBanners(page: Awaited<ReturnType<BrowserContext['newPage']>>) {
  const buttonNames = [
    /^(accept|agree|allow|ok)$/i,
    /accept all/i,
    /allow all/i,
    /i agree/i,
    /got it/i,
  ];

  for (const name of buttonNames) {
    const button = page.getByRole('button', { name }).first();
    if (await button.count().catch(() => 0)) {
      await button.click({ timeout: 1500 }).catch(() => undefined);
      return;
    }
  }
}

async function scrollToBottom(page: Awaited<ReturnType<BrowserContext['newPage']>>) {
  for (let index = 0; index < 8; index++) {
    const reachedBottom = await page.evaluate(() => {
      const before = window.scrollY;
      window.scrollTo(0, document.body.scrollHeight);
      return before === window.scrollY || window.innerHeight + window.scrollY >= document.body.scrollHeight;
    });
    await page.waitForTimeout(500);
    if (reachedBottom) break;
  }
}

function recipeTimeout(timeoutMs?: number) {
  return timeoutMs ?? 10_000;
}

function urlPattern(pattern: string) {
  try {
    return new RegExp(pattern);
  } catch {
    return pattern;
  }
}

async function executeRecipeStep(page: Page, step: ICrawlerRecipeStep) {
  switch (step.action) {
    case 'waitForSelector':
      await page.waitForSelector(step.selector, { timeout: recipeTimeout(step.timeoutMs) });
      break;
    case 'click':
      await page.locator(step.selector).first().click({ timeout: recipeTimeout(step.timeoutMs) });
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
      break;
    case 'clickText':
      await page.getByText(step.text, { exact: false }).first().click({ timeout: recipeTimeout(step.timeoutMs) });
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
      break;
    case 'fill':
      await page.locator(step.selector).first().fill(step.value, { timeout: recipeTimeout(step.timeoutMs) });
      break;
    case 'selectOption':
      await page.locator(step.selector).first().selectOption(step.value, { timeout: recipeTimeout(step.timeoutMs) });
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
      break;
    case 'check':
      await page.locator(step.selector).first().check({ timeout: recipeTimeout(step.timeoutMs) });
      break;
    case 'uncheck':
      await page.locator(step.selector).first().uncheck({ timeout: recipeTimeout(step.timeoutMs) });
      break;
    case 'press':
      await page.locator(step.selector).first().press(step.key, { timeout: recipeTimeout(step.timeoutMs) });
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
      break;
    case 'hover':
      await page.locator(step.selector).first().hover({ timeout: recipeTimeout(step.timeoutMs) });
      break;
    case 'waitForURL':
      await page.waitForURL(urlPattern(step.pattern), { timeout: recipeTimeout(step.timeoutMs) });
      break;
    case 'waitMs':
      await page.waitForTimeout(step.value);
      break;
    case 'scrollToBottom':
      await scrollToBottom(page);
      break;
  }
}

async function executeRecipeSteps(page: Page, steps: ICrawlerRecipeStep[] = []) {
  for (const step of steps) {
    await executeRecipeStep(page, step);
  }
}

async function extractCurrentPage(page: Page, config: InternalCrawlerConfig, label?: string) {
  const currentUrl = page.url();
  await assertSafeScrapeUrl(currentUrl, 'current URL');
  const html = await page.content();
  const extracted = extractCleanText(html, currentUrl, config.extraction);

  if (!extracted.content) return extracted;
  if (!label) return extracted;

  const content = `# ${label}\n\nURL: ${currentUrl}\n\n${extracted.content}`;
  return {
    content,
    contentHash: hashContent(content),
    extractionMethod: extracted.extractionMethod,
  };
}

async function collectPaginatedContent(page: Page, config: InternalCrawlerConfig) {
  const sections = [await extractCurrentPage(page, config, config.pagination ? 'Page 1' : undefined)];
  const maxPages = config.pagination?.maxPages ?? 1;

  for (let pageIndex = 2; pageIndex <= maxPages; pageIndex++) {
    const nextSelector = config.pagination?.nextSelector;
    const nextText = config.pagination?.nextText;
    if (!nextSelector && !nextText) break;

    const next = nextSelector
      ? page.locator(nextSelector).first()
      : page.getByText(nextText!, { exact: false }).first();

    const isVisible = await next.isVisible({ timeout: 1500 }).catch(() => false);
    const isDisabled = await next.isDisabled({ timeout: 1000 }).catch(() => false);
    if (!isVisible || isDisabled) break;

    await next.click({ timeout: 5000 });
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
    if (config.pagination?.waitForSelector) {
      await page.waitForSelector(config.pagination.waitForSelector, { timeout: 10_000 });
    }
    await page.waitForTimeout(config.behavior?.waitAfterLoadMs ?? 1000);
    await detectBlockedStates(page, Boolean(config.auth));
    sections.push(await extractCurrentPage(page, config, `Page ${pageIndex}`));
  }

  const content = sections.map(section => section.content).filter(Boolean).join('\n\n---\n\n');
  return {
    content,
    contentHash: hashContent(content),
    extractionMethod: Array.from(new Set(sections.map(section => section.extractionMethod))).join('+') || 'html',
  };
}

async function detectBlockedStates(page: Awaited<ReturnType<BrowserContext['newPage']>>, hasAuthConfig: boolean) {
  const captchaSelectors = [
    'iframe[src*="captcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[src*="turnstile"]',
    '.g-recaptcha',
    '.h-captcha',
    '[data-sitekey]',
    '#challenge-running',
  ];

  for (const selector of captchaSelectors) {
    if (await page.locator(selector).count().catch(() => 0)) {
      throw new CrawlError('Target presented a CAPTCHA or bot challenge', 'captcha_or_bot_challenge', CrawlStatus.BLOCKED, 403);
    }
  }

  const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
  if (/checking your browser|verify you are human|captcha|access denied|temporarily blocked/i.test(bodyText)) {
    throw new CrawlError('Target presented a bot challenge or access block', 'captcha_or_bot_challenge', CrawlStatus.BLOCKED, 403);
  }

  const hasPasswordInput = await page.locator('input[type="password"]').count().catch(() => 0);
  if (hasPasswordInput > 0) {
    throw new CrawlError(
      hasAuthConfig ? 'Provided auth did not reach the protected content' : 'Target requires login credentials or a saved session',
      'auth_required',
      CrawlStatus.AUTH_REQUIRED,
      401
    );
  }
}

async function fetchRenderedHtml(targetUrl: string, config: InternalCrawlerConfig): Promise<ScrapeResult> {
  const browser = await getBrowser();
  const context = await createContext(browser, targetUrl, config);
  const page = await context.newPage();
  const unsafeRequestCache = new Map<string, boolean>();
  const capturedApiResponses: CapturedApiResponse[] = [];
  let blockedSubresourceCount = 0;

  page.on('response', async response => {
    if (!config.apiCapture?.enabled) return;
    if (capturedApiResponses.length >= (config.apiCapture.maxResponses ?? 10)) return;

    const responseUrl = response.url();
    const contentType = response.headers()['content-type'] || '';
    if (!shouldCaptureApiResponse(responseUrl, contentType, config)) return;

    try {
      await assertSafeScrapeUrl(responseUrl, 'API response URL');
      const text = await response.text();
      if (text.length > 250_000) return;
      capturedApiResponses.push({
        url: responseUrl,
        status: response.status(),
        contentType,
        body: JSON.parse(text),
      });
    } catch {
      // API capture is opportunistic; regular page extraction should still continue.
    }
  });

  await page.route('**/*', async route => {
    const requestUrl = route.request().url();
    const cached = unsafeRequestCache.get(requestUrl);

    if (cached === false) {
      blockedSubresourceCount += 1;
      await route.abort('blockedbyclient');
      return;
    }

    try {
      if (cached === undefined) {
        await assertSafeScrapeUrl(requestUrl, 'resource URL');
        unsafeRequestCache.set(requestUrl, true);
      }
      await route.continue();
    } catch {
      unsafeRequestCache.set(requestUrl, false);
      blockedSubresourceCount += 1;
      await route.abort('blockedbyclient');
    }
  });

  try {
    const response = await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });

    if (!response) {
      throw new CrawlError(`Target did not return a document response for ${targetUrl}`, 'no_document_response', CrawlStatus.FAILED);
    }

    const status = response.status();
    const finalUrl = response.url();
    const contentType = response.headers()['content-type'] || '';

    await assertSafeScrapeUrl(finalUrl, 'final URL');
    assertSuccessfulHttpStatus(status, finalUrl);

    if (!isLikelyHtml(contentType, finalUrl)) {
      const downloaded = await fetchBufferSafely(finalUrl, { headers: sanitizeHeaders(config.auth?.headers) });
      assertSuccessfulHttpStatus(downloaded.status, downloaded.finalUrl);
      const extracted = await extractFromBuffer(downloaded.buffer, downloaded.contentType || contentType, downloaded.finalUrl);

      return {
        ...extracted,
        finalUrl: downloaded.finalUrl,
        httpStatus: downloaded.status,
        contentType: downloaded.contentType || contentType,
        blockedSubresourceCount,
      };
    }

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);

    if (config.behavior?.acceptCookieBanners ?? true) {
      await acceptCommonCookieBanners(page);
    }

    if (config.behavior?.waitForSelector) {
      await page.waitForSelector(config.behavior.waitForSelector, { timeout: 15_000 });
    }

    for (const selector of config.behavior?.clickSelectors || []) {
      await page.locator(selector).first().click({ timeout: 5000 });
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
    }

    for (const text of config.behavior?.clickText || []) {
      await page.getByText(text, { exact: false }).first().click({ timeout: 5000 });
      await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => undefined);
    }

    await executeRecipeSteps(page, config.behavior?.steps);

    if (config.behavior?.scrollToBottom) {
      await scrollToBottom(page);
    }

    await page.waitForTimeout(config.behavior?.waitAfterLoadMs ?? 1500);
    await detectBlockedStates(page, Boolean(config.auth));

    const extracted = await collectPaginatedContent(page, config);

    if (!extracted.content) {
      throw new CrawlError('No extractable text content was found', 'empty_content', CrawlStatus.FAILED);
    }

    const apiContent = capturedApiToMarkdown(capturedApiResponses);
    let merged = mergeExtractedContent(extracted.content, apiContent, config.apiCapture?.mode);
    let extractionMethod = apiContent ? `${extracted.extractionMethod}+api` : extracted.extractionMethod;

    if (config.content?.screenshotDiff) {
      const screenshot = await page.screenshot({ fullPage: true }).catch(() => null);
      if (screenshot) {
        const visualFingerprint = `# Visual fingerprint\n\nScreenshot SHA-256: ${crypto.createHash('sha256').update(screenshot).digest('hex')}`;
        merged = mergeExtractedContent(merged.content, visualFingerprint, 'append');
        extractionMethod = `${extractionMethod}+screenshot`;
      }
    }

    return {
      ...merged,
      extractionMethod,
      finalUrl: page.url(),
      httpStatus: status,
      contentType,
      blockedSubresourceCount,
    };
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }
}

export const scrapeTarget = async (
  rawUrl: string,
  crawlerConfig?: ICrawlerConfig,
  crawlerAuthEncrypted?: string,
  scrapeContext: ScrapeContext = {}
): Promise<ScrapeResult> => {
  const targetUrl = await assertSafeScrapeUrl(rawUrl);
  const config = await hydrateCrawlerConfig(crawlerConfig, crawlerAuthEncrypted, scrapeContext);
  let hostDelayMs = env.CRAWLER_MIN_HOST_DELAY_MS;

  const shouldRespectRobots = config.compliance?.robotsPolicy === 'ignore'
    ? false
    : config.respectRobots ?? true;

  if (shouldRespectRobots) {
    const robots = await assertRobotsAllowed(targetUrl.href);
    hostDelayMs = Math.max(hostDelayMs, robots?.crawlDelayMs || 0);
  }

  await waitForHostSlot(targetUrl.origin, hostDelayMs);

  const head = await fetchBufferSafely(targetUrl.href, {
    method: 'HEAD',
    headers: sanitizeHeaders(config.auth?.headers),
  }).catch(() => null);

  if (head && head.status < 400 && !isLikelyHtml(head.contentType, head.finalUrl)) {
    const downloaded = await fetchBufferSafely(head.finalUrl, { headers: sanitizeHeaders(config.auth?.headers) });
    assertSuccessfulHttpStatus(downloaded.status, downloaded.finalUrl);
    const extracted = await extractFromBuffer(downloaded.buffer, downloaded.contentType || head.contentType, downloaded.finalUrl);

    if (!extracted.content) {
      throw new CrawlError('No extractable text content was found', 'empty_content', CrawlStatus.FAILED);
    }

    return {
      ...extracted,
      finalUrl: downloaded.finalUrl,
      httpStatus: downloaded.status,
      contentType: downloaded.contentType || head.contentType,
      blockedSubresourceCount: 0,
    };
  }

  return fetchRenderedHtml(targetUrl.href, config);
};

export const fetchPageHTML = async (url: string): Promise<string> => {
  const result = await fetchRenderedHtml(url, {});
  return result.content;
};

export const closeBrowser = async (): Promise<void> => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};
