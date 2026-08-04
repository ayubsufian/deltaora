import mongoose, { Schema, Document } from 'mongoose';
import { IMonitoredPage, PageStatus, Category, Importance } from '@deltaora/shared-types';

export interface IMonitoredPageDocument extends Omit<IMonitoredPage, '_id'>, Document {}

const MonitoredPageSchema = new Schema<IMonitoredPageDocument>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    url: { type: String, required: true },
    category: { type: String, enum: Object.values(Category), default: Category.GENERAL },
    importance: { type: String, enum: Object.values(Importance), default: Importance.MEDIUM },
    checkInterval: { type: Number, required: true, default: 60 },
    status: { type: String, enum: Object.values(PageStatus), default: PageStatus.ACTIVE },
    lastChecked: { type: Date },
  },
  { timestamps: true }
);

export const MonitoredPage = mongoose.model<IMonitoredPageDocument>('MonitoredPage', MonitoredPageSchema);
