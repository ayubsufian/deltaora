import mongoose, { Schema, Document } from 'mongoose';
import { IDiff } from '@deltaora/shared-types';

export interface IDiffDocument extends Omit<IDiff, '_id' | 'workspaceId'>, Document {
  workspaceId: mongoose.Types.ObjectId;
}

const DiffSchema = new Schema<IDiffDocument>(
  {
    pageId: { type: String, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    previousSnapshotId: { type: String, required: true },
    currentSnapshotId: { type: String, required: true },
    addedText: { type: String, required: true },
    removedText: { type: String, required: true },
    changeScore: { type: Number, required: true },
  },
  { timestamps: true }
);

DiffSchema.index({ workspaceId: 1, pageId: 1, createdAt: -1 });

export const Diff = mongoose.model<IDiffDocument>('Diff', DiffSchema);
