import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';
import { WorkspaceRole } from '../models/Workspace';

// Define action and subject types
type Actions = 'create' | 'read' | 'update' | 'delete' | 'manage';
type Subjects = 'MonitoredPage' | 'Snapshot' | 'Diff' | 'AISummary' | 'Workspace' | 'User' | 'all';

export type AppAbility = MongoAbility<[Actions, Subjects]>;

interface AbilityUser {
  userId: string;
  role: string; // System-level role: 'user' | 'admin'
  workspaceRole?: WorkspaceRole; // Workspace-level role
  workspaceId?: string;
}

/**
 * Define CASL abilities for a user.
 *
 * 2026 SOC2-Compliant Rules:
 * - System Admins can manage Users (support/suspension) but CANNOT access customer data.
 * - Workspace Owners can manage everything within their workspace.
 * - Workspace Editors can create, read, update, and delete MonitoredPages within their workspace.
 * - Workspace Viewers can only read data within their workspace.
 * - Regular users with no workspace context only have access to their own data.
 */
export function defineAbilityFor(user: AbilityUser): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // ── System Admin Role (SOC2 Compliant) ──
  if (user.role === 'admin') {
    // Admins can manage user accounts (suspend, delete, support)
    can('manage', 'User');

    // Admins can read workspace metadata for operational purposes
    can('read', 'Workspace');

    // CRITICAL: Admins CANNOT access customer data
    cannot('read', 'MonitoredPage');
    cannot('read', 'Snapshot');
    cannot('read', 'Diff');
    cannot('read', 'AISummary');
    cannot('create', 'MonitoredPage');
    cannot('update', 'MonitoredPage');
    cannot('delete', 'MonitoredPage');
  }

  // ── Workspace-Scoped Roles ──
  if (user.workspaceId && user.workspaceRole) {
    const workspaceCondition = { workspaceId: user.workspaceId };

    switch (user.workspaceRole) {
      case 'owner':
        // Owners have full control over their workspace and its resources
        can('manage', 'Workspace', { _id: user.workspaceId });
        can('manage', 'MonitoredPage', workspaceCondition);
        can('read', 'Snapshot');
        can('read', 'Diff');
        can('read', 'AISummary');
        break;

      case 'editor':
        // Editors can CRUD pages but cannot manage the workspace itself
        can('read', 'Workspace', { _id: user.workspaceId });
        can('create', 'MonitoredPage', workspaceCondition);
        can('read', 'MonitoredPage', workspaceCondition);
        can('update', 'MonitoredPage', workspaceCondition);
        can('delete', 'MonitoredPage', workspaceCondition);
        can('read', 'Snapshot');
        can('read', 'Diff');
        can('read', 'AISummary');
        break;

      case 'viewer':
        // Viewers can only read — no mutations allowed
        can('read', 'Workspace', { _id: user.workspaceId });
        can('read', 'MonitoredPage', workspaceCondition);
        can('read', 'Snapshot');
        can('read', 'Diff');
        can('read', 'AISummary');
        break;
    }
  }

  // ── Fallback: Single-User Mode ──
  // Users who haven't selected a workspace can still access their own data
  if (user.role === 'user' && !user.workspaceId) {
    can('manage', 'MonitoredPage', { userId: user.userId });
    can('read', 'Snapshot');
    can('read', 'Diff');
    can('read', 'AISummary');
    can('read', 'Workspace');
    can('create', 'Workspace');
  }

  return build();
}
