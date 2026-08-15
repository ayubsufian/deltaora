import mongoose, { Schema, Document } from 'mongoose';
import { IJob, JobStatus } from '@deltaora/shared-types';

export interface IJobDocument extends Omit<IJob, '_id'>, Document {}

const JobSchema = new Schema<IJobDocument>(
  {
    pageId: { type: String, required: true, index: true },
    status: { type: String, enum: Object.values(JobStatus), default: JobStatus.PENDING },
    error: { type: String },
    startedAt: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const Job = mongoose.model<IJobDocument>('Job', JobSchema);
