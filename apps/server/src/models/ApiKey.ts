import mongoose, { Document, Schema } from 'mongoose';

export interface IApiKeyDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: Date;
  expiresAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKeyDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    keyHash: { type: String, required: true, unique: true, select: false },
    keyPrefix: { type: String, required: true },
    scopes: { type: [String], default: ['pages:read'] },
    lastUsedAt: { type: Date },
    expiresAt: { type: Date },
    revokedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

ApiKeySchema.index({ workspaceId: 1, createdAt: -1 });

export const ApiKey = mongoose.model<IApiKeyDocument>('ApiKey', ApiKeySchema);
