import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  AlertCircle,
  Camera,
  Copy,
  Download,
  KeyRound,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { browserSupportsWebAuthn, startRegistration } from '@simplewebauthn/browser';
import { GoogleLogin } from '@react-oauth/google';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Select } from '../components/ui/Select';
import { Avatar } from '../components/ui/Avatar';
import { PasswordGuidance } from '../components/auth/PasswordGuidance';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, type ThemePreference } from '../contexts/ThemeContext';
import api from '../lib/axios';

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

interface WorkspaceSummary {
  id: string;
  name: string;
  role: 'owner' | 'editor' | 'viewer';
  ownerId: string;
  memberCount: number;
  createdAt: string;
}

interface PendingInvite {
  id: string;
  inviteeEmail?: string | null;
  role: 'editor' | 'viewer';
  expiresAt: string;
  createdAt: string;
  inviter?: { id: string; name: string; email: string } | null;
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
  createdAt: string;
  expiresAt: string;
  absoluteExpiresAt?: string;
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
  acceptCookieBanners: boolean;
}

interface WorkspaceSettings {
  id: string;
  name: string;
  pageCount: number;
  crawlerDefaults: CrawlerDefaults;
  notificationDefaults: {
    minimumImportance: 'low' | 'medium' | 'high' | 'critical';
  };
}

interface CrawlerAuthSession {
  _id: string;
  name: string;
  origin: string;
  lastUsedAt?: string;
  createdAt: string;
}

interface NotificationPreferences {
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
  mode: 'password' | 'mfa' | 'google';
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

const avatarUploadMaxBytes = 4 * 1024 * 1024;
const avatarOutputSize = 512;
const allowedAvatarTypes = ['image/jpeg', 'image/png', 'image/webp'];

const defaultNotificationPreferences: NotificationPreferences = {
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
  acceptCookieBanners: true,
};

function roleLabel(role?: WorkspaceSummary['role'] | Member['role']) {
  if (!role) return 'Member';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function errorMessage(error: unknown, fallback: string) {
  const err = error as { response?: { data?: { error?: string; details?: string[] } } };
  return err.response?.data?.details?.[0] || err.response?.data?.error || fallback;
}

function errorCode(error: unknown) {
  const err = error as { response?: { data?: { code?: string } } };
  return err.response?.data?.code;
}

function canvasToDataUrl(canvas: HTMLCanvasElement) {
  const webp = canvas.toDataURL('image/webp', 0.86);
  if (webp.startsWith('data:image/webp')) return webp;
  return canvas.toDataURL('image/jpeg', 0.9);
}

async function prepareAvatar(file: File) {
  if (!allowedAvatarTypes.includes(file.type)) {
    throw new Error('Use a JPEG, PNG, or WebP image.');
  }

  if (file.size > avatarUploadMaxBytes) {
    throw new Error('Choose an image under 4 MB.');
  }

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();

  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This image could not be read.'));
      image.src = imageUrl;
    });

    const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
    if (!sourceSize) throw new Error('This image could not be read.');

    const sourceX = Math.round((image.naturalWidth - sourceSize) / 2);
    const sourceY = Math.round((image.naturalHeight - sourceSize) / 2);
    const canvas = document.createElement('canvas');
    canvas.width = avatarOutputSize;
    canvas.height = avatarOutputSize;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not process the image.');

    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, avatarOutputSize, avatarOutputSize);
    return canvasToDataUrl(canvas);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function isStepUpRequired(error: unknown) {
  const err = error as { response?: { status?: number; data?: { code?: string } } };
  return err.response?.status === 403 && ['STEP_UP_REQUIRED', 'MFA_STEP_UP_REQUIRED'].includes(err.response.data?.code || '');
}

function passkeyRegistrationErrorMessage(error: unknown) {
  const err = error as { name?: string; response?: { data?: { error?: string; details?: string[] } } };

  if (err.response) {
    return errorMessage(error, 'Passkey creation failed. Try again.');
  }

  switch (err.name) {
    case 'InvalidStateError':
      return 'This device may already have a passkey for this account.';
    case 'NotAllowedError':
      return 'Passkey creation was cancelled or timed out. Try again when you are ready.';
    case 'NotSupportedError':
      return 'This browser or device does not support passkey creation.';
    case 'SecurityError':
      return 'Passkeys require a secure connection and a matching site domain.';
    case 'AbortError':
      return 'Another passkey prompt is already in progress. Finish it or try again.';
    default:
      return 'Passkey creation failed. Try again.';
  }
}

function formatDate(value?: string) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function detectBrowser(userAgent = '') {
  if (/Edg\//.test(userAgent)) return 'Microsoft Edge';
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Safari\//.test(userAgent) && !/Chrome\//.test(userAgent)) return 'Safari';
  if (/OPR\//.test(userAgent)) return 'Opera';
  return 'Unknown browser';
}

function detectDevice(userAgent = '') {
  if (/iPhone|Android.*Mobile|Windows Phone/i.test(userAgent)) return 'Phone';
  if (/iPad|Tablet|Android/i.test(userAgent)) return 'Tablet';
  if (/Macintosh|Windows NT|Linux|CrOS/i.test(userAgent)) return 'Desktop';
  return 'Unknown device';
}

function detectOperatingSystem(userAgent = '') {
  if (/Windows NT/i.test(userAgent)) return 'Windows';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macOS';
  if (/iPhone|iPad/i.test(userAgent)) return 'iOS';
  if (/Android/i.test(userAgent)) return 'Android';
  if (/CrOS/i.test(userAgent)) return 'ChromeOS';
  if (/Linux/i.test(userAgent)) return 'Linux';
  return 'Unknown OS';
}

function sessionDisplayName(session: Session) {
  if (!session.userAgent) return session.current ? 'Current session' : 'Unknown session';
  const browser = detectBrowser(session.userAgent);
  const device = detectDevice(session.userAgent);
  return `${browser} on ${device}`;
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
  const { user, activeWorkspaceId, setActiveWorkspaceId, updateUser, logout } = useAuth();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(user?.avatarUrl || null);
  const [avatarError, setAvatarError] = useState('');
  const [isProcessingAvatar, setIsProcessingAvatar] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings | null>(null);
  const [isLoadingWorkspaceSettings, setIsLoadingWorkspaceSettings] = useState(false);
  const [workspaceSettingsError, setWorkspaceSettingsError] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteToken, setInviteToken] = useState('');
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsError, setSessionsError] = useState('');
  const [passkeys, setPasskeys] = useState<Passkey[]>([]);
  const [mfaEnabled, setMfaEnabled] = useState(Boolean(user?.mfaEnabled));
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [auditAction, setAuditAction] = useState('');
  const [auditActor, setAuditActor] = useState('');
  const [transferOwnerId, setTransferOwnerId] = useState('');
  const [crawlerSessions, setCrawlerSessions] = useState<CrawlerAuthSession[]>([]);
  const [passkeyName, setPasskeyName] = useState('');
  const [isPasskeyModalOpen, setIsPasskeyModalOpen] = useState(false);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);
  const [passkeyError, setPasskeyError] = useState('');
  const [renamePasskeyState, setRenamePasskeyState] = useState<{ id: string; name: string } | null>(null);
  const [isRenamingPasskey, setIsRenamingPasskey] = useState(false);
  const [stepUpRequest, setStepUpRequest] = useState<StepUpRequest | null>(null);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [workspaceAction, setWorkspaceAction] = useState<'save' | 'transfer' | 'delete' | 'member' | 'invite' | null>(null);

  const activeWorkspace = useMemo(() => {
    return workspaces.find(workspace => workspace.id === activeWorkspaceId) || null;
  }, [activeWorkspaceId, workspaces]);
  const isOwner = useMemo(() => {
    return user?.role === 'admin' || members.some(member => member.id === user?.id && member.role === 'owner');
  }, [members, user?.id, user?.role]);
  const hasOtherSessions = useMemo(() => sessions.some(session => !session.current), [sessions]);
  const activeOwnerCount = useMemo(() => members.filter(member => member.role === 'owner').length, [members]);

  useEffect(() => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setProfileAvatarUrl(user?.avatarUrl || null);
    setMfaEnabled(Boolean(user?.mfaEnabled));
  }, [user]);

  const fetchWorkspaces = useCallback(async (preferredWorkspaceId?: string | null) => {
    try {
      const res = await api.get('/workspaces');
      const data: WorkspaceSummary[] = res.data || [];
      setWorkspaces(data);

      const nextWorkspaceId =
        (preferredWorkspaceId && data.some(workspace => workspace.id === preferredWorkspaceId) && preferredWorkspaceId) ||
        (activeWorkspaceId && data.some(workspace => workspace.id === activeWorkspaceId) && activeWorkspaceId) ||
        data[0]?.id ||
        null;

      if (nextWorkspaceId !== activeWorkspaceId) {
        setActiveWorkspaceId(nextWorkspaceId);
      }

      return data;
    } catch {
      setWorkspaces([]);
      return [];
    }
  }, [activeWorkspaceId, setActiveWorkspaceId]);

  const fetchMembers = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/members`);
      setMembers(res.data || []);
    } catch {
      setMembers([]);
    }
  }, [activeWorkspaceId]);

  const fetchInvites = useCallback(async () => {
    if (!activeWorkspaceId) return;
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/invites`);
      setPendingInvites(res.data || []);
    } catch {
      setPendingInvites([]);
    }
  }, [activeWorkspaceId]);

  const fetchWorkspaceSettings = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoadingWorkspaceSettings(true);
    setWorkspaceSettingsError('');
    try {
      const res = await api.get(`/workspaces/${activeWorkspaceId}/settings`);
      setWorkspaceSettings({
        ...res.data,
        crawlerDefaults: res.data.crawlerDefaults || defaultCrawlerDefaults,
        notificationDefaults: res.data.notificationDefaults || { minimumImportance: 'medium' },
      });
    } catch (error) {
      const message = errorMessage(error, 'Failed to load workspace settings');
      setWorkspaceSettingsError(message);
      setWorkspaceSettings(null);
      toast.error(message);
    } finally {
      setIsLoadingWorkspaceSettings(false);
    }
  }, [activeWorkspaceId]);

  const fetchPreferences = useCallback(async () => {
    try {
      const res = await api.get('/users/me/preferences');
      setNotificationPreferences({ ...defaultNotificationPreferences, ...(res.data.emailPreferences || {}) });
    } catch {
      // Preferences are non-critical for first paint.
    }
  }, []);

  const fetchSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    setSessionsError('');
    try {
      const res = await api.get('/users/me/sessions');
      setSessions(res.data || []);
    } catch (error) {
      setSessions([]);
      setSessionsError(errorMessage(error, 'Could not load active sessions.'));
    } finally {
      setIsLoadingSessions(false);
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

  const fetchCrawlerSessions = useCallback(async () => {
    try {
      const res = await api.get('/pages/auth-sessions');
      setCrawlerSessions(res.data || []);
    } catch {
      setCrawlerSessions([]);
    }
  }, []);

  useEffect(() => {
    fetchWorkspaces();
    fetchPreferences();
    fetchSessions();
    fetchPasskeys();
    fetchCrawlerSessions();
  }, [fetchCrawlerSessions, fetchPasskeys, fetchPreferences, fetchSessions, fetchWorkspaces]);

  useEffect(() => {
    setMembers([]);
    setPendingInvites([]);
    setWorkspaceSettings(null);
    setWorkspaceSettingsError('');
    setTransferOwnerId('');
    setInviteToken('');
    setInviteEmailError('');

    if (!activeWorkspaceId) {
      setIsLoadingWorkspaceSettings(false);
      return;
    }

    fetchMembers();
    fetchInvites();
    fetchWorkspaceSettings();
    fetchAuditLogs(1);
  }, [activeWorkspaceId, fetchAuditLogs, fetchInvites, fetchMembers, fetchWorkspaceSettings]);

  const requestStepUp = useCallback((options: { requireMfa?: boolean; reason: string }) => {
    const mustUseMfa = options.requireMfa || mfaEnabled || user?.role === 'admin';
    if (mustUseMfa && !mfaEnabled) {
      toast.error('Enable two-factor authentication before performing this action.');
      return Promise.reject(new Error('MFA required'));
    }

    const mode: StepUpRequest['mode'] = mustUseMfa
      ? 'mfa'
      : user?.authMethods?.password
        ? 'password'
        : user?.authMethods?.google
          ? 'google'
          : 'password';

    if (mode === 'password' && user?.authMethods && !user.authMethods.password) {
      toast.error('Add a password, Google sign-in, or MFA before performing sensitive actions.');
      return Promise.reject(new Error('Step-up unavailable'));
    }

    return new Promise<void>((resolve, reject) => {
      setStepUpRequest({
        mode,
        reason: options.reason,
        value: '',
        isSubmitting: false,
        resolve,
        reject,
      });
    });
  }, [mfaEnabled, user?.authMethods, user?.role]);

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

  const submitGoogleStepUp = async (credential?: string) => {
    if (!stepUpRequest || !credential) {
      toast.error('Google re-authentication failed');
      return;
    }

    setStepUpRequest({ ...stepUpRequest, isSubmitting: true });
    try {
      await api.post('/auth/step-up', { googleToken: credential });
      stepUpRequest.resolve();
      setStepUpRequest(null);
    } catch (error) {
      toast.error(errorMessage(error, 'Google re-authentication failed'));
      setStepUpRequest({ ...stepUpRequest, isSubmitting: false });
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
      const payload: { name: string; email: string; avatarUrl?: string | null } = {
        name: profileName,
        email: profileEmail,
      };
      if (profileAvatarUrl !== (user?.avatarUrl || null)) {
        payload.avatarUrl = profileAvatarUrl;
      }

      const res = await api.patch('/users/me', payload);
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

  const chooseAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setAvatarError('');
    setIsProcessingAvatar(true);
    try {
      const dataUrl = await prepareAvatar(file);
      setProfileAvatarUrl(dataUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare profile picture.';
      setAvatarError(message);
      toast.error(message);
    } finally {
      setIsProcessingAvatar(false);
      event.target.value = '';
    }
  };

  const saveWorkspaceSettings = async () => {
    if (!activeWorkspaceId || !workspaceSettings) return;
    setIsSaving(true);
    setWorkspaceAction('save');
    try {
      await requestStepUp({ reason: 'Update workspace crawler and notification policy' });
      const res = await api.patch(`/workspaces/${activeWorkspaceId}/settings`, {
        name: workspaceSettings.name,
        crawlerDefaults: workspaceSettings.crawlerDefaults,
        notificationDefaults: workspaceSettings.notificationDefaults,
      });
      setWorkspaceSettings({ ...workspaceSettings, ...res.data });
      setWorkspaces(current => current.map(workspace => (
        workspace.id === activeWorkspaceId ? { ...workspace, name: res.data.name || workspace.name } : workspace
      )));
      toast.success('Workspace settings saved');
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to save workspace settings'));
      }
    } finally {
      setIsSaving(false);
      setWorkspaceAction(null);
    }
  };

  const savePreferences = async () => {
    try {
      const res = await api.patch('/users/me/preferences', notificationPreferences);
      setNotificationPreferences({ ...defaultNotificationPreferences, ...(res.data.emailPreferences || {}) });
      toast.success('Notification preferences saved');
    } catch (error) {
      toast.error(errorMessage(error, 'Failed to save preferences'));
    }
  };

  const changePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast.error("New passwords don't match");
      return;
    }

    setIsChangingPassword(true);
    try {
      if (mfaEnabled) {
        await requestStepUp({ requireMfa: true, reason: 'Change your password' });
      }
      await api.post('/users/me/password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      toast.success('Password changed. Other sessions were revoked and this session was refreshed.');
      fetchSessions();
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to change password'));
      }
    } finally {
      setIsChangingPassword(false);
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

  const openPasskeyModal = () => {
    setPasskeyError('');
    setIsPasskeyModalOpen(true);
  };

  const closePasskeyModal = () => {
    if (isAddingPasskey) return;
    setPasskeyError('');
    setIsPasskeyModalOpen(false);
  };

  const addPasskey = async () => {
    if (isAddingPasskey) return;

    if (!browserSupportsWebAuthn()) {
      const message = 'This browser or device does not support passkey creation.';
      setPasskeyError(message);
      toast.error(message);
      return;
    }

    setIsAddingPasskey(true);
    setPasskeyError('');

    try {
      const optionsRes = await api.post('/auth/passkeys/register/options');
      setIsPasskeyModalOpen(false);
      toast.loading('Follow your browser or device prompt to create the passkey.', { id: 'passkey-registration' });
      const credential = await startRegistration({ optionsJSON: optionsRes.data } as any);
      toast.loading('Saving passkey...', { id: 'passkey-registration' });
      await api.post('/auth/passkeys/register/verify', { credential, name: passkeyName.trim() || 'Passkey' });
      setPasskeyName('');
      setIsPasskeyModalOpen(false);
      toast.success('Passkey added', { id: 'passkey-registration' });
      fetchPasskeys();
    } catch (error) {
      toast.dismiss('passkey-registration');

      if (isStepUpRequired(error)) {
        setIsPasskeyModalOpen(false);
        try {
          await requestStepUp({ reason: 'Add a passkey' });
          setIsPasskeyModalOpen(true);
          toast.success('Verified. Create the passkey to continue.');
        } catch (stepUpError) {
          if ((stepUpError as Error).message !== 'Step-up cancelled') {
            toast.error(errorMessage(stepUpError, 'Verification failed'));
          }
        }
        return;
      }

      const message = passkeyRegistrationErrorMessage(error);
      setPasskeyError(message);
      setIsPasskeyModalOpen(true);
      toast.error(message);
    } finally {
      setIsAddingPasskey(false);
    }
  };

  const renamePasskey = async () => {
    if (!renamePasskeyState || isRenamingPasskey) return;
    const passkeyToRename = {
      ...renamePasskeyState,
      name: renamePasskeyState.name.trim(),
    };
    setIsRenamingPasskey(true);
    setRenamePasskeyState(null);
    try {
      await requestStepUp({ reason: 'Rename passkey' });
      await api.patch(`/users/me/passkeys/${passkeyToRename.id}`, { name: passkeyToRename.name });
      toast.success('Passkey renamed');
      fetchPasskeys();
    } catch (error) {
      setRenamePasskeyState(passkeyToRename);
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to rename passkey'));
      }
    } finally {
      setIsRenamingPasskey(false);
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
    title: session.current ? 'Sign out current session' : 'Sign out session',
    description: session.current
      ? 'You will be signed out on this device.'
      : `${sessionDisplayName(session)} will need to sign in again before it can access Deltaora.`,
    actionLabel: session.current ? 'Sign out this session' : 'Sign out session',
    onConfirm: async () => {
      await requestStepUp({ reason: session.current ? 'Sign out current session' : 'Sign out another session' });
      await api.delete(`/users/me/sessions/${session.id}`);
      toast.success(session.current ? 'Signed out this session' : 'Session signed out');
      session.current ? logout() : fetchSessions();
    },
  });

  const revokeOtherSessions = () => askConfirm({
    title: 'Sign out all other sessions',
    description: 'Every other browser and device will need to sign in again. This session will stay active.',
    actionLabel: 'Sign out other sessions',
    onConfirm: async () => {
      await requestStepUp({ reason: 'Sign out other sessions' });
      await api.delete('/users/me/sessions/others');
      toast.success('Other sessions signed out');
      fetchSessions();
    },
  });

  const generateInvite = async () => {
    if (!activeWorkspaceId) return;
    setWorkspaceAction('invite');
    setInviteEmailError('');
    setInviteToken('');
    try {
      await requestStepUp({ reason: 'Invite a workspace member' });
      const payload = { role: inviteRole, ...(inviteEmail.trim() ? { email: inviteEmail.trim() } : {}) };
      const res = await api.post(`/workspaces/${activeWorkspaceId}/invites`, payload);
      setInviteToken(res.data.inviteToken);
      if (res.data.emailSent) setInviteEmail('');
      toast.success(res.data.emailSent ? 'Invite email sent' : 'Invite link generated');
      fetchInvites();
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        const message = errorMessage(error, 'Failed to generate invite');
        if (errorCode(error) === 'WORKSPACE_MEMBER_EXISTS') {
          setInviteEmailError(message);
        } else {
          toast.error(message);
        }
      }
    } finally {
      setWorkspaceAction(null);
    }
  };

  const transferWorkspaceOwnership = async () => {
    if (!activeWorkspaceId || !transferOwnerId) return;
    setWorkspaceAction('transfer');
    try {
      await requestStepUp({ reason: 'Transfer workspace ownership' });
      await api.post(`/workspaces/${activeWorkspaceId}/transfer-ownership`, { userId: transferOwnerId });
      toast.success('Ownership transferred');
      setTransferOwnerId('');
      fetchMembers();
      fetchWorkspaces(activeWorkspaceId);
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to transfer ownership'));
      }
    } finally {
      setWorkspaceAction(null);
    }
  };


  const revokeInvite = (invite: PendingInvite) => askConfirm({
    title: 'Revoke invite',
    description: invite.inviteeEmail ? `${invite.inviteeEmail} will no longer be able to join with this invite.` : 'This invite link will stop working immediately.',
    actionLabel: 'Revoke invite',
    onConfirm: async () => {
      if (!activeWorkspaceId) return;
      await requestStepUp({ reason: 'Revoke workspace invite' });
      await api.delete(`/workspaces/${activeWorkspaceId}/invites/${invite.id}`);
      setPendingInvites(current => current.filter(item => item.id !== invite.id));
      toast.success('Invite revoked');
    },
  });

  const resendInvite = async (invite: PendingInvite) => {
    if (!activeWorkspaceId) return;
    try {
      await requestStepUp({ reason: 'Resend workspace invite' });
      await api.post(`/workspaces/${activeWorkspaceId}/invites/${invite.id}/resend`);
      toast.success('Invite resent');
      fetchInvites();
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to resend invite'));
      }
    }
  };

  const updateRole = async (memberId: string, role: string) => {
    if (!activeWorkspaceId) return;
    setWorkspaceAction('member');
    try {
      await requestStepUp({ reason: 'Change a member role' });
      await api.patch(`/workspaces/${activeWorkspaceId}/members/${memberId}`, { role });
      toast.success('Role updated');
      fetchMembers();
      fetchWorkspaces(activeWorkspaceId);
    } catch (error) {
      if ((error as Error).message !== 'Step-up cancelled') {
        toast.error(errorMessage(error, 'Failed to update role'));
      }
    } finally {
      setWorkspaceAction(null);
    }
  };

  const removeMember = (member: Member) => askConfirm({
    title: member.id === user?.id ? 'Leave workspace' : 'Remove member',
    description: member.id === user?.id ? 'You will lose access to this workspace.' : `${member.email} will lose access to this workspace.`,
    actionLabel: member.id === user?.id ? 'Leave workspace' : 'Remove member',
    onConfirm: async () => {
      if (!activeWorkspaceId) return;
      setWorkspaceAction('member');
      try {
        await requestStepUp({ reason: 'Remove a workspace member' });
        await api.delete(`/workspaces/${activeWorkspaceId}/members/${member.id}`);
        toast.success(member.id === user?.id ? 'You left the workspace' : 'Member removed');
        if (member.id === user?.id) {
          const nextWorkspaceId = workspaces.find(workspace => workspace.id !== activeWorkspaceId)?.id || null;
          setActiveWorkspaceId(nextWorkspaceId);
          await fetchWorkspaces(nextWorkspaceId);
        } else {
          fetchMembers();
          fetchWorkspaces(activeWorkspaceId);
        }
      } finally {
        setWorkspaceAction(null);
      }
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

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-950 dark:text-white">Settings</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage account security, workspace governance, and crawler compliance.
          </p>
        </div>
        <div className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {workspaceSettings ? `${workspaceSettings.pageCount} monitored pages` : 'Workspace loading'}
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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex items-center gap-4 sm:w-64 sm:flex-col sm:items-start">
                <Avatar name={profileName || user?.name} src={profileAvatarUrl} size="xl" />
                <div className="flex flex-wrap gap-2">
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={chooseAvatar}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    isLoading={isProcessingAvatar}
                  >
                    <Camera className="mr-2 h-4 w-4" /> Change
                  </Button>
                  {profileAvatarUrl && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setProfileAvatarUrl(null)}>
                      <X className="mr-2 h-4 w-4" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs leading-5 text-gray-500 dark:text-gray-400">
                  Square JPEG, PNG, or WebP. Large images are resized before upload.
                </p>
                {avatarError && <p className="text-xs font-medium text-red-500">{avatarError}</p>}
              </div>
              <div className="grid flex-1 gap-4 sm:grid-cols-2">
                <Input label="Name" value={profileName} onChange={event => setProfileName(event.target.value)} />
                <div className="space-y-1.5">
                  <Input label="Email" type="email" value={profileEmail} onChange={event => setProfileEmail(event.target.value)} />
                  {user?.isEmailVerified ? (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400">
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                      </svg>
                      Verified
                    </p>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                        </svg>
                        Not verified - check your inbox
                      </p>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await api.post('/auth/send-verification');
                            toast.success('Verification email sent');
                          } catch {
                            toast.error('Failed to send verification email');
                          }
                        }}
                        className="shrink-0 text-xs font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Resend
                      </button>
                    </div>
                  )}
                  {profileEmail !== user?.email && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Changing your email will require re-verification.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={saveProfile} isLoading={isSaving} disabled={!profileName.trim() || !profileEmail.trim() || isProcessingAvatar}>
                Save profile
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Workspace" description="Manage workspace access, ownership, and defaults for newly monitored websites.">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <p className="sr-only" aria-live="polite">
              {activeWorkspace ? `${activeWorkspace.name} workspace selected.` : 'No workspace selected.'}
            </p>

            {(workspaceSettings || isLoadingWorkspaceSettings || workspaceSettingsError) && (
              <div className="grid gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:grid-cols-3">
                <div>
                  <div className="text-xs uppercase text-gray-500">Members</div>
                  <div className="mt-1 font-semibold text-gray-950 dark:text-white">{isLoadingWorkspaceSettings ? 'Loading' : members.length}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">Monitored pages</div>
                  <div className="mt-1 font-semibold text-gray-950 dark:text-white">{workspaceSettings?.pageCount ?? (isLoadingWorkspaceSettings ? 'Loading' : 'Unavailable')}</div>
                </div>
                <div>
                  <div className="text-xs uppercase text-gray-500">Your role</div>
                  <div className="mt-1 font-semibold text-gray-950 dark:text-white">{roleLabel(activeWorkspace?.role)}</div>
                </div>
              </div>
            )}

            {workspaceSettingsError && (
              <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{workspaceSettingsError}</span>
                </div>
                <Button variant="outline" onClick={fetchWorkspaceSettings}>Retry</Button>
              </div>
            )}

            <Input
              label="Workspace name"
              value={workspaceSettings?.name || ''}
              disabled={!workspaceSettings || !isOwner}
              error={workspaceSettings && workspaceSettings.name.trim().length < 2 ? 'Use at least 2 characters.' : undefined}
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
            <SettingRow title="Accept cookie banners" description="Crawler automatically clicks 'Accept' on GDPR/cookie consent banners before capturing page content. Disable for sites where auto-clicking causes issues.">
              <Switch
                checked={workspaceSettings?.crawlerDefaults.acceptCookieBanners ?? true}
                disabled={!workspaceSettings || !isOwner}
                label="Accept cookie banners"
                onChange={checked => workspaceSettings && setWorkspaceSettings({
                  ...workspaceSettings,
                  crawlerDefaults: { ...workspaceSettings.crawlerDefaults, acceptCookieBanners: checked },
                })}
              />
            </SettingRow>
            <SettingRow title="Default alert importance for new monitors" description="Set the workspace-level alert floor applied to newly monitored pages.">
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
              <Button
                onClick={saveWorkspaceSettings}
                isLoading={isSaving && workspaceAction === 'save'}
                disabled={!workspaceSettings || !isOwner || workspaceSettings.name.trim().length < 2}
              >
                Save workspace policy
              </Button>
            </div>
            <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <Select
                  label="Primary owner"
                  value={transferOwnerId}
                  onChange={event => setTransferOwnerId(event.target.value)}
                  options={[
                    { label: 'Select a member', value: '' },
                    ...members
                      .filter(member => member.id !== user?.id)
                      .map(member => ({ label: `${member.name} (${member.email})`, value: member.id })),
                  ]}
                  disabled={!isOwner || members.length <= 1}
                />
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={transferWorkspaceOwnership}
                    isLoading={workspaceAction === 'transfer'}
                    disabled={!isOwner || !transferOwnerId}
                  >
                    Transfer ownership
                  </Button>
                </div>
              </div>
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
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={member.name} src={member.avatarUrl} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-950 dark:text-white">{member.name}</div>
                      <div className="truncate text-sm text-gray-500">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      aria-label={`Role for ${member.email}`}
                      className="min-w-32"
                      value={member.role}
                      disabled={!isOwner || workspaceAction === 'member' || (member.role === 'owner' && activeOwnerCount <= 1)}
                      onChange={event => updateRole(member.id, event.target.value)}
                      options={roleOptions}
                    />
                    <Button
                      variant="outline"
                      onClick={() => removeMember(member)}
                      isLoading={workspaceAction === 'member'}
                      disabled={
                        workspaceAction === 'member' ||
                        (member.id === user?.id
                          ? workspaces.length <= 1 || (member.role === 'owner' && activeOwnerCount <= 1)
                          : !isOwner || (member.role === 'owner' && activeOwnerCount <= 1))
                      }
                    >
                      {member.id === user?.id ? 'Leave' : 'Remove'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="grid gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:grid-cols-[1fr_160px_auto]">
              <Input
                label="Invite email"
                type="email"
                autoComplete="email"
                placeholder="teammate@example.com"
                value={inviteEmail}
                error={inviteEmailError}
                onChange={event => {
                  setInviteEmail(event.target.value);
                  setInviteEmailError('');
                }}
              />
              <Select label="Role" value={inviteRole} onChange={event => setInviteRole(event.target.value as 'editor' | 'viewer')} options={roleOptions.filter(option => option.value !== 'owner')} />
              <div className="flex items-end">
                <Button onClick={generateInvite} isLoading={workspaceAction === 'invite'} disabled={!isOwner}>Invite</Button>
              </div>
            </div>
            <div role="status" aria-live="polite" className="text-sm text-gray-500 dark:text-gray-400">
              {inviteEmailError
                ? 'No invitation was sent because this person already has access.'
                : 'Email invites are checked against current workspace members before delivery.'}
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
            <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
              <div className="mb-3 font-medium text-gray-950 dark:text-white">Pending invites</div>
              <div className="space-y-2">
                {pendingInvites.map(invite => (
                  <div key={invite.id} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-gray-950 dark:text-white">{invite.inviteeEmail || 'Invite link'}</div>
                      <div className="text-sm text-gray-500">{invite.role} / Expires {formatDate(invite.expiresAt)}</div>
                    </div>
                    <div className="flex gap-2">
                      {invite.inviteeEmail && (
                        <Button variant="outline" disabled={!isOwner} onClick={() => resendInvite(invite)}>Resend</Button>
                      )}
                      <Button variant="outline" disabled={!isOwner} onClick={() => revokeInvite(invite)}>Revoke</Button>
                    </div>
                  </div>
                ))}
                {pendingInvites.length === 0 && <p className="text-sm text-gray-500">No pending invites.</p>}
              </div>
            </div>
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
              <Input
                label="Current password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={event => setCurrentPassword(event.target.value)}
              />
              <Input
                label="New password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={event => setNewPassword(event.target.value)}
              />
              <Input
                label="Confirm new password"
                type="password"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={event => setConfirmNewPassword(event.target.value)}
                error={confirmNewPassword && newPassword !== confirmNewPassword ? "Passwords don't match" : undefined}
              />
              <div className="self-end text-sm text-gray-500 dark:text-gray-400">
                {mfaEnabled ? 'MFA verification is required before the password is changed.' : 'Other active sessions will be signed out after the change.'}
              </div>
              <div className="sm:col-span-2">
                <PasswordGuidance password={newPassword} email={user?.email} name={user?.name} />
              </div>
              <div className="sm:col-span-2">
                <Button
                  onClick={changePassword}
                  isLoading={isChangingPassword}
                  disabled={!currentPassword || newPassword.length < 15 || newPassword !== confirmNewPassword}
                >
                  Change password
                </Button>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-5 dark:border-gray-800">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-950 dark:text-white">Passkeys</div>
                  <p className="text-sm text-gray-500">Use device-bound or synced passkeys where supported.</p>
                </div>
                <Button variant="outline" onClick={openPasskeyModal}>
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
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium text-gray-950 dark:text-white">Sessions and devices</div>
                  <p className="text-sm text-gray-500">Review active browsers, sign-in times, and remote access.</p>
                </div>
                <Button
                  variant="outline"
                  disabled={!hasOtherSessions || isLoadingSessions}
                  onClick={revokeOtherSessions}
                >
                  Sign out other sessions
                </Button>
              </div>
              <div className="space-y-2">
                {isLoadingSessions && <p className="text-sm text-gray-500">Loading active sessions...</p>}
                {!isLoadingSessions && sessionsError && (
                  <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
                    <span>{sessionsError}</span>
                    <Button variant="outline" onClick={fetchSessions}>Retry</Button>
                  </div>
                )}
                {!isLoadingSessions && !sessionsError && sessions.length === 0 && (
                  <p className="rounded-md border border-gray-200 p-3 text-sm text-gray-500 dark:border-gray-800">No active sessions found.</p>
                )}
                {!isLoadingSessions && !sessionsError && sessions.map(session => {
                  const browser = detectBrowser(session.userAgent);
                  const device = detectDevice(session.userAgent);
                  const operatingSystem = detectOperatingSystem(session.userAgent);

                  return (
                    <div key={session.id} className="flex flex-col gap-3 rounded-md border border-gray-200 p-3 dark:border-gray-800 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-gray-950 dark:text-white">{browser} on {device}</div>
                          {session.current && (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                              Current session
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-gray-500">{operatingSystem} / {session.ipAddress || 'Unknown IP address'}</div>
                        <dl className="mt-3 grid gap-2 text-xs text-gray-500 sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <dt className="font-medium uppercase tracking-wide text-gray-400">Signed in</dt>
                            <dd className="mt-0.5">{formatDate(session.createdAt)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium uppercase tracking-wide text-gray-400">Last active</dt>
                            <dd className="mt-0.5">{formatDate(session.lastSeenAt)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium uppercase tracking-wide text-gray-400">Idle expires</dt>
                            <dd className="mt-0.5">{formatDate(session.expiresAt)}</dd>
                          </div>
                          <div>
                            <dt className="font-medium uppercase tracking-wide text-gray-400">Max expires</dt>
                            <dd className="mt-0.5">{formatDate(session.absoluteExpiresAt)}</dd>
                          </div>
                        </dl>
                      </div>
                      <Button
                        variant="outline"
                        className="shrink-0"
                        aria-label={session.current ? 'Sign out current session' : `Sign out ${browser} session`}
                        onClick={() => revokeSession(session)}
                      >
                        {session.current ? 'Sign out this session' : 'Sign out'}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </Section>

      <Section title="Notification preferences" description="Control how monitoring alerts and product emails reach your account.">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <fieldset className="space-y-1">
              <legend className="text-sm font-semibold text-gray-950 dark:text-white">Alert channels</legend>
              <p className="text-sm leading-5 text-gray-500 dark:text-gray-400">Choose where monitoring alerts are delivered.</p>
              <SettingRow title="Email alerts" description="Send monitoring alerts to your account email address.">
                <Switch
                  checked={notificationPreferences.notifications}
                  label="Email alerts"
                  onChange={checked => setNotificationPreferences({ ...notificationPreferences, notifications: checked })}
                />
              </SettingRow>
              <SettingRow title="In-app alerts" description="Show monitoring alerts in the Deltaora notifications inbox.">
                <Switch
                  checked={notificationPreferences.inApp}
                  label="In-app alerts"
                  onChange={checked => setNotificationPreferences({ ...notificationPreferences, inApp: checked })}
                />
              </SettingRow>
            </fieldset>

            <fieldset className="space-y-1 border-t border-gray-100 pt-5 dark:border-gray-800">
              <legend className="text-sm font-semibold text-gray-950 dark:text-white">Alert rules</legend>
              <p className="text-sm leading-5 text-gray-500 dark:text-gray-400">Filter account-level alert volume without changing workspace defaults.</p>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <Select
                  id="notification-minimum-importance"
                  label="Minimum alert importance to notify me"
                  value={notificationPreferences.minimumImportance}
                  options={importanceOptions}
                  onChange={event => setNotificationPreferences({
                    ...notificationPreferences,
                    minimumImportance: event.target.value as NotificationPreferences['minimumImportance'],
                  })}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-1 border-t border-gray-100 pt-5 dark:border-gray-800">
              <legend className="text-sm font-semibold text-gray-950 dark:text-white">Email delivery schedule</legend>
              <p className="text-sm leading-5 text-gray-500 dark:text-gray-400">Set email frequency and quiet-hour timing for non-critical monitoring alerts.</p>
              <div className="grid gap-4 py-4 sm:grid-cols-2">
                <Select
                  id="notification-email-frequency"
                  label="Email alert frequency"
                  value={notificationPreferences.digestFrequency}
                  options={digestOptions}
                  disabled={!notificationPreferences.notifications}
                  onChange={event => setNotificationPreferences({
                    ...notificationPreferences,
                    digestFrequency: event.target.value as NotificationPreferences['digestFrequency'],
                  })}
                />
                <Input
                  id="notification-quiet-hours-start"
                  label="Quiet hours start"
                  type="time"
                  value={notificationPreferences.quietHoursStart || ''}
                  onChange={event => setNotificationPreferences({ ...notificationPreferences, quietHoursStart: event.target.value })}
                />
                <Input
                  id="notification-quiet-hours-end"
                  label="Quiet hours end"
                  type="time"
                  value={notificationPreferences.quietHoursEnd || ''}
                  onChange={event => setNotificationPreferences({ ...notificationPreferences, quietHoursEnd: event.target.value })}
                />
                <Input
                  id="notification-time-zone"
                  label="Quiet hours time zone"
                  value={notificationPreferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || ''}
                  onChange={event => setNotificationPreferences({ ...notificationPreferences, timezone: event.target.value })}
                />
              </div>
            </fieldset>

            <fieldset className="space-y-1 border-t border-gray-100 pt-5 dark:border-gray-800">
              <legend className="text-sm font-semibold text-gray-950 dark:text-white">Product communications</legend>
              <SettingRow title="Product updates and marketing emails" description="Receive occasional feature news, launch notes, and offers.">
                <Switch
                  checked={notificationPreferences.marketing}
                  label="Product updates and marketing emails"
                  onChange={checked => setNotificationPreferences({ ...notificationPreferences, marketing: checked })}
                />
              </SettingRow>
            </fieldset>

            <div className="flex justify-end">
              <Button onClick={savePreferences}>Save notification preferences</Button>
            </div>
          </CardContent>
        </Card>
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
              <Input label="Action filter" value={auditAction} placeholder="member, workspace, auth" onChange={event => setAuditAction(event.target.value)} />
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
          {stepUpRequest?.mode === 'google' ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Continue with the same Google account to verify this sensitive action.
              </p>
              <div className={stepUpRequest.isSubmitting ? 'pointer-events-none opacity-60' : ''}>
                <GoogleLogin
                  onSuccess={credentialResponse => submitGoogleStepUp(credentialResponse.credential)}
                  onError={() => toast.error('Google re-authentication failed')}
                  theme="filled_blue"
                  shape="rectangular"
                  width="100%"
                  context="use"
                  ux_mode="popup"
                />
              </div>
            </>
          ) : (
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
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closeStepUp}>Cancel</Button>
            {stepUpRequest?.mode !== 'google' && (
              <Button onClick={submitStepUp} isLoading={stepUpRequest?.isSubmitting}>Continue</Button>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isPasskeyModalOpen}
        onClose={closePasskeyModal}
        title="Add passkey"
        description="Create a passkey with your browser, device, or password manager."
      >
        <div className="space-y-4">
          <Input
            label="Passkey name"
            value={passkeyName}
            onChange={event => {
              setPasskeyName(event.target.value);
              setPasskeyError('');
            }}
            onKeyDown={event => {
              if (event.key === 'Enter') addPasskey();
            }}
            placeholder="Work laptop"
            maxLength={80}
            error={passkeyError}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={closePasskeyModal} disabled={isAddingPasskey}>Cancel</Button>
            <Button onClick={addPasskey} isLoading={isAddingPasskey}>Create passkey</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(renamePasskeyState)} onClose={() => setRenamePasskeyState(null)} title="Rename passkey">
        <div className="space-y-4">
          <Input label="Name" value={renamePasskeyState?.name || ''} onChange={event => renamePasskeyState && setRenamePasskeyState({ ...renamePasskeyState, name: event.target.value })} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenamePasskeyState(null)} disabled={isRenamingPasskey}>Cancel</Button>
            <Button onClick={renamePasskey} disabled={!renamePasskeyState?.name.trim()} isLoading={isRenamingPasskey}>Save</Button>
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
