import { Request, Response, NextFunction } from 'express';
import { defineAbilityFor, AppAbility } from '../config/abilities';
import { Workspace, WorkspaceRole } from '../models/Workspace';
import { ForbiddenError } from '@casl/ability';

// Extend Express Request to carry CASL ability
declare global {
  namespace Express {
    interface Request {
      ability?: AppAbility;
      workspaceId?: string;
      workspaceRole?: WorkspaceRole;
    }
  }
}

/**
 * Middleware that resolves the user's workspace context and builds their CASL ability.
 *
 * The workspace is resolved from:
 * 1. `x-workspace-id` header (standard for B2B SaaS APIs in 2026)
 * 2. Falls back to the user's first workspace if no header is provided
 */
export const resolveAbility = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role || 'user';

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let workspaceId: string | undefined;
    let workspaceRole: WorkspaceRole | undefined;

    // Try to resolve workspace from header
    const headerWorkspaceId = req.headers['x-workspace-id'] as string;

    if (headerWorkspaceId) {
      const workspace = await Workspace.findById(headerWorkspaceId);
      if (workspace) {
        const member = workspace.members.find(m => m.userId.toString() === userId);
        if (member) {
          workspaceId = workspace.id;
          workspaceRole = member.role;
        }
      }
    } else {
      // Fallback: Find the user's first (default) workspace
      const workspace = await Workspace.findOne({ 'members.userId': userId });
      if (workspace) {
        const member = workspace.members.find(m => m.userId.toString() === userId);
        if (member) {
          workspaceId = workspace.id;
          workspaceRole = member.role;
        }
      }
    }

    // Build CASL ability
    const ability = defineAbilityFor({
      userId,
      role: userRole,
      workspaceId,
      workspaceRole,
    });

    req.ability = ability;
    req.workspaceId = workspaceId;
    req.workspaceRole = workspaceRole;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware factory that checks if the user has the required CASL permission.
 *
 * Usage: `authorize('create', 'MonitoredPage')`
 */
export const authorize = (action: string, subjectType: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.ability) {
      return res.status(403).json({ error: 'Forbidden: No ability context resolved' });
    }

    try {
      ForbiddenError.from(req.ability).throwUnlessCan(action as any, subjectType as any);
      next();
    } catch (error) {
      if (error instanceof ForbiddenError) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You do not have permission to ${action} ${subjectType}`,
        });
      }
      next(error);
    }
  };
};
