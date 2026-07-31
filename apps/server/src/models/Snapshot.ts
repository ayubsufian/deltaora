import mongoose, { Schema, Document } from 'mongoose';
import { ISnapshot } from '@deltaora/shared-types';

export interface ISnapshotDocument extends Omit<ISnapshot, '_id'>, Document {}

const SnapshotSchema = new Schema<ISnapshotDocument>(
  {
    pageId: { type: String, required: true, index: true },
    content: { type: String, required: true },
    contentHash: { type: String, required: true },
  },
  { timestamps: true }
);

export const Snapshot = mongoose.model<ISnapshotDocument>('Snapshot', SnapshotSchema);
