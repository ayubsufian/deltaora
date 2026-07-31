import mongoose, { Schema, Document } from 'mongoose';
import { INotification, NotificationType } from '@deltaora/shared-types';

export interface INotificationDocument extends Omit<INotification, '_id'>, Document {}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    userId: { type: String, required: true, index: true },
    pageId: { type: String, required: true },
    summaryId: { type: String, required: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Notification = mongoose.model<INotificationDocument>('Notification', NotificationSchema);
