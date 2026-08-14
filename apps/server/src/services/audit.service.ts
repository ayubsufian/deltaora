import { AuditLog } from '../models/AuditLog';
import { Request } from 'express';

interface LogEventOptions {
  workspaceId?: string;
  actorId?: string;
  action: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  req?: Request;
}

/**
 * Service to easily log SOC2-compliant audit events for workspaces.
 */
export const logAuditEvent = async ({
  workspaceId,
  actorId,
  action,
  resourceId,
  metadata,
  req,
}: LogEventOptions) => {
  try {
    const ipAddress = req?.ip || req?.headers['x-forwarded-for'] || 'unknown';
    const userAgent = req?.headers['user-agent'];

    const log = new AuditLog({
      workspaceId,
      actorId,
      action,
      resourceId,
      metadata: {
        ...metadata,
        ...(userAgent ? { userAgent } : {}),
      },
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
    });

    // Fire and forget, don't await to avoid blocking the main thread
    log.save().catch(err => console.error('Failed to save audit log:', err));
  } catch (error) {
    console.error('Error in logAuditEvent:', error);
  }
};

export const logAuthEvent = async (
  action: string,
  options: Omit<LogEventOptions, 'action'> = {}
) => logAuditEvent({ ...options, action });
