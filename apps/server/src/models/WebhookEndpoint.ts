import mongoose, { Document, Schema } from 'mongoose';

export interface IWebhookEndpointDocument extends Document {
  workspaceId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  name: string;
  url: string;
  events: string[];
  secretEncrypted?: string;
  isActive: boolean;
  lastDeliveryAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookEndpointSchema = new Schema<IWebhookEndpointDocument>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    url: { type: String, required: true },
    events: { type: [String], default: ['page.changed'] },
    secretEncrypted: { type: String, select: false },
    isActive: { type: Boolean, default: true },
    lastDeliveryAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true }
);

WebhookEndpointSchema.index({ workspaceId: 1, createdAt: -1 });

export const WebhookEndpoint = mongoose.model<IWebhookEndpointDocument>('WebhookEndpoint', WebhookEndpointSchema);
