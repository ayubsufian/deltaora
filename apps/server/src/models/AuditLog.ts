import mongoose, { Document, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  workspaceId?: mongoose.Types.ObjectId;
  actorId?: mongoose.Types.ObjectId; // The user who performed the action, when known
  action: string; // e.g., 'member.invited', 'role.changed', 'page.created'
  resourceId?: string; // ID of the page, user, or resource affected
  metadata?: Record<string, any>; // Extra details (e.g., previous role, new role)
  ipAddress?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', index: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    action: { type: String, required: true },
    resourceId: { type: String },
    metadata: { type: Schema.Types.Mixed },
    ipAddress: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
