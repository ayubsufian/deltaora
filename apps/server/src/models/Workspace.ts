import mongoose, { Schema, Document } from 'mongoose';

export type WorkspaceRole = 'owner' | 'editor' | 'viewer';

export interface IWorkspaceMember {
  userId: mongoose.Types.ObjectId;
  role: WorkspaceRole;
  joinedAt: Date;
}

export interface IWorkspaceDocument extends Document {
  name: string;
  ownerId: mongoose.Types.ObjectId;
  members: IWorkspaceMember[];
  plan: 'free' | 'pro' | 'enterprise';
  maxPages: number;
  crawlerDefaults: {
    respectRobots: boolean;
    blockedHandling: 'fail' | 'manual_review';
    apiCapture: boolean;
    screenshotDiff: boolean;
    includeFeeds: boolean;
  };
  notificationDefaults: {
    minimumImportance: 'low' | 'medium' | 'high' | 'critical';
  };
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'editor', 'viewer'], required: true },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const WorkspaceSchema = new Schema<IWorkspaceDocument>(
  {
    name: { type: String, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    members: { type: [WorkspaceMemberSchema], default: [] },
    plan: { type: String, enum: ['free', 'pro', 'enterprise'], default: 'free' },
    maxPages: { type: Number, default: 10 },
    crawlerDefaults: {
      respectRobots: { type: Boolean, default: true },
      blockedHandling: { type: String, enum: ['fail', 'manual_review'], default: 'manual_review' },
      apiCapture: { type: Boolean, default: false },
      screenshotDiff: { type: Boolean, default: false },
      includeFeeds: { type: Boolean, default: true },
    },
    notificationDefaults: {
      minimumImportance: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    },
  },
  { timestamps: true }
);

// Compound index: fast lookup for "which workspaces does this user belong to?"
WorkspaceSchema.index({ 'members.userId': 1 });

export const Workspace = mongoose.model<IWorkspaceDocument>('Workspace', WorkspaceSchema);
