export const PageStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
} as const;
export type PageStatus = typeof PageStatus[keyof typeof PageStatus];

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
  createdAt: Date;
}

export interface ISnapshot {
  _id: string;
  pageId: string;
  content: string;
  contentHash: string;
  createdAt: Date;
}

export interface IDiff {
  _id: string;
  pageId: string;
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
  startedAt?: Date;
  completedAt?: Date;
}
