import * as cheerio from 'cheerio';
import crypto from 'crypto';

export const extractCleanText = (html: string): { content: string; contentHash: string } => {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  const elementsToRemove = [
    'nav', 'header', 'footer', 'script', 'style', 'noscript', 'iframe',
    'svg', 'form', 'button', '.cookie-banner', '#cookie-consent',
    '.ads', '.advertisement', '[role="banner"]', '[role="navigation"]',
    '[role="contentinfo"]'
  ];

  elementsToRemove.forEach(selector => {
    $(selector).remove();
  });

  // Extract text and normalize whitespace
  let text = $('body').text();
  text = text.replace(/\s+/g, ' ').trim();

  // Create hash for quick comparison
  const contentHash = crypto.createHash('sha256').update(text).digest('hex');

  return { content: text, contentHash };
};
