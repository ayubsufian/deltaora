import mongoose, { Document, Schema } from 'mongoose';

export interface IPasskeyCredentialDocument extends Document {
  userId: mongoose.Types.ObjectId;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  deviceType?: string;
  backedUp: boolean;
  transports: string[];
  name?: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PasskeyCredentialSchema = new Schema<IPasskeyCredentialDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    credentialId: { type: String, required: true, unique: true },
    publicKey: { type: Buffer, required: true },
    counter: { type: Number, required: true, default: 0 },
    deviceType: { type: String },
    backedUp: { type: Boolean, default: false },
    transports: { type: [String], default: [] },
    name: { type: String },
    lastUsedAt: { type: Date },
  },
  { timestamps: true }
);

PasskeyCredentialSchema.index({ userId: 1, createdAt: -1 });

export const PasskeyCredential = mongoose.model<IPasskeyCredentialDocument>(
  'PasskeyCredential',
  PasskeyCredentialSchema
);
