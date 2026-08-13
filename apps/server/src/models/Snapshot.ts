import mongoose, { Schema, Document } from 'mongoose';
import { ISnapshot } from '@deltaora/shared-types';

export interface ISnapshotDocument extends Omit<ISnapshot, '_id' | 'workspaceId'>, Document {
  workspaceId: mongoose.Types.ObjectId;
}

const SnapshotSchema = new Schema<ISnapshotDocument>(
  {
    pageId: { type: String, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    content: { type: String, required: true },
    contentHash: { type: String, required: true },
  },
  { timestamps: true }
);

SnapshotSchema.index({ workspaceId: 1, pageId: 1, createdAt: -1 });

export const Snapshot = mongoose.model<ISnapshotDocument>('Snapshot', SnapshotSchema);
