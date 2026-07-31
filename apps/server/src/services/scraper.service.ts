import { chromium, Browser, Page } from 'playwright';

let browserInstance: Browser | null = null;

export const getBrowser = async (): Promise<Browser> => {
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      headless: true,
    });
  }
  return browserInstance;
};

export const fetchPageHTML = async (url: string): Promise<string> => {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent: 'DeltaoraBot/1.0 (+https://deltaora.com/bot)',
  });
  
  const page = await context.newPage();
  
  try {
    // Wait until network is mostly idle
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    const html = await page.content();
    return html;
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    throw error;
  } finally {
    await page.close();
    await context.close();
  }
};
