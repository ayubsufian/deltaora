import mongoose, { Schema, Document } from 'mongoose';
import { IAISummary, Importance, Category } from '@deltaora/shared-types';

export interface IAISummaryDocument extends Omit<IAISummary, '_id'>, Document {}

const AISummarySchema = new Schema<IAISummaryDocument>(
  {
    diffId: { type: String, required: true, index: true },
    summary: { type: String, required: true },
    importance: { type: String, enum: Object.values(Importance), required: true },
    category: { type: String, enum: Object.values(Category), required: true },
  },
  { timestamps: true }
);

export const AISummary = mongoose.model<IAISummaryDocument>('AISummary', AISummarySchema);
