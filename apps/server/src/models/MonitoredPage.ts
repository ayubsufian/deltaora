import mongoose, { Schema, Document } from 'mongoose';
import { IMonitoredPage, PageStatus, CrawlStatus, Category, Importance } from '@deltaora/shared-types';

export interface IMonitoredPageDocument extends Omit<IMonitoredPage, '_id' | 'workspaceId'>, Document {
  workspaceId: mongoose.Types.ObjectId;
  crawlerAuthEncrypted?: string;
}

const MonitoredPageSchema = new Schema<IMonitoredPageDocument>(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    category: { type: String, enum: Object.values(Category), default: Category.GENERAL },
    importance: { type: String, enum: Object.values(Importance), default: Importance.MEDIUM },
    checkInterval: { type: Number, required: true, default: 60 },
    status: { type: String, enum: Object.values(PageStatus), default: PageStatus.ACTIVE },
    lastChecked: { type: Date },
    lastCrawlStatus: { type: String, enum: Object.values(CrawlStatus) },
    lastCrawlError: { type: String },
    lastCrawlCode: { type: String },
    lastHttpStatus: { type: Number },
    lastContentType: { type: String },
    lastResolvedUrl: { type: String },
    lastCrawlRecommendation: { type: String },
    crawlerConfig: { type: Schema.Types.Mixed },
    crawlerAuthEncrypted: { type: String, select: false },
  },
  { timestamps: true }
);

// Compound index for workspace-scoped queries (the 2026 standard query pattern)
MonitoredPageSchema.index({ workspaceId: 1, status: 1 });

export const MonitoredPage = mongoose.model<IMonitoredPageDocument>('MonitoredPage', MonitoredPageSchema);
