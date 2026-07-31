import mongoose, { Schema, Document } from 'mongoose';
import { IDiff } from '@deltaora/shared-types';

export interface IDiffDocument extends Omit<IDiff, '_id'>, Document {}

const DiffSchema = new Schema<IDiffDocument>(
  {
    pageId: { type: String, required: true, index: true },
    previousSnapshotId: { type: String, required: true },
    currentSnapshotId: { type: String, required: true },
    addedText: { type: String, required: true },
    removedText: { type: String, required: true },
    changeScore: { type: Number, required: true },
  },
  { timestamps: true }
);

export const Diff = mongoose.model<IDiffDocument>('Diff', DiffSchema);
