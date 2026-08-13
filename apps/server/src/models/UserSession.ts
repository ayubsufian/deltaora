import mongoose, { Document, Schema } from 'mongoose';

export interface IUserSessionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  refreshTokenHash: string;
  userAgent?: string;
  ipAddress?: string;
  lastSeenAt: Date;
  reauthenticatedAt?: Date;
  mfaVerifiedAt?: Date;
  expiresAt: Date;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSessionSchema = new Schema<IUserSessionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    refreshTokenHash: { type: String, required: true },
    userAgent: { type: String },
    ipAddress: { type: String },
    lastSeenAt: { type: Date, default: Date.now },
    reauthenticatedAt: { type: Date },
    mfaVerifiedAt: { type: Date },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date },
    revokedReason: { type: String },
  },
  { timestamps: true }
);

UserSessionSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });
UserSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const UserSession = mongoose.model<IUserSessionDocument>('UserSession', UserSessionSchema);
