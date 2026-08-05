import { chromium, Browser, BrowserContext } from 'playwright';
import { env } from '../config/env';

// ── 2026 Standard: Stealth Browser Singleton ──
// We maintain a single browser instance and rotate contexts per request
// to minimize resource usage while ensuring clean sessions.

let browserInstance: Browser | null = null;

// Realistic User-Agent rotation pool — 2026 standard practice
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.5; rv:128.0) Gecko/20100101 Firefox/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Get or create a shared Chromium browser instance.
 * Uses stealth launch args to evade basic headless detection.
 */
export const getBrowser = async (): Promise<Browser> => {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',  // Hide automation flag
        '--disable-infobars',
        '--window-size=1920,1080',
        '--start-maximized',
      ],
    });
  }
  return browserInstance;
};

/**
 * Create a stealth browser context with randomized fingerprint.
 * 
 * 2026 Standard: Each scrape uses a fresh context with:
 * - Rotated User-Agent
 * - Realistic viewport and locale settings
 * - Optional proxy support via PROXY_URL env var
 */
async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const proxyUrl = env.PROXY_URL;

  const contextOptions: any = {
    userAgent: getRandomUserAgent(),
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezoneId: 'America/New_York',
    // Mask WebDriver property — key stealth technique
    javaScriptEnabled: true,
    ignoreHTTPSErrors: true,
    // Accept common headers like a real browser
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Sec-Ch-Ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="8"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  };

  // Optional rotating proxy support (BrightData, Oxylabs, ScraperAPI, etc.)
  if (proxyUrl) {
    const proxyUrlObj = new URL(proxyUrl);
    contextOptions.proxy = {
      server: `${proxyUrlObj.protocol}//${proxyUrlObj.hostname}:${proxyUrlObj.port}`,
      username: proxyUrlObj.username || undefined,
      password: proxyUrlObj.password || undefined,
    };
  }

  const context = await browser.newContext(contextOptions);

  // Inject anti-detection scripts before any page loads
  await context.addInitScript(() => {
    // Override navigator.webdriver (the #1 detection vector)
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
    });

    // Override chrome.runtime to look like a real Chrome install
    (window as any).chrome = {
      runtime: {},
      loadTimes: function () { return {}; },
      csi: function () { return {}; },
    };

    // Override Permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(parameters);

    // Override plugins and languages to look realistic
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
  });

  return context;
}

/**
 * Fetch the fully rendered HTML of a URL using a stealth browser.
 *
 * 2026 Standard:
 * - Uses smart wait strategy: waits for DOM content + network settle
 * - Implements exponential backoff retry (3 attempts)
 * - Randomized delays between actions to appear human
 * - Fresh context per request to avoid session contamination
 */
export const fetchPageHTML = async (url: string, retries = 3): Promise<string> => {
  const browser = await getBrowser();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    const context = await createStealthContext(browser);
    const page = await context.newPage();

    try {
      // Random pre-navigation delay (50-300ms) to look human
      await page.waitForTimeout(50 + Math.random() * 250);

      // Navigate with a robust wait strategy:
      // 1. Wait for DOM content loaded first (fast)
      // 2. Then wait for network to settle (dynamic content)
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      });

      // Smart network settle: wait until no more than 2 connections for 500ms
      // This is more reliable than 'networkidle' which can hang on long-polling sites
      await page.waitForLoadState('networkidle').catch(() => {
        // If networkidle times out (e.g. on sites with websockets), proceed anyway
      });

      // Additional wait for JS-rendered content
      await page.waitForTimeout(1000 + Math.random() * 500);

      const html = await page.content();
      return html;

    } catch (error) {
      lastError = error as Error;
      console.warn(`Scrape attempt ${attempt}/${retries} failed for ${url}: ${lastError.message}`);

      // Exponential backoff: 2s, 4s, 8s
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    } finally {
      await page.close();
      await context.close();
    }
  }

  throw new Error(`Failed to fetch ${url} after ${retries} attempts: ${lastError?.message}`);
};

/**
 * Gracefully shut down the browser instance.
 * Called during server shutdown for clean resource cleanup.
 */
export const closeBrowser = async (): Promise<void> => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};
