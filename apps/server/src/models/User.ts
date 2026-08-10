import mongoose, { Schema, Document } from 'mongoose';
import { IUser } from '@deltaora/shared-types';
import * as argon2 from 'argon2';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
  mfaEnabled: boolean;
  mfaSecret?: string;
  emailPreferences: {
    marketing: boolean;
    notifications: boolean;
  };
}

const UserSchema = new Schema<IUserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, default: 'user' },
    mfaEnabled: { type: Boolean, default: false },
    mfaSecret: { type: String },
    emailPreferences: {
      marketing: { type: Boolean, default: false },
      notifications: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    this.passwordHash = await argon2.hash(this.passwordHash);
    next();
  } catch (error) {
    next(error as Error);
  }
});

export const User = mongoose.model<IUserDocument>('User', UserSchema);

