export const PageStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
} as const;
export type PageStatus = typeof PageStatus[keyof typeof PageStatus];

export const CrawlStatus = {
  SUCCESS: 'success',
  FAILED: 'failed',
  BLOCKED: 'blocked',
  UNSUPPORTED: 'unsupported',
  AUTH_REQUIRED: 'auth_required',
  MANUAL_REVIEW: 'manual_review',
} as const;
export type CrawlStatus = typeof CrawlStatus[keyof typeof CrawlStatus];

export const Importance = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
} as const;
export type Importance = typeof Importance[keyof typeof Importance];

export const Category = {
  GENERAL: 'general',
  PRICING: 'pricing',
  POLICY: 'policy',
  PRODUCT: 'product',
  CAREERS: 'careers',
} as const;
export type Category = typeof Category[keyof typeof Category];

export const JobStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;
export type JobStatus = typeof JobStatus[keyof typeof JobStatus];

export const NotificationType = {
  IN_APP: 'in_app',
  EMAIL: 'email',
} as const;
export type NotificationType = typeof NotificationType[keyof typeof NotificationType];

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash?: string; // Optional for OAuth users
  role: string;
  isEmailVerified: boolean;
  googleId?: string;
  createdAt: Date;
}

export interface IMonitoredPage {
  _id: string;
  userId: string;
  title: string;
  url: string;
  category: Category;
  importance: Importance;
  checkInterval: number; // in minutes
  status: PageStatus;
  lastChecked?: Date;
  lastCrawlStatus?: CrawlStatus;
  lastCrawlError?: string;
  lastCrawlCode?: string;
  lastHttpStatus?: number;
  lastContentType?: string;
  lastResolvedUrl?: string;
  lastCrawlRecommendation?: string;
  crawlerConfig?: ICrawlerConfig;
  createdAt: Date;
}

export interface ICrawlerCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

export interface ICrawlerAuthConfig {
  headers?: Record<string, string>;
  cookies?: ICrawlerCookie[];
  storageState?: Record<string, unknown>;
}

export type ICrawlerRecipeStep =
  | { action: 'waitForSelector'; selector: string; timeoutMs?: number }
  | { action: 'click'; selector: string; timeoutMs?: number }
  | { action: 'clickText'; text: string; timeoutMs?: number }
  | { action: 'fill'; selector: string; value: string; timeoutMs?: number }
  | { action: 'selectOption'; selector: string; value: string; timeoutMs?: number }
  | { action: 'check'; selector: string; timeoutMs?: number }
  | { action: 'uncheck'; selector: string; timeoutMs?: number }
  | { action: 'press'; selector: string; key: string; timeoutMs?: number }
  | { action: 'hover'; selector: string; timeoutMs?: number }
  | { action: 'waitForURL'; pattern: string; timeoutMs?: number }
  | { action: 'waitMs'; value: number }
  | { action: 'scrollToBottom' };

export interface ICrawlerConfig {
  authSessionId?: string;
  respectRobots?: boolean;
  discovery?: {
    enabled?: boolean;
    maxDepth?: number;
    maxPages?: number;
    includeSubdomains?: boolean;
    includeSitemaps?: boolean;
    includeFeeds?: boolean;
    followCanonical?: boolean;
  };
  extraction?: {
    includeSelectors?: string[];
    excludeSelectors?: string[];
  };
  behavior?: {
    waitForSelector?: string;
    clickSelectors?: string[];
    clickText?: string[];
    steps?: ICrawlerRecipeStep[];
    scrollToBottom?: boolean;
    acceptCookieBanners?: boolean;
    waitAfterLoadMs?: number;
    locale?: string;
    timezoneId?: string;
  };
  pagination?: {
    nextSelector?: string;
    nextText?: string;
    maxPages?: number;
    waitForSelector?: string;
  };
  apiCapture?: {
    enabled?: boolean;
    mode?: 'append' | 'prefer';
    maxResponses?: number;
    includeUrlPatterns?: string[];
    excludeUrlPatterns?: string[];
  };
  content?: {
    screenshotDiff?: boolean;
    binaryFingerprint?: boolean;
  };
  compliance?: {
    robotsPolicy?: 'respect' | 'ignore';
    blockedHandling?: 'fail' | 'manual_review';
  };
}

export interface ISnapshot {
  _id: string;
  pageId: string;
  workspaceId: string;
  content: string;
  contentHash: string;
  createdAt: Date;
}

export interface IDiff {
  _id: string;
  pageId: string;
  workspaceId: string;
  previousSnapshotId: string;
  currentSnapshotId: string;
  addedText: string;
  removedText: string;
  changeScore: number;
  createdAt: Date;
}

export interface IAISummary {
  _id: string;
  diffId: string;
  workspaceId: string;
  summary: string;
  importance: Importance;
  category: Category;
  createdAt: Date;
}

export interface INotification {
  _id: string;
  userId: string;
  pageId: string;
  summaryId: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date;
}

export interface IJob {
  _id: string;
  pageId: string;
  status: JobStatus;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}
