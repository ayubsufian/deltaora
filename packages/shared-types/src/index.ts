export enum PageStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
}

export enum Importance {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum Category {
  GENERAL = 'general',
  PRICING = 'pricing',
  POLICY = 'policy',
  PRODUCT = 'product',
  CAREERS = 'careers',
}

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum NotificationType {
  IN_APP = 'in_app',
  EMAIL = 'email',
}

export interface IUser {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: string;
  createdAt: Date;
}

export interface IMonitoredPage {
  _id: string;
  userId: string;
  title: string;
  url: string;
  category: Category;
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
