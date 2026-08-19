import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Copy,
  Download,
  KeyRound,
  MonitorCog,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { startRegistration } from '@simplewebauthn/browser';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import api from '../lib/axios';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

interface AuditLog {
  _id: string;
  actorId?: { _id?: string; name?: string; email?: string };
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

interface Session {
  id: string;
  userAgent?: string;
  ipAddress?: string;
  lastSeenAt: string;
  expiresAt: string;
  current: boolean;
}

interface Passkey {
  id: string;
  name?: string;
  deviceType?: string;
  backedUp: boolean;
  lastUsedAt?: string;
  createdAt: string;
}

interface CrawlerDefaults {
  respectRobots: boolean;
  blockedHandling: 'fail' | 'manual_review';
  apiCapture: boolean;
  screenshotDiff: boolean;
  includeFeeds: boolean;
}

interface WorkspaceSettings {
  id: string;
  name: string;
  plan: string;
  maxPages: number;
  pageCount: number;
  crawlerDefaults: CrawlerDefaults;
  notificationDefaults: {
    minimumImportance: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface WebhookEndpoint {
  _id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  lastDeliveryAt?: string;
  lastError?: string;
  createdAt: string;
}

interface ApiKey {
  _id?: string;
  id?: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt?: string;
  expiresAt?: string;
  createdAt: string;
  token?: string;
}

interface CrawlerAuthSession {
  _id: string;
  name: string;
  origin: string;
  lastUsedAt?: string;
  createdAt: string;
}

interface EmailPreferences {
  notifications: boolean;
  marketing: boolean;
  inApp: boolean;
  digestFrequency: 'instant' | 'daily' | 'weekly' | 'never';
  minimumImportance: 'low' | 'medium' | 'high' | 'critical';
  quietHoursStart?: string;
  quietHoursEnd?: string;
  timezone?: string;
}

interface StepUpRequest {
  mode: 'password' | 'mfa';
  reason: string;
  value: string;
  isSubmitting: boolean;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface ConfirmRequest {
  title: string;
  description: string;
  confirmation?: string;
  confirmationValue?: string;
  actionLabel: string;
  onConfirm: () => Promise<void>;
}

const importanceOptions = [
  { label: 'Low and above', value: 'low' },
  { label: 'Medium and above', value: 'medium' },
  { label: 'High and above', value: 'high' },
  { label: 'Critical only', value: 'critical' },
];

const digestOptions = [
  { label: 'Instant', value: 'instant' },
  { label: 'Daily digest', value: 'daily' },
  { label: 'Weekly digest', value: 'weekly' },
  { label: 'Never', value: 'never' },
];

const roleOptions = [
  { label: 'Owner', value: 'owner' },
  { label: 'Editor', value: 'editor' },
  { label: 'Viewer', value: 'viewer' },
];

const webhookEvents = ['page.changed', 'page.failed', 'page.blocked', 'summary.created'];
const apiScopes = ['pages:read', 'pages:write', 'notifications:read', 'webhooks:write'];

const defaultPreferences: EmailPreferences = {
  notifications: true,
  marketing: false,
  inApp: true,
  digestFrequency: 'instant',
  minimumImportance: 'medium',
};

const defaultCrawlerDefaults: CrawlerDefaults = {
  respectRobots: true,
  blockedHandling: 'manual_review',
  apiCapture: false,
  screenshotDiff: false,
  includeFeeds: true,
};

function errorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { error?: string; details?: string[] } } };
  return err.response?.data?.details?.[0] || err.response?.data?.error || fallback;
}

function formatDate(value?: string) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid grid-cols-1 gap-4 border-t border-gray-200 py-6 first:border-t-0 first:pt-0 dark:border-gray-800 lg:grid-cols-3 lg:gap-8">
      <div>
        <h3 className="text-base font-semibold text-gray-950 dark:text-white">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="lg:col-span-2">{children}</div>
    </section>
  );
}

function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-gray-100 py-4 last:border-b-0 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-sm font-medium text-gray-950 dark:text-white">{title}</div>
        {description && <p className="mt-1 text-sm leading-5 text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      <div className="shrink-0 sm:min-w-44">{children}</div>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export function Settings() {
  const { user, activeWorkspaceId, updateUser, logout } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteToken, setInviteToken] = useState('');
  const [emailPreferences, setEmailPreferences] = useState<EmailPreferences>(defaultPreferences);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(Boolean(user?.mfaEnabled));
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditAction, setAuditAction] = useState('');
  const [auditActor, setAuditActor] = useState('');
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    secret: '',
    events: ['page.changed'],
  });
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyForm, setApiKeyForm] = useState({
    name: '',
    scopes: ['pages:read'],
    expiresAt: '',
  });
  const [newApiToken, setNewApiToken] = useState('');
  const [crawlerSessions, setCrawlerSessions] = useState<CrawlerAuthSession[]>([]);
  const [passkeyName, setPasskeyName] = useState('');
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [renamePasskeyState, setRenamePasskeyState] = useState<{ id: string; name: string } | null>(null);
  const [stepUpRequest, setStepUpRequest] = useState<StepUpRequest | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const isOwner = useMemo(() => {
    return user?.role === 'admin' || members.some(member => member.id === user?.id && member.role === 'owner');
  }, [members, user?.id, user?.role]);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setMfaEnabled(Boolean(user?.mfaEnabled));
  }, [user]);

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/members`);
      setMembers(res.data || []);
    } catch {
      setMembers([]);
    }
  }, [activeWorkspaceId]);

  const fetchWorkspaceSettings = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/settings`);
      setWorkspaceSettings({
        ...res.data,
        crawlerDefaults: res.data.crawlerDefaults || defaultCrawlerDefaults,
        notificationDefaults: res.data.notificationDefaults || { minimumImportance: 'medium' },
      });
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to load workspace settings'));
    }
  }, [activeWorkspaceId]);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await api.get('/users/me/preferences');
      setEmailPreferences({ ...defaultPreferences, ...(res.data.emailPreferences || {}) });
    } catch {
      // Preferences are non-critical for first paint.
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get('/users/me/sessions');
      setSessions(res.data || []);
    } catch {
      setSessions([]);
    }
  }, []);

  const fetchPasskeys = useCallback(async () => {
    try {
      const res = await api.get('/users/me/passkeys');
      setPasskeys(res.data || []);
    } catch {
      setPasskeys([]);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (page: number) => {
    if (!activeWorkspaceId) return;
    try {
      const params = new URLSearchParams({ page: String(page), limit: '25' });
      if (auditAction.trim()) params.set('action', auditAction.trim());
      if (auditActor.trim()) params.set('actor', auditActor.trim());
      const res = await api.get(`/workspaces/${activeWorkspaceId}/audit-logs?${params.toString()}`);
      if (Array.isArray(res.data)) {
        setAuditLogs(res.data);
        setAuditTotalPages(1);
      } else {
        setAuditLogs(res.data.data || []);
        setAuditTotalPages(res.data.meta?.totalPages || 1);
      }
      setAuditPage(page);
    } catch {
      setAuditLogs([]);
      setAuditTotalPages(1);
    }
  }, [activeWorkspaceId, auditAction, auditActor]);

  const fetchWebhooks = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/webhooks`);
      setWebhooks(res.data || []);
    } catch {
      setWebhooks([]);
    }
  }, [activeWorkspaceId]);

  const fetchApiKeys = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/api-keys`);
      setApiKeys(res.data || []);
    } catch {
      setApiKeys([]);
    }
  }, [activeWorkspaceId]);

  const fetchCrawlerSessions = useCallback(async () => {
    try {
      const res = await api.get('/pages/auth-sessions');
      setCrawlerSessions(res.data || []);
    } catch {
      setCrawlerSessions([]);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
    fetchSessions();
    fetchPasskeys();
    fetchCrawlerSessions();
  }, [fetchCrawlerSessions, fetchPasskeys, fetchPreferences, fetchSessions]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetchMembers();
    fetchWorkspaceSettings();
    fetchAuditLogs(1);
    fetchWebhooks();
    fetchApiKeys();
  }, [activeWorkspaceId, fetchApiKeys, fetchAuditLogs, fetchMembers, fetchWebhooks, fetchWorkspaceSettings]);

  const requestStepUp = useCallback((options: { requireMfa?: boolean; reason: string }) => {
    const mustUseMfa = options.requireMfa || mfaEnabled || user?.role === 'admin';
    if (mustUseMfa && !mfaEnabled) {
      toast.error('Enable two-factor authentication before performing this action.');
      return Promise.reject(new Error('MFA required'));
    }

    return new Promise<void>((resolve, reject) => {
      setStepUpRequest({
        mode: mustUseMfa ? 'mfa' : 'password',
        reason: options.reason,
        value: '',
        isSubmitting: false,
        resolve,
        reject,
      });
    });
  }, [mfaEnabled, user?.role]);

  const submitStepUp = async () => {
    if (!stepUpRequest || !stepUpRequest.value.trim()) return;
    setStepUpRequest({ ...stepUpRequest, isSubmitting: true });
    try {
      await api.post('/auth/step-up', stepUpRequest.mode === 'mfa'
        ? { mfaCode: stepUpRequest.value.trim() }
        : { currentPassword: stepUpRequest.value });
      stepUpRequest.resolve();
      setStepUpRequest(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Verification failed'));
      setStepUpRequest({ ...stepUpRequest, value: '', isSubmitting: false });
    }
  };

  const closeStepUp = () => {
    stepUpRequest?.reject(new Error('Step-up cancelled'));
    setStepUpRequest(null);
  };

  const askConfirm = (request: ConfirmRequest) => {
    setConfirmText('');
    setConfirmRequest(request);
  };

  const runConfirmedAction = async () => {
    if (!confirmRequest) return;
    if (confirmRequest.confirmation && confirmText !== confirmRequest.confirmation) return;
    const request = confirmRequest;
    setConfirmRequest(null);
    setConfirmText('');
    try {
      await request.onConfirm();
    } catch (error) {
      toast.error(errorMessage(error, 'Action failed'));
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      await requestStepUp({ reason: 'Save profile changes' });
      const res = await api.patch('/users/me', { name: profileName, email: profileEmail });
      if (res.data.user) updateUser(res.data.user);
      toast.success(res.data.user?.isEmailVerified === false ? 'Profile saved. Verify the new email to keep access healthy.' : 'Profile saved');
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to save profile'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const saveWorkspaceSettings = async () => {
    if (!activeWorkspaceId || !workspaceSettings) return;
    setIsSaving(true);
    try {
      await requestStepUp({ reason: 'Update workspace crawler and notification policy' });
      const res = await api.patch(`/workspaces/${activeWorkspaceId}/settings`, {
        name: workspaceSettings.name,
        crawlerDefaults: workspaceSettings.crawlerDefaults,
        notificationDefaults: workspaceSettings.notificationDefaults,
      });
      setWorkspaceSettings({ ...workspaceSettings, ...res.data });
      toast.success('Workspace settings saved');
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to save workspace settings'));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const savePreferences = async () => {
    try {
      const res = await api.patch('/users/me/preferences', emailPreferences);
      setEmailPreferences({ ...defaultPreferences, ...(res.data.emailPreferences || {}) });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save preferences'));
    }
  };

  const changePassword = async () => {
    try {
      await api.post('/users/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      toast.success('Password changed. Other sessions were revoked.');
      fetchSessions();
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to change password'));
    }
  };

  const startMfaSetup = async () => {
    try {
      const res = await api.post('/auth/mfa/setup');
      setMfaSecret(res.data.secret);
      setQrCode(res.data.qrCodeImage);
      setIsSettingUpMfa(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to initiate MFA setup'));
    }
  };

  const verifyAndEnableMfa = async () => {
    try {
      const res = await api.post('/auth/mfa/verify', { code: verificationCode });
      setMfaEnabled(true);
      if (user) updateUser({ ...user, mfaEnabled: true });
      setIsSettingUpMfa(false);
      setVerificationCode('');
      setRecoveryCodes(res.data.recoveryCodes || []);
      toast.success('Two-factor authentication enabled');
    } catch (error) {
      toast.error(errorMessage(error, 'Invalid verification code'));
    }
  };

  const disableMfa = () => askConfirm({
    title: 'Disable two-factor authentication',
    description: 'This lowers account protection. Step-up verification is required before the change is applied.',
    actionLabel: 'Disable 2FA',
    onConfirm: async () => {
      await requestStepUp({ requireMfa: true, reason: 'Disable two-factor authentication' });
      await api.post('/users/me/mfa/disable', {});
      setMfaEnabled(false);
      if (user) updateUser({ ...user, mfaEnabled: false });
      setRecoveryCodes([]);
      toast.success('Two-factor authentication disabled');
    },
  });

  const regenerateRecoveryCodes = async () => {
    try {
      await requestStepUp({ requireMfa: true, reason: 'Regenerate recovery codes' });
      const res = await api.post('/users/me/mfa/recovery-codes');
      setRecoveryCodes(res.data.recoveryCodes || []);
      toast.success('Recovery codes regenerated');
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to regenerate recovery codes'));
      }
    }
  };

  const addPasskey = async () => {
    try {
      await requestStepUp({ reason: 'Add a passkey' });
      const optionsRes = await api.post('/auth/passkeys/register/options');
      const credential = await startRegistration({ optionsJSON: optionsRes.data } as any);
      await api.post('/auth/passkeys/register/verify', { credential, name: passkeyName.trim() || 'Passkey' });
      setPasskeyName('');
      setIsPasskeyModalOpen(false);
      toast.success('Passkey added');
      fetchPasskeys();
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to add passkey'));
      }
    }
  };

  const renamePasskey = async () => {
    if (!renamePasskeyState) return;
    try {
      await requestStepUp({ reason: 'Rename passkey' });
      await api.patch(`/users/me/passkeys/${renamePasskeyState.id}`, { name: renamePasskeyState.name });
      setRenamePasskeyState(null);
      toast.success('Passkey renamed');
      fetchPasskeys();
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to rename passkey'));
      }
    }
  };

  const deletePasskey = (passkey: Passkey) => askConfirm({
    title: 'Delete passkey',
    description: `Remove ${passkey.name || 'this passkey'} from your account. You will need another sign-in method after this.`,
    actionLabel: 'Delete passkey',
    onConfirm: async () => {
      await requestStepUp({ reason: 'Delete passkey' });
      await api.delete(`/users/me/passkeys/${passkey.id}`);
      toast.success('Passkey deleted');
      fetchPasskeys();
    },
  });

  const revokeSession = (session: Session) => askConfirm({
    title: session.current ? 'Sign out current session' : 'Revoke session',
    description: session.current ? 'You will be signed out on this device.' : 'This device will need to sign in again.',
    actionLabel: session.current ? 'Sign out' : 'Revoke session',
    onConfirm: async () => {
      await requestStepUp({ reason: 'Revoke session' });
      await api.delete(`/users/me/sessions/${session.id}`);
      toast.success('Session revoked');
      session.current ? logout() : fetchSessions();
    },
  });

  const revokeOtherSessions = () => askConfirm({
    title: 'Revoke all other sessions',
    description: 'Every other browser and device will need to sign in again.',
    actionLabel: 'Revoke other sessions',
    onConfirm: async () => {
      await requestStepUp({ reason: 'Revoke other sessions' });
      await api.delete('/users/me/sessions/others');
      toast.success('Other sessions revoked');
      fetchSessions();
    },
  });

  const generateInvite = async () => {
    if (!activeWorkspaceId) return;
    try {
      await requestStepUp({ reason: 'Invite a workspace member' });
      const payload = { role: inviteRole, ...(inviteEmail.trim() ? { email: inviteEmail.trim() } : {}) };
      const res = await api.post(`/workspaces/${activeWorkspaceId}/invites`, payload);
      setInviteToken(res.data.inviteToken);
      if (res.data.emailSent) setInviteEmail('');
      toast.success(res.data.emailSent ? 'Invite email sent' : 'Invite link generated');
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to generate invite'));
      }
    }
  };

  const updateRole = async (memberId: string, role: string) => {
    if (!activeWorkspaceId) return;
    try {
      await requestStepUp({ reason: 'Change a member role' });
      await api.patch(`/workspaces/${activeWorkspaceId}/members/${memberId}`, { role });
      toast.success('Role updated');
      fetchMembers();
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to update role'));
      }
    }
  };

  const removeMember = (member: Member) => askConfirm({
    title: member.id === user?.id ? 'Leave workspace' : 'Remove member',
    description: member.id === user?.id ? 'You will lose access to this workspace.' : `${member.email} will lose access to this workspace.`,
    actionLabel: member.id === user?.id ? 'Leave workspace' : 'Remove member',
    onConfirm: async () => {
      if (!activeWorkspaceId) return;
      await requestStepUp({ reason: 'Remove a workspace member' });
      await api.delete(`/workspaces/${activeWorkspaceId}/members/${member.id}`);
      toast.success(member.id === user?.id ? 'You left the workspace' : 'Member removed');
      fetchMembers();
    },
  });

  const createWebhook = async () => {
    if (!activeWorkspaceId) return;
    try {
      await requestStepUp({ reason: 'Create webhook endpoint' });
      const res = await api.post(`/workspaces/${activeWorkspaceId}/webhooks`, webhookForm);
      setWebhooks([res.data, ...webhooks]);
      setWebhookForm({ name: '', url: '', secret: '', events: ['page.changed'] });
      toast.success('Webhook created');
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to create webhook'));
      }
    }
  };

  const updateWebhookStatus = async (webhook: WebhookEndpoint, isActive: boolean) => {
    if (!activeWorkspaceId) return;
    try {
      await requestStepUp({ reason: 'Update webhook status' });
      const res = await api.patch(`/workspaces/${activeWorkspaceId}/webhooks/${webhook._id}`, { isActive });
      setWebhooks(current => current.map(item => item._id === webhook._id ? res.data : item));
      toast.success('Webhook updated');
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to update webhook'));
      }
    }
  };

  const deleteWebhook = (webhook: WebhookEndpoint) => askConfirm({
    title: 'Delete webhook',
    description: `${webhook.name} will stop receiving Deltaora events.`,
    actionLabel: 'Delete webhook',
    onConfirm: async () => {
      if (!activeWorkspaceId) return;
      await requestStepUp({ reason: 'Delete webhook endpoint' });
      await api.delete(`/workspaces/${activeWorkspaceId}/webhooks/${webhook._id}`);
      setWebhooks(current => current.filter(item => item._id !== webhook._id));
      toast.success('Webhook deleted');
    },
  });

  const createApiKey = async () => {
    if (!activeWorkspaceId) return;
    try {
      await requestStepUp({ reason: 'Create API key' });
      const res = await api.post(`/workspaces/${activeWorkspaceId}/api-keys`, {
        name: apiKeyForm.name,
        scopes: apiKeyForm.scopes,
        expiresAt: apiKeyForm.expiresAt ? new Date(apiKeyForm.expiresAt).toISOString() : undefined,
      });
      setNewApiToken(res.data.token);
      setApiKeys([{ ...res.data, _id: res.data.id }, ...apiKeys]);
      setApiKeyForm({ name: '', scopes: ['pages:read'], expiresAt: '' });
      toast.success('API key created');
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to create API key'));
      }
    }
  };

  const revokeApiKey = (key: ApiKey) => askConfirm({
    title: 'Revoke API key',
    description: `${key.name} will stop working immediately.`,
    actionLabel: 'Revoke key',
    onConfirm: async () => {
      if (!activeWorkspaceId) return;
      await requestStepUp({ reason: 'Revoke API key' });
      await api.delete(`/workspaces/${activeWorkspaceId}/api-keys/${key._id || key.id}`);
      setApiKeys(current => current.filter(item => (item._id || item.id) !== (key._id || key.id)));
      toast.success('API key revoked');
    },
  });

  const deleteCrawlerSession = (session: CrawlerAuthSession) => askConfirm({
    title: 'Delete crawler auth session',
    description: `${session.name} will no longer be available for authenticated monitoring on ${session.origin}.`,
    actionLabel: 'Delete session',
    onConfirm: async () => {
      await requestStepUp({ reason: 'Delete crawler authentication session' });
      await api.delete(`/pages/auth-sessions/${session._id}`);
      setCrawlerSessions(current => current.filter(item => item._id !== session._id));
      toast.success('Crawler auth session deleted');
    },
  });

  const downloadAccountExport = async () => {
    try {
      const res = await api.get('/users/me/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `deltaora-account-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Account export downloaded');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to export account data'));
    }
  };

  const exportAuditLogs = async () => {
    if (!activeWorkspaceId) return;
    try {
      const params = new URLSearchParams({ export: 'csv', limit: '100' });
      if (auditAction.trim()) params.set('action', auditAction.trim());
      if (auditActor.trim()) params.set('actor', auditActor.trim());
      const res = await api.get(`/workspaces/${activeWorkspaceId}/audit-logs?${params.toString()}`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `deltaora-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to export audit logs'));
    }
  };

  const deleteAccount = () => askConfirm({
    title: 'Delete account',
    description: 'This anonymizes your account and revokes active sessions. Transfer ownership first for shared workspaces where you are the last owner.',
    confirmation: user?.email,
    confirmationValue: user?.email,
    actionLabel: 'Delete account',
    onConfirm: async () => {
      await requestStepUp({ reason: 'Delete your Deltaora account' });
      await api.delete('/users/me');
      toast.success('Account deleted');
      logout();
    },
  });

  const toggleString = (value: string, values: string[]) => (
    values.includes(value) ? values.filter(item => item !== value) : [...values, value]
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white">Settings</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage account security, workspace governance, crawler compliance, and operational integrations.
          </p>
        </div>
        <div className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {workspaceSettings ? `${workspaceSettings.pageCount} / ${workspaceSettings.maxPages} pages on ${workspaceSettings.plan}` : 'Workspace loading'}
        </div>
      </div>

      <Section title="Appearance" description="Use an explicit theme or follow the operating system preference.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <SettingRow title="Theme" description={`Currently resolved to ${resolvedTheme}.`}>
              <div className="flex items-center gap-2">
                {resolvedTheme === 'dark' ? <Moon className="h-4 w-4 text-gray-500" /> : <Sun className="h-4 w-4 text-amber-500" />}
                <Select
                  aria-label="Theme preference"
                  value={theme}
                  onChange={event => setTheme(event.target.value as ThemePreference)}
                  options={[
                    { label: 'System', value: 'system' },
                    { label: 'Light', value: 'light' },
                    { label: 'Dark', value: 'dark' },
                  ]}
                />
              </div>
            </SettingRow>
          </CardContent>
        </Card>
      </Section>

      <Section title="Profile" description="Keep identity details current and require step-up verification for sensitive changes.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" value={profileName} onChange={event => setProfileName(event.target.value)} />
              <Input label="Email" type="email" value={profileEmail} onChange={event => setProfileEmail(event.target.value)} />
            </div>
            <div className="flex justify-end">
              <Button onClick={saveProfile} isLoading={isSaving} disabled={!profileName.trim() || !profileEmail.trim()}>
                Save profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Workspace" description="Set defaults that apply to newly monitored websites in this workspace.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Input
              label="Workspace name"
              value={workspaceSettings?.name || ''}
              disabled={!workspaceSettings || !isOwner}
              onChange={event => workspaceSettings && setWorkspaceSettings({ ...workspaceSettings, name: event.target.value })}
            />
            <SettingRow title="Respect robots.txt" description="Keep conservative public-site crawling enabled by default.">
              <Switch
                checked={workspaceSettings?.crawlerDefaults.respectRobots ?? true}
                disabled={!workspaceSettings || !isOwner}
                label="Respect robots.txt"
                onChange={checked => workspaceSettings && setWorkspaceSettings({
                  ...workspaceSettings,
                  crawlerDefaults: { ...workspaceSettings.crawlerDefaults, respectRobots: checked },
                })}
              />
            </SettingRow>
            <SettingRow title="Blocked-site handling" description="CAPTCHA and bot defenses are reported instead of bypassed.">
              <Select
                value={workspaceSettings?.crawlerDefaults.blockedHandling || 'manual_review'}
                disabled={!workspaceSettings || !isOwner}
                onChange={event => workspaceSettings && setWorkspaceSettings({
                  ...workspaceSettings,
                  crawlerDefaults: { ...workspaceSettings.crawlerDefaults, blockedHandling: event.target.value as 'fail' | 'manual_review' },
                })}
                options={[
                  { label: 'Manual review', value: 'manual_review' },
                  { label: 'Fail the crawl', value: 'fail' },
                ]}
              />
            </SettingRow>
            <SettingRow title="Capture stable API responses" description="Prefer JSON/XHR payloads when the site exposes monitorable data after render.">
              <Switch
                checked={workspaceSettings?.crawlerDefaults.apiCapture ?? false}
                disabled={!workspaceSettings || !isOwner}
                label="Capture stable API responses"
                onChange={checked => workspaceSettings && setWorkspaceSettings({
                  ...workspaceSettings,
                  crawlerDefaults: { ...workspaceSettings.crawlerDefaults, apiCapture: checked },
                })}
              />
            </SettingRow>
            <SettingRow title="Screenshot diffing" description="Enable visual fallback for image-heavy or canvas-heavy monitored pages.">
              <Switch
                checked={workspaceSettings?.crawlerDefaults.screenshotDiff ?? false}
                disabled={!workspaceSettings || !isOwner}
                label="Screenshot diffing"
                onChange={checked => workspaceSettings && setWorkspaceSettings({
                  ...workspaceSettings,
                  crawlerDefaults: { ...workspaceSettings.crawlerDefaults, screenshotDiff: checked },
                })}
              />
            </SettingRow>
            <SettingRow title="Discover feeds and sitemaps" description="Use declared discovery surfaces before same-domain crawling.">
              <Switch
                checked={workspaceSettings?.crawlerDefaults.includeFeeds ?? true}
                disabled={!workspaceSettings || !isOwner}
                label="Discover feeds and sitemaps"
                onChange={checked => workspaceSettings && setWorkspaceSettings({
                  ...workspaceSettings,
                  crawlerDefaults: { ...workspaceSettings.crawlerDefaults, includeFeeds: checked },
                })}
              />
            </SettingRow>
            <SettingRow title="Default alert importance" description="Set the workspace floor for new monitoring notifications.">
              <Select
                value={workspaceSettings?.notificationDefaults.minimumImportance || 'medium'}
                disabled={!workspaceSettings || !isOwner}
                onChange={event => workspaceSettings && setWorkspaceSettings({
                  ...workspaceSettings,
                  notificationDefaults: {
                    minimumImportance: event.target.value as WorkspaceSettings['notificationDefaults']['minimumImportance'],
                  },
                })}
                options={importanceOptions}
              />
            </SettingRow>
            <div className="flex justify-end">
              <Button onClick={saveWorkspaceSettings} isLoading={isSaving} disabled={!workspaceSettings || !isOwner}>
                Save workspace policy
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Billing" description="Track plan capacity and workspace usage.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                <div className="text-xs uppercase text-gray-500">Plan</div>
                <div className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">{workspaceSettings?.plan || 'Loading'}</div>
              </div>
              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                <div className="text-xs uppercase text-gray-500">Monitored pages</div>
                <div className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">{workspaceSettings?.pageCount ?? 0}</div>
              </div>
              <div className="rounded-md border border-gray-200 p-3 dark:border-gray-800">
                <div className="text-xs uppercase text-gray-500">Page limit</div>
                <div className="mt-1 text-lg font-semibold text-gray-950 dark:text-white">{workspaceSettings?.maxPages ?? 0}</div>
              </div>
            </div>
            <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-2 rounded-full bg-blue-600"
                style={{
                  width: `${Math.min(100, Math.round(((workspaceSettings?.pageCount || 0) / Math.max(1, workspaceSettings?.maxPages || 1)) * 100))}%`,
                }}
              />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" disabled>Manage billing</Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Team" description="Manage workspace access with owner, editor, and viewer roles.">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-3">
              {members.map(member => (
                <div key={member.id} className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-medium text-gray-950 dark:text-white">{member.name}</div>
                    <div className="text-sm text-gray-500">{member.email}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label={`Role for ${member.email}`}
                      className="min-w-32"
                      value={member.role}
                      disabled={!isOwner}
                      onChange={event => updateRole(member.id, event.target.value)}
                      options={roleOptions}
                    />
                    <Button variant="outline" onClick={() => removeMember(member)} disabled={!isOwner && member.id !== user?.id}>
                      {member.id === user?.id ? 'Leave' : 'Remove'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:grid-cols-[1fr_160px_auto]">
              <Input label="Invite email" type="email" placeholder="teammate@example.com" value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} />
              <Select label="Role" value={inviteRole} onChange={event => setInviteRole(event.target.value as 'editor' | 'viewer')} options={roleOptions.filter(option => option.value !== 'owner')} />
              <div className="flex items-end">
                <Button onClick={generateInvite} disabled={!isOwner}>Invite</Button>
              </div>
            </div>
            {inviteToken && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950/40">
                <div className="mb-2 text-sm font-medium text-blue-900 dark:text-blue-200">Invite link valid for 48 hours</div>
                <div className="flex gap-2">
                  <Input readOnly value={`${window.location.origin}/join?token=${inviteToken}`} aria-label="Invite link" />
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Copy invite link"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/join?token=${inviteToken}`);
                      toast.success('Copied');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </Section>

      <Section title="Security" description="Use phishing-resistant sign-in options, MFA, recovery codes, and active-session controls.">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <SettingRow title="Two-factor authentication" description="Authenticator app MFA is required for high-risk account and workspace actions once enabled.">
              {mfaEnabled ? (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={regenerateRecoveryCodes}>Recovery codes</Button>
                  <Button variant="destructive" onClick={disableMfa}>Disable</Button>
                </div>
              ) : (
                <Button variant="outline" onClick={startMfaSetup}>Enable 2FA</Button>
              )}
            </SettingRow>
            {isSettingUpMfa && qrCode && !mfaEnabled && (
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <div className="rounded-md bg-white p-4">
                    <img src={qrCode} alt="Authenticator app QR code" className="h-44 w-44" />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-300">Scan the code, then enter the six-digit verification code.</p>
                    <div className="break-all rounded-md bg-white p-3 font-mono text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">{mfaSecret}</div>
                    <div className="flex gap-2">
                      <Input aria-label="MFA verification code" inputMode="numeric" value={verificationCode} onChange={event => setVerificationCode(event.target.value)} placeholder="123456" />
                      <Button onClick={verifyAndEnableMfa}>Verify</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {recoveryCodes.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                <div className="mb-2 text-sm font-medium text-amber-900 dark:text-amber-200">Save these recovery codes now. They are shown once.</div>
                <div className="grid gap-2 font-mono text-sm sm:grid-cols-2">
                  {recoveryCodes.map(code => <span key={code}>{code}</span>)}
                </div>
              </div>
            )}
            <div className="grid gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:grid-cols-2">
              <Input label="Current password" type="password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} />
              <Input label="New password" type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} />
              <div className="sm:col-span-2">
                <Button onClick={changePassword} disabled={!currentPassword || newPassword.length < 15}>Change password</Button>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-950 dark:text-white">Passkeys</div>
                  <p className="text-sm text-gray-500">Use device-bound or synced passkeys where supported.</p>
                </div>
                <Button variant="outline" onClick={() => setIsPasskeyModalOpen(true)}>
                  <KeyRound className="mr-2 h-4 w-4" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {passkeys.length === 0 && <p className="text-sm text-gray-500">No passkeys registered.</p>}
                {passkeys.map(passkey => (
                  <div key={passkey.id} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-gray-950 dark:text-white">{passkey.name || 'Passkey'}</div>
                      <div className="text-sm text-gray-500">{passkey.deviceType || 'Device'} / {passkey.backedUp ? 'Backed up' : 'Device only'} / Last used {formatDate(passkey.lastUsedAt)}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setRenamePasskeyState({ id: passkey.id, name: passkey.name || '' })}>Rename</Button>
                      <Button variant="outline" size="icon" aria-label="Delete passkey" onClick={() => deletePasskey(passkey)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-950 dark:text-white">Active sessions</div>
                  <p className="text-sm text-gray-500">Review browsers and devices with active access.</p>
                </div>
                <Button variant="outline" onClick={revokeOtherSessions}>Revoke others</Button>
              </div>
              <div className="space-y-2">
                {sessions.map(session => (
                  <div key={session.id} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-gray-950 dark:text-white">{session.current ? 'Current session' : session.userAgent || 'Unknown device'}</div>
                      <div className="text-sm text-gray-500">{session.ipAddress || 'Unknown IP'} / Last seen {formatDate(session.lastSeenAt)}</div>
                    </div>
                    <Button variant="outline" onClick={() => revokeSession(session)}>{session.current ? 'Sign out' : 'Revoke'}</Button>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Notifications" description="Tune email and in-app alert volume without losing critical monitoring signals.">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <SettingRow title="Email monitoring alerts">
              <Switch checked={emailPreferences.notifications} label="Email monitoring alerts" onChange={checked => setEmailPreferences({ ...emailPreferences, notifications: checked })} />
            </SettingRow>
            <SettingRow title="In-app notifications">
              <Switch checked={emailPreferences.inApp} label="In-app notifications" onChange={checked => setEmailPreferences({ ...emailPreferences, inApp: checked })} />
            </SettingRow>
            <SettingRow title="Product and marketing email">
              <Switch checked={emailPreferences.marketing} label="Product and marketing email" onChange={checked => setEmailPreferences({ ...emailPreferences, marketing: checked })} />
            </SettingRow>
            <div className="grid gap-4 py-4 sm:grid-cols-2">
              <Select label="Digest frequency" value={emailPreferences.digestFrequency} options={digestOptions} onChange={event => setEmailPreferences({ ...emailPreferences, digestFrequency: event.target.value as EmailPreferences['digestFrequency'] })} />
              <Select label="Minimum importance" value={emailPreferences.minimumImportance} options={importanceOptions} onChange={event => setEmailPreferences({ ...emailPreferences, minimumImportance: event.target.value as EmailPreferences['minimumImportance'] })} />
              <Input label="Quiet hours start" type="time" value={emailPreferences.quietHoursStart || ''} onChange={event => setEmailPreferences({ ...emailPreferences, quietHoursStart: event.target.value })} />
              <Input label="Quiet hours end" type="time" value={emailPreferences.quietHoursEnd || ''} onChange={event => setEmailPreferences({ ...emailPreferences, quietHoursEnd: event.target.value })} />
              <Input label="Timezone" value={emailPreferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || ''} onChange={event => setEmailPreferences({ ...emailPreferences, timezone: event.target.value })} />
            </div>
            <div className="flex justify-end">
              <Button onClick={savePreferences}>Save notification settings</Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Integrations" description="Connect approved downstream systems without sharing passwords or crawler secrets.">
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-2 font-medium text-gray-950 dark:text-white">
                <MonitorCog className="h-4 w-4" /> Webhooks
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Name" value={webhookForm.name} onChange={event => setWebhookForm({ ...webhookForm, name: event.target.value })} />
                <Input label="URL" type="url" value={webhookForm.url} onChange={event => setWebhookForm({ ...webhookForm, url: event.target.value })} />
                <Input label="Signing secret" type="password" value={webhookForm.secret} onChange={event => setWebhookForm({ ...webhookForm, secret: event.target.value })} />
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Events</div>
                  <div className="flex flex-wrap gap-2">
                    {webhookEvents.map(event => (
                      <label key={event} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
                        <input
                          type="checkbox"
                          checked={webhookForm.events.includes(event)}
                          onChange={() => setWebhookForm({ ...webhookForm, events: toggleString(event, webhookForm.events) })}
                        />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={createWebhook} disabled={!isOwner || !webhookForm.name || !webhookForm.url || webhookForm.events.length === 0}>Create webhook</Button>
              <div className="space-y-2">
                {webhooks.map(webhook => (
                  <div key={webhook._id} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-gray-950 dark:text-white">{webhook.name}</div>
                      <div className="break-all text-sm text-gray-500">{webhook.url}</div>
                      <div className="text-xs text-gray-500">Last delivery {formatDate(webhook.lastDeliveryAt)}{webhook.lastError ? ` / ${webhook.lastError}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={webhook.isActive} disabled={!isOwner} label={`Enable ${webhook.name}`} onChange={checked => updateWebhookStatus(webhook, checked)} />
                      <Button variant="outline" size="icon" disabled={!isOwner} aria-label="Delete webhook" onClick={() => deleteWebhook(webhook)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                {webhooks.length === 0 && <p className="text-sm text-gray-500">No webhooks configured.</p>}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-center gap-2 font-medium text-gray-950 dark:text-white">
                <KeyRound className="h-4 w-4" /> API keys
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Input label="Name" value={apiKeyForm.name} onChange={event => setApiKeyForm({ ...apiKeyForm, name: event.target.value })} />
                <Input label="Expires at" type="date" value={apiKeyForm.expiresAt} onChange={event => setApiKeyForm({ ...apiKeyForm, expiresAt: event.target.value })} />
                <div>
                  <div className="mb-1 text-sm font-medium text-gray-700 dark:text-gray-300">Scopes</div>
                  <div className="flex flex-wrap gap-2">
                    {apiScopes.map(scope => (
                      <label key={scope} className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm dark:border-gray-800">
                        <input
                          type="checkbox"
                          checked={apiKeyForm.scopes.includes(scope)}
                          onChange={() => setApiKeyForm({ ...apiKeyForm, scopes: toggleString(scope, apiKeyForm.scopes) })}
                        />
                        {scope}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <Button onClick={createApiKey} disabled={!isOwner || !apiKeyForm.name || apiKeyForm.scopes.length === 0}>Create API key</Button>
              <div className="space-y-2">
                {apiKeys.map(key => (
                  <div key={key._id || key.id} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-gray-950 dark:text-white">{key.name}</div>
                      <div className="text-sm text-gray-500">{key.keyPrefix}... / {key.scopes.join(', ')}</div>
                      <div className="text-xs text-gray-500">Last used {formatDate(key.lastUsedAt)} / Expires {formatDate(key.expiresAt)}</div>
                    </div>
                    <Button variant="outline" disabled={!isOwner} onClick={() => revokeApiKey(key)}>Revoke</Button>
                  </div>
                ))}
                {apiKeys.length === 0 && <p className="text-sm text-gray-500">No API keys created.</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </Section>

      <Section title="Crawler Auth" description="Review saved browser sessions used for websites where you have authorized access.">
        <Card>
          <CardContent className="space-y-3 pt-6">
            {crawlerSessions.map(session => (
              <div key={session._id} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-gray-950 dark:text-white">{session.name}</div>
                  <div className="text-sm text-gray-500">{session.origin} / Last used {formatDate(session.lastUsedAt)}</div>
                </div>
                <Button variant="outline" onClick={() => deleteCrawlerSession(session)}>Delete</Button>
              </div>
            ))}
            {crawlerSessions.length === 0 && <p className="text-sm text-gray-500">No crawler auth sessions saved.</p>}
          </CardContent>
        </Card>
      </Section>

      <Section title="Data & Privacy" description="Export account data or request deletion with extra verification.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <SettingRow title="Account data export" description="Download the profile, workspace membership, monitored pages, and notifications attached to your account.">
              <Button variant="outline" onClick={downloadAccountExport}>
                <Download className="mr-2 h-4 w-4" /> Export
              </Button>
            </SettingRow>
            <SettingRow title="Delete account" description="Anonymize your account and revoke sessions. Shared workspaces may require ownership transfer first.">
              <Button variant="destructive" onClick={deleteAccount}>Delete account</Button>
            </SettingRow>
          </CardContent>
        </Card>
      </Section>

      <Section title="Audit Logs" description="Filter and export administrative evidence for compliance reviews.">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto]">
              <Input label="Action filter" value={auditAction} placeholder="member, webhook, auth" onChange={event => setAuditAction(event.target.value)} />
              <Input label="Actor ID" value={auditActor} placeholder="Optional Mongo ID" onChange={event => setAuditActor(event.target.value)} />
              <div className="flex items-end">
                <Button variant="outline" onClick={() => fetchAuditLogs(1)}>Apply</Button>
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={exportAuditLogs} disabled={!isOwner}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-gray-200 text-xs uppercase text-gray-500 dark:border-gray-800">
                  <tr>
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Actor</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2 pr-3">IP</th>
                    <th className="py-2">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {auditLogs.map(log => (
                    <tr key={log._id}>
                      <td className="py-3 pr-3 text-gray-500">{formatDate(log.createdAt)}</td>
                      <td className="py-3 pr-3">{log.actorId?.email || log.actorId?.name || 'System'}</td>
                      <td className="py-3 pr-3 font-medium text-gray-950 dark:text-white">{log.action}</td>
                      <td className="py-3 pr-3 text-gray-500">{log.ipAddress || 'Unknown'}</td>
                      <td className="max-w-xs truncate py-3 text-gray-500">{JSON.stringify(log.metadata || {})}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {auditLogs.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No audit logs available for this workspace.</p>}
            </div>
            <div className="flex items-center justify-between">
              <Button variant="outline" disabled={auditPage <= 1} onClick={() => fetchAuditLogs(auditPage - 1)}>Previous</Button>
              <span className="text-sm text-gray-500">Page {auditPage} of {auditTotalPages}</span>
              <Button variant="outline" disabled={auditPage >= auditTotalPages} onClick={() => fetchAuditLogs(auditPage + 1)}>Next</Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Modal
        isOpen={Boolean(stepUpRequest)}
        onClose={closeStepUp}
        title="Verify it is you"
        description={stepUpRequest?.reason}
      >
        <div className="space-y-4">
          <Input
            autoFocus
            label={stepUpRequest?.mode === 'mfa' ? 'Authentication code' : 'Current password'}
            type={stepUpRequest?.mode === 'mfa' ? 'text' : 'password'}
            inputMode={stepUpRequest?.mode === 'mfa' ? 'numeric' : undefined}
            value={stepUpRequest?.value || ''}
            onChange={event => stepUpRequest && setStepUpRequest({ ...stepUpRequest, value: event.target.value })}
            onKeyDown={event => {
              if (event.key === 'Enter') submitStepUp();
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeStepUp}>Cancel</Button>
            <Button onClick={submitStepUp} isLoading={stepUpRequest?.isSubmitting}>Continue</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isPasskeyModalOpen} onClose={() => setIsPasskeyModalOpen(false)} title="Add passkey">
        <div className="space-y-4">
          <Input label="Passkey name" value={passkeyName} onChange={event => setPasskeyName(event.target.value)} placeholder="Work laptop" />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsPasskeyModalOpen(false)}>Cancel</Button>
            <Button onClick={addPasskey}>Create passkey</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(renamePasskeyState)} onClose={() => setRenamePasskeyState(null)} title="Rename passkey">
        <div className="space-y-4">
          <Input label="Name" value={renamePasskeyState?.name || ''} onChange={event => renamePasskeyState && setRenamePasskeyState({ ...renamePasskeyState, name: event.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenamePasskeyState(null)}>Cancel</Button>
            <Button onClick={renamePasskey} disabled={!renamePasskeyState?.name.trim()}>Save</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(newApiToken)} onClose={() => setNewApiToken('')} title="Copy API key">
        <div className="space-y-4">
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            This token is shown once. Store it in a secrets manager before closing.
          </div>
          <div className="flex gap-2">
            <Input readOnly value={newApiToken} aria-label="New API token" />
            <Button variant="outline" size="icon" aria-label="Copy API key" onClick={() => {
              navigator.clipboard.writeText(newApiToken);
              toast.success('Copied');
            }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setNewApiToken('')}>Done</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(confirmRequest)} onClose={() => setConfirmRequest(null)} title={confirmRequest?.title || 'Confirm action'}>
        <div className="space-y-4">
          <div className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{confirmRequest?.description}</span>
          </div>
          {confirmRequest?.confirmation && (
            <Input
              label={`Type ${confirmRequest.confirmationValue || confirmRequest.confirmation} to confirm`}
              value={confirmText}
              onChange={event => setConfirmText(event.target.value)}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmRequest(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={runConfirmedAction}
              disabled={Boolean(confirmRequest?.confirmation && confirmText !== confirmRequest.confirmation)}
            >
              {confirmRequest?.actionLabel || 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
