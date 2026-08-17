import mongoose, { Schema, Document } from 'mongoose';

export interface ICrawlerAuthSessionDocument extends Document {
  userId: string;
  workspaceId: mongoose.Types.ObjectId;
  name: string;
  origin: string;
  storageStateEncrypted: string;
  lastUsedAt?: Date;
}

const CrawlerAuthSessionSchema = new Schema<ICrawlerAuthSessionDocument>(
  {
    userId: { type: String, required: true, index: true },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    name: { type: String, required: true },
    origin: { type: String, required: true },
    storageStateEncrypted: { type: String, required: true, select: false },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

CrawlerAuthSessionSchema.index({ workspaceId: 1, origin: 1 });

export const CrawlerAuthSession = mongoose.model<ICrawlerAuthSessionDocument>('CrawlerAuthSession', CrawlerAuthSessionSchema);
