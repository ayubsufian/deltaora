import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import crypto from 'crypto';

// ── 2026 Standard: Semantic Markdown Extraction Pipeline ──
//
// Architecture:
// Raw HTML → JSDOM → Readability (primary content extraction) → Turndown (HTML→Markdown) → Clean Markdown
//
// Why Markdown over raw text?
// 1. Preserves structure (headers, lists, tables, links) that users care about
// 2. Makes diffs far more meaningful — you can see "## Pricing" section changes
// 3. AI summary generation is dramatically better with structured Markdown input
// 4. Industry standard for LLM-based content processing in 2026

// Configure Turndown for clean, readable Markdown output
function createTurndownService(): TurndownService {
  const turndown = new TurndownService({
    headingStyle: 'atx',           // # style headers
    hr: '---',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    strongDelimiter: '**',
  });

  // Remove elements that should never appear in content snapshots
  turndown.remove([
    'script', 'style', 'noscript', 'iframe', 'svg',
    'video', 'audio', 'canvas', 'map', 'object', 'embed',
  ] as any);

  // Custom rule: Convert tables to Markdown tables
  turndown.addRule('tableRow', {
    filter: 'tr',
    replacement: function (content: string, node: any) {
      const cells = content.trim().split('\n').filter(Boolean);
      const row = '| ' + cells.join(' | ') + ' |';
      
      // Add header separator after the first row if it's inside thead
      const parent = node.parentNode;
      if (parent && parent.nodeName === 'THEAD') {
        const cellCount = cells.length;
        const separator = '| ' + Array(cellCount).fill('---').join(' | ') + ' |';
        return row + '\n' + separator + '\n';
      }
      return row + '\n';
    },
  });

  return turndown;
}

/**
 * Stage 1: Pre-process the DOM to remove noise elements.
 * 
 * This runs BEFORE Readability to give it the cleanest possible input.
 * Targets common anti-patterns that Readability alone may not catch.
 */
function preProcessDOM(document: Document): void {
  const selectorsToRemove = [
    // Navigation & structural chrome
    'nav', 'header', 'footer', 'aside',
    '[role="banner"]', '[role="navigation"]', '[role="contentinfo"]', '[role="complementary"]',
    
    // Cookie banners & consent modals
    '.cookie-banner', '.cookie-consent', '#cookie-consent', '#cookie-banner',
    '.cc-banner', '.cc-window', '#onetrust-banner-sdk', '.gdpr',
    '[class*="cookie"]', '[id*="cookie"]', '[class*="consent"]', '[id*="consent"]',
    
    // Ads & tracking
    '.ads', '.ad-container', '.advertisement', '.ad-slot',
    '[class*="ad-"]', '[class*="advert"]', '[id*="google_ads"]',
    '.sponsored', '.promotion',
    
    // Social widgets & share buttons
    '.social-share', '.share-buttons', '.social-links',
    '[class*="social"]', '[class*="share-"]',
    
    // Newsletter & CTA popups
    '.newsletter', '.popup', '.modal-overlay',
    '[class*="newsletter"]', '[class*="subscribe"]',
    
    // Site chrome
    '.breadcrumb', '.breadcrumbs', '.pagination',
    '.sidebar', '#sidebar', '.related-posts',
    '.comments', '#comments', '.comment-section',
  ];

  selectorsToRemove.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => el.remove());
    } catch {
      // Skip invalid selectors silently
    }
  });

  // Remove all hidden elements
  document.querySelectorAll('[style*="display:none"], [style*="display: none"], [hidden], .hidden, .visually-hidden, .sr-only').forEach(el => el.remove());

  // Remove all script/style/noscript tags (belt and suspenders)
  document.querySelectorAll('script, style, noscript, link[rel="stylesheet"]').forEach(el => el.remove());
}

/**
 * Stage 2: Extract the primary readable content using Mozilla's Readability.
 * 
 * Readability uses a sophisticated algorithm (originally from Firefox Reader View)
 * to identify the "main content" of a page, automatically ignoring:
 * - Navigation menus
 * - Sidebars
 * - Footer boilerplate
 * - Ad containers
 * - Any non-article content
 * 
 * Returns the extracted HTML content, or falls back to <body> if Readability
 * fails (e.g., on non-article pages like dashboards).
 */
function extractReadableContent(document: Document, url: string): string {
  const reader = new Readability(document, {
    charThreshold: 100,     // Minimum chars to consider a node as content
    nbTopCandidates: 5,     // Number of top candidates to evaluate
  });

  const article = reader.parse();

  if (article && article.content) {
    return article.content;
  }

  // Fallback: If Readability can't identify an article (e.g., SPA dashboards),
  // fall back to the <main> or <body> content after our pre-processing
  const main = document.querySelector('main') || document.querySelector('[role="main"]');
  return main ? main.innerHTML : document.body?.innerHTML || '';
}

/**
 * Stage 3: Post-process the Markdown to normalize whitespace and remove artifacts.
 */
function cleanMarkdown(markdown: string): string {
  return markdown
    // Collapse 3+ blank lines into 2
    .replace(/\n{3,}/g, '\n\n')
    // Remove lines that are only whitespace
    .replace(/^\s+$/gm, '')
    // Remove trailing whitespace from each line
    .replace(/[ \t]+$/gm, '')
    // Trim the document
    .trim();
}

/**
 * Extract clean, structured Markdown content from raw HTML.
 * 
 * This is the main entry point for the extraction pipeline.
 * 
 * Pipeline:
 * 1. Parse HTML into a DOM using JSDOM
 * 2. Pre-process: Remove noise elements (ads, nav, cookies, tracking)
 * 3. Extract: Use Readability to find the primary content
 * 4. Convert: Transform extracted HTML into clean Markdown via Turndown
 * 5. Post-process: Normalize whitespace and clean artifacts
 * 6. Hash: Create SHA-256 hash for quick change detection
 * 
 * @returns Structured Markdown content and its hash for comparison
 */
export const extractCleanText = (html: string, url: string = ''): { content: string; contentHash: string } => {
  // Parse with JSDOM
  const dom = new JSDOM(html, { url: url || undefined });
  const document = dom.window.document;

  // Stage 1: Pre-process — remove noise
  preProcessDOM(document);

  // Stage 2: Extract primary content with Readability
  const readableHTML = extractReadableContent(document, url);

  // Stage 3: Convert HTML to Markdown
  const turndown = createTurndownService();
  let markdown = turndown.turndown(readableHTML);

  // Stage 4: Post-process Markdown
  markdown = cleanMarkdown(markdown);

  // Stage 5: Hash for quick comparison
  const contentHash = crypto.createHash('sha256').update(markdown).digest('hex');

  // Cleanup JSDOM
  dom.window.close();

  return { content: markdown, contentHash };
};
