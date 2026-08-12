import mongoose, { Document, Schema } from 'mongoose';
import { WorkspaceRole } from './Workspace';

export interface IWorkspaceInviteDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  inviterId: mongoose.Types.ObjectId;
  inviteeEmail?: string;
  role: Exclude<WorkspaceRole, 'owner'>;
  tokenHash: string;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const WorkspaceInviteSchema = new Schema<IWorkspaceInviteDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    inviterId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    inviteeEmail: { type: String, lowercase: true, trim: true },
    role: { type: String, enum: ['editor', 'viewer'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

WorkspaceInviteSchema.index({ workspaceId: 1, acceptedAt: 1, revokedAt: 1 });
WorkspaceInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const WorkspaceInvite = mongoose.model<IWorkspaceInviteDocument>('WorkspaceInvite', WorkspaceInviteSchema);
