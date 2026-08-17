import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import crypto from 'crypto';
import mammoth from 'mammoth';
import { parse as parseCsv } from 'csv-parse/sync';

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
export interface HtmlExtractionOptions {
  includeSelectors?: string[];
  excludeSelectors?: string[];
}

export interface ExtractedContent {
  content: string;
  contentHash: string;
  extractionMethod: string;
}

export class UnsupportedContentError extends Error {
  code = 'unsupported_content_type';
  statusCode = 415;

  constructor(message: string) {
    super(message);
    this.name = 'UnsupportedContentError';
  }
}

function applySelectors(document: Document, selectors: string[], action: (el: Element) => void): void {
  selectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(action);
    } catch {
      // Invalid user selectors are ignored here because validation only checks size.
    }
  });
}

function preProcessDOM(document: Document, options: HtmlExtractionOptions = {}): void {
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

  applySelectors(document, selectorsToRemove, el => el.remove());
  applySelectors(document, options.excludeSelectors || [], el => el.remove());

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
function extractReadableContent(document: Document, url: string, options: HtmlExtractionOptions = {}): string {
  if (options.includeSelectors?.length) {
    const selectedHtml: string[] = [];
    applySelectors(document, options.includeSelectors, el => selectedHtml.push(el.outerHTML));

    if (selectedHtml.length) {
      return selectedHtml.join('\n');
    }
  }

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

function hashContent(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function hashBuffer(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
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
export const extractCleanText = (html: string, url: string = '', options: HtmlExtractionOptions = {}): ExtractedContent => {
  // Parse with JSDOM
  const dom = new JSDOM(html, { url: url || undefined });
  const document = dom.window.document;

  // Stage 1: Pre-process — remove noise
  preProcessDOM(document, options);

  // Stage 2: Extract primary content with Readability
  const readableHTML = extractReadableContent(document, url, options);

  // Stage 3: Convert HTML to Markdown
  const turndown = createTurndownService();
  let markdown = turndown.turndown(readableHTML);

  // Stage 4: Post-process Markdown
  markdown = cleanMarkdown(markdown);

  // Stage 5: Hash for quick comparison
  const contentHash = hashContent(markdown);

  // Cleanup JSDOM
  dom.window.close();

  return { content: markdown, contentHash, extractionMethod: 'html' };
};

function bufferToText(buffer: Buffer): string {
  return buffer.toString('utf8').replace(/\u0000/g, '').trim();
}

function csvToMarkdown(buffer: Buffer): string {
  const rows = parseCsv(buffer.toString('utf8'), {
    bom: true,
    relaxColumnCount: true,
    skipEmptyLines: true,
  }) as string[][];

  if (!rows.length) return '';

  const maxRows = rows.slice(0, 1000);
  const columnCount = Math.max(...maxRows.map(row => row.length));
  const normalizedRows = maxRows.map(row => Array.from({ length: columnCount }, (_, index) => String(row[index] ?? '').replace(/\|/g, '\\|')));
  const [header, ...body] = normalizedRows;
  const separator = Array.from({ length: columnCount }, () => '---');

  return [header, separator, ...body]
    .map(row => `| ${row.join(' | ')} |`)
    .join('\n');
}

function normalizeStructuredText(content: string): ExtractedContent {
  const cleaned = cleanMarkdown(content);
  return {
    content: cleaned,
    contentHash: hashContent(cleaned),
    extractionMethod: 'document',
  };
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTextTags(xml: string): string[] {
  return Array.from(xml.matchAll(/<[^>]*(?:t|v)[^>]*>([\s\S]*?)<\/[^>]+>/g))
    .map(match => decodeXmlText(match[1].replace(/<[^>]+>/g, '').trim()))
    .filter(Boolean);
}

async function extractZipXmlText(buffer: Buffer, folderPrefix: string): Promise<string> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(buffer);
  const entries = Object.values(zip.files)
    .filter(file => !file.dir && file.name.startsWith(folderPrefix) && file.name.endsWith('.xml'))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const sections: string[] = [];
  for (const entry of entries) {
    const xml = await entry.async('string');
    const text = extractTextTags(xml).join(' ');
    if (text) {
      sections.push(`## ${entry.name}\n\n${text}`);
    }
  }

  return sections.join('\n\n');
}

function binaryFingerprint(buffer: Buffer, contentType: string, url: string, extractionMethod: string): ExtractedContent {
  const content = [
    `# Binary resource`,
    ``,
    `URL: ${url}`,
    `Content type: ${contentType || 'unknown'}`,
    `Bytes: ${buffer.byteLength}`,
    `SHA-256: ${hashBuffer(buffer)}`,
  ].join('\n');

  return {
    content,
    contentHash: hashContent(content),
    extractionMethod,
  };
}

export async function extractFromBuffer(buffer: Buffer, contentType: string, url: string): Promise<ExtractedContent> {
  const normalizedType = contentType.toLowerCase().split(';')[0].trim();
  const pathname = new URL(url).pathname.toLowerCase();

  if (normalizedType === 'application/pdf' || pathname.endsWith('.pdf')) {
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return { ...normalizeStructuredText(parsed.text), extractionMethod: 'pdf' };
    } finally {
      await parser.destroy();
    }
  }

  if (
    normalizedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    pathname.endsWith('.docx')
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return { ...normalizeStructuredText(parsed.value), extractionMethod: 'docx' };
  }

  if (
    normalizedType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    pathname.endsWith('.xlsx')
  ) {
    return { ...normalizeStructuredText(await extractZipXmlText(buffer, 'xl/')), extractionMethod: 'xlsx' };
  }

  if (
    normalizedType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    pathname.endsWith('.pptx')
  ) {
    return { ...normalizeStructuredText(await extractZipXmlText(buffer, 'ppt/slides/')), extractionMethod: 'pptx' };
  }

  if (normalizedType === 'text/csv' || pathname.endsWith('.csv')) {
    return { ...normalizeStructuredText(csvToMarkdown(buffer)), extractionMethod: 'csv' };
  }

  if (normalizedType === 'application/json' || pathname.endsWith('.json')) {
    const text = bufferToText(buffer);
    try {
      return { ...normalizeStructuredText(JSON.stringify(JSON.parse(text), null, 2)), extractionMethod: 'json' };
    } catch {
      return { ...normalizeStructuredText(text), extractionMethod: 'json' };
    }
  }

  if (
    normalizedType.startsWith('text/') ||
    normalizedType.includes('xml') ||
    pathname.endsWith('.txt') ||
    pathname.endsWith('.xml') ||
    pathname.endsWith('.md')
  ) {
    return { ...normalizeStructuredText(bufferToText(buffer)), extractionMethod: 'text' };
  }

  if (normalizedType.startsWith('image/')) {
    return binaryFingerprint(buffer, contentType, url, 'image');
  }

  if (normalizedType.startsWith('audio/')) {
    return binaryFingerprint(buffer, contentType, url, 'audio');
  }

  if (normalizedType.startsWith('video/')) {
    return binaryFingerprint(buffer, contentType, url, 'video');
  }

  throw new UnsupportedContentError(`Unsupported content type: ${contentType || 'unknown'}`);
}
