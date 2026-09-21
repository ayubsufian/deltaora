import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Globe, LayoutDashboard, LogOut, Pencil, Plus, Settings, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import api from '../../lib/axios';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

interface WorkspaceSummary {
  id: string;
  name: string;
  emoji?: string;
  role: 'owner' | 'editor' | 'viewer';
  memberCount: number;
}

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
}

const secondaryNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: BarChart3, label: 'Statistics', to: '/statistics' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

const navBaseClass = (isCollapsed: boolean) =>
  `group flex min-h-11 w-full items-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${
    isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
  }`;

const navStateClass = (isActive: boolean) =>
  isActive
    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white';

export function Sidebar({ isCollapsed, onToggleCollapsed }: SidebarProps) {
  const { user, logout, activeWorkspaceId, setActiveWorkspaceId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceEmoji, setNewWorkspaceEmoji] = useState('📗');
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [createError, setCreateError] = useState('');
  const emojiButtonRef = useRef<HTMLButtonElement>(null);
  const [pickerStyle, setPickerStyle] = useState<React.CSSProperties>({});
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [renamingWorkspace, setRenamingWorkspace] = useState<WorkspaceSummary | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameEmoji, setRenameEmoji] = useState('📗');
  const [renameError, setRenameError] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);
  const renameEmojiButtonRef = useRef<HTMLButtonElement>(null);
  // Tracks which modal's emoji button triggered the picker
  const [emojiPickerTarget, setEmojiPickerTarget] = useState<'create' | 'rename'>('create');
  // Delete workspace modal
  const [deletingWorkspace, setDeletingWorkspace] = useState<WorkspaceSummary | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isAllPagesActive = location.pathname === '/pages' && searchParams.get('scope') === 'all';

  const fetchWorkspaces = async () => {
    const res = await api.get('/workspaces');
    setWorkspaces(res.data || []);
    return (res.data || []) as WorkspaceSummary[];
  };

  useEffect(() => {
    let isMounted = true;

    const loadWorkspaces = async () => {
      try {
        const res = await api.get('/workspaces');
        if (isMounted) setWorkspaces(res.data || []);
      } catch {
        if (isMounted) setWorkspaces([]);
      }
    };

    loadWorkspaces();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isCreateModalOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeCreateModal();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isCreateModalOpen, isCreatingWorkspace]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const handleWorkspaceClick = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
  };

  const openCreateModal = () => {
    const nextNumber = workspaces.length + 1;
    setNewWorkspaceName(`Workspace ${nextNumber}`);
    setNewWorkspaceEmoji('📗');
    setIsEmojiPickerOpen(false);
    setCreateError('');
    setIsCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (isCreatingWorkspace) return;
    setIsCreateModalOpen(false);
    setIsEmojiPickerOpen(false);
    setCreateError('');
  };

  const openRenameModal = (workspace: WorkspaceSummary) => {
    setRenamingWorkspace(workspace);
    setRenameValue(workspace.name);
    setRenameEmoji(workspace.emoji || '📗');
    setRenameError('');
    setIsEmojiPickerOpen(false);
  };

  const closeRenameModal = () => {
    if (isSavingRename) return;
    setRenamingWorkspace(null);
    setRenameError('');
    setIsEmojiPickerOpen(false);
  };

  const saveRename = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!renamingWorkspace) return;
    const name = renameValue.trim();
    const emoji = renameEmoji.trim() || '📗';
    if (name.length < 2) {
      setRenameError('Name must be at least 2 characters.');
      return;
    }
    if (name === renamingWorkspace.name && emoji === (renamingWorkspace.emoji || '📗')) {
      closeRenameModal();
      return;
    }
    setIsSavingRename(true);
    setRenameError('');
    try {
      await api.patch(`/workspaces/${renamingWorkspace.id}/settings`, { name, emoji });
      await fetchWorkspaces();
      toast.success('Workspace updated');
      setRenamingWorkspace(null);
    } catch (error: any) {
      setRenameError(error.response?.data?.error || 'Failed to update workspace.');
    } finally {
      setIsSavingRename(false);
    }
  };

  const openDeleteModal = (workspace: WorkspaceSummary) => {
    setDeletingWorkspace(workspace);
    setDeleteConfirmName('');
    setDeletePassword('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    if (isDeletingWorkspace) return;
    setDeletingWorkspace(null);
    setDeleteError('');
  };

  const confirmDelete = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!deletingWorkspace) return;
    if (deleteConfirmName !== deletingWorkspace.name) {
      setDeleteError('Workspace name does not match. Please type it exactly.');
      return;
    }
    if (!deletePassword.trim()) {
      setDeleteError('Please enter your password to confirm.');
      return;
    }
    setIsDeletingWorkspace(true);
    setDeleteError('');
    try {
      // Step-up reauthentication required before destructive action
      await api.post('/auth/step-up', { currentPassword: deletePassword });
      await api.delete(`/workspaces/${deletingWorkspace.id}`);
      const remaining = workspaces.filter(w => w.id !== deletingWorkspace.id);
      setWorkspaces(remaining);
      if (activeWorkspaceId === deletingWorkspace.id) {
        const next = remaining[0]?.id || null;
        setActiveWorkspaceId(next);
        navigate(next ? `/pages?workspace=${next}` : '/dashboard');
      }
      toast.success('Workspace deleted');
      setDeletingWorkspace(null);
    } catch (error: any) {
      const code = error.response?.data?.code;
      if (code === 'MFA_STEP_UP_REQUIRED') {
        setDeleteError('Your account uses two-factor authentication. Please delete this workspace from Settings → Workspace.');
      } else if (error.response?.status === 401 || code === 'STEP_UP_REQUIRED') {
        setDeleteError('Incorrect password. Please try again.');
      } else {
        setDeleteError(error.response?.data?.error || 'Failed to delete workspace. Please try again.');
      }
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  const openEmojiPicker = (ref: React.RefObject<HTMLButtonElement>, target: 'create' | 'rename') => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const pickerWidth = 352;
    const pickerHeight = 500;
    const gap = 8;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = rect.left;
    if (left + pickerWidth > viewportW - gap) left = viewportW - pickerWidth - gap;
    left = Math.max(gap, left);

    let top = rect.bottom + gap;
    const fitsBelow = top + pickerHeight <= viewportH - gap;
    const fitsAbove = rect.top - gap - pickerHeight >= gap;

    if (!fitsBelow && fitsAbove) {
      top = rect.top - pickerHeight - gap;
    } else if (!fitsBelow && !fitsAbove) {
      top = gap;
    }
    top = Math.max(gap, top);

    setPickerStyle({ position: 'fixed', top, left, zIndex: 9999 });
    setEmojiPickerTarget(target);
    setIsEmojiPickerOpen(true);
  };


  const createWorkspace = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    const name = newWorkspaceName.trim();
    const emoji = newWorkspaceEmoji.trim() || '📗';

    if (name.length < 2) {
      setCreateError('Use at least 2 characters for the workspace name.');
      return;
    }

    setIsCreatingWorkspace(true);
    setCreateError('');

    try {
      const res = await api.post('/workspaces', { name, emoji });
      await fetchWorkspaces();
      setActiveWorkspaceId(res.data.id);
      setIsCreateModalOpen(false);
      toast.success('Workspace created');
      navigate(`/pages?workspace=${res.data.id}`);
    } catch (error: any) {
      setCreateError(error.response?.data?.error || 'Failed to create workspace.');
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-20 flex flex-col border-r border-gray-200 bg-white transition-all duration-200 dark:border-gray-800 dark:bg-gray-900 ${isCollapsed ? 'w-20' : 'w-64'}`}>
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="absolute -right-3 top-24 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-xs font-bold text-blue-700 shadow-sm transition-colors hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-blue-300 dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-900"
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-expanded={!isCollapsed}
      >
        {isCollapsed ? '>>' : '<<'}
      </button>

      <div className={`flex h-16 shrink-0 items-center border-b border-gray-200 dark:border-gray-800 ${isCollapsed ? 'justify-center px-3' : 'px-6'}`}>
        <Link
          to="/dashboard"
          className={`flex items-center rounded-md font-bold tracking-tight text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:text-blue-500 dark:focus-visible:ring-offset-gray-900 ${isCollapsed ? 'justify-center' : 'gap-2 text-xl'}`}
          aria-label={isCollapsed ? 'Deltaora dashboard' : undefined}
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span className="mt-0.5 text-lg leading-none text-white">Δ</span>
          </span>
          {!isCollapsed && 'Deltaora'}
        </Link>
      </div>

      <div className={`shrink-0 border-b border-gray-100 py-4 dark:border-gray-800 ${isCollapsed ? 'px-3' : 'px-4'}`}>
        <div className={`flex items-center rounded-md py-2 ${isCollapsed ? 'justify-center px-0' : 'gap-3 px-2'}`}>
          <Avatar name={user?.name} src={user?.avatarUrl} />
          {!isCollapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-950 dark:text-white">{user?.name}</p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:hover:bg-gray-800 dark:hover:text-gray-200 dark:focus-visible:ring-offset-gray-900"
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col" aria-label="Workspace navigation">
        <div className={`min-h-0 flex-1 space-y-1 py-4 ${isCollapsed ? 'overflow-hidden px-3' : 'overflow-y-auto px-4'}`}>
          <Link
            to="/pages?scope=all"
            aria-current={isAllPagesActive ? 'page' : undefined}
            className={`${navBaseClass(isCollapsed)} ${navStateClass(isAllPagesActive)}`}
            title="All Pages"
          >
            <Globe
              className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 shrink-0 ${isAllPagesActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'}`}
              aria-hidden="true"
            />
            <span className={isCollapsed ? 'sr-only' : 'truncate'}>All Pages</span>
          </Link>

          {workspaces.map(workspace => {
            const isActive =
              location.pathname.startsWith('/pages') &&
              searchParams.get('scope') !== 'all' &&
              activeWorkspaceId === workspace.id;
            const canRename = workspace.role === 'owner' || workspace.role === 'editor';
            const isOwnerRole = workspace.role === 'owner';
            const linkRightPad = !isCollapsed
              ? (isOwnerRole ? 'pr-16' : canRename ? 'pr-8' : '')
              : '';

            return (
              <div key={workspace.id} className="group relative flex items-center">
                <Link
                  to={`/pages?workspace=${workspace.id}`}
                  onClick={() => handleWorkspaceClick(workspace.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`${navBaseClass(isCollapsed)} ${navStateClass(isActive)} flex-1 ${linkRightPad}`}
                  title={workspace.name}
                >
                  <span className={`${isCollapsed ? '' : 'mr-3'} shrink-0 text-lg leading-none`} aria-hidden="true">
                    {workspace.emoji || '📗'}
                  </span>
                  <span className={isCollapsed ? 'sr-only' : 'truncate'}>{workspace.name}</span>
                </Link>

                {/* Pencil — owners and editors; shifts left when trash is also present */}
                {!isCollapsed && canRename && (
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); openRenameModal(workspace); }}
                    className={`absolute ${isOwnerRole ? 'right-8' : 'right-1.5'} flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 opacity-0 transition-opacity hover:bg-gray-100 hover:text-gray-700 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:bg-gray-700 dark:hover:text-gray-200`}
                    aria-label={`Rename ${workspace.name}`}
                    title="Rename workspace"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}

                {/* Trash — owners only */}
                {!isCollapsed && isOwnerRole && (
                  <button
                    type="button"
                    onClick={e => { e.preventDefault(); e.stopPropagation(); openDeleteModal(workspace); }}
                    className="absolute right-1.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label={`Delete ${workspace.name}`}
                    title="Delete workspace"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })}


          <button
            type="button"
            onClick={openCreateModal}
            className={`${navBaseClass(isCollapsed)} ${navStateClass(false)}`}
            title="New Workspace"
          >
            <Plus className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300`} aria-hidden="true" />
            <span className={isCollapsed ? 'sr-only' : 'truncate'}>New Workspace</span>
          </button>
        </div>

        <div className={`shrink-0 border-t border-gray-100 py-4 dark:border-gray-800 ${isCollapsed ? 'px-3' : 'px-4'}`}>
          <div className="space-y-1" aria-label="Application navigation">
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${navBaseClass(isCollapsed)} ${navStateClass(isActive)}`}
                title={item.label}
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 shrink-0 ${
                        isActive
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span className={isCollapsed ? 'sr-only' : 'truncate'}>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            {isCollapsed && (
              <button
                type="button"
                onClick={handleLogout}
                className={`${navBaseClass(true)} ${navStateClass(false)}`}
                aria-label="Log out"
                title="Log out"
              >
                <LogOut className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" aria-hidden="true" />
              </button>
            )}
          </div>
          {!isCollapsed && (
            <div className="mt-3 flex items-center gap-4 px-3 text-xs text-gray-400 dark:text-gray-600">
              <Link to="/privacy" className="hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:text-gray-300">
                Privacy
              </Link>
              <Link to="/terms" className="hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:text-gray-300">
                Terms
              </Link>
            </div>
          )}
        </div>
      </nav>

      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md" role="presentation" onMouseDown={closeCreateModal}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-workspace-title"
            aria-describedby="create-workspace-description"
            className="w-full max-w-[720px] overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="flex items-center gap-4 bg-gray-50 px-6 py-5 dark:bg-gray-900">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-3xl text-blue-600 dark:bg-blue-950 dark:text-blue-300">
                <Plus className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p id="create-workspace-title" className="text-base font-medium text-gray-950 dark:text-white">Create a New Workspace</p>
                <p className="mt-1 truncate text-xl font-semibold text-gray-950 dark:text-white">
                  <span aria-hidden="true" className="mr-2">{newWorkspaceEmoji.trim() || '📗'}</span>
                  {newWorkspaceName.trim() || 'Workspace'}
                </p>
              </div>
            </div>

            <form onSubmit={createWorkspace}>
              <div className="border-t border-gray-200 px-6 py-6 dark:border-gray-800">
                <p id="create-workspace-description" className="max-w-2xl text-base leading-7 text-gray-500 dark:text-gray-400">
                  Create a new workspace for your organization. All current users will be added to the new workspace.
                </p>

                <div className="mt-6 grid gap-4 sm:grid-cols-[64px_1fr]">
                  <div className="relative">
                    <span className="mb-2 block text-base text-gray-500 dark:text-gray-400">Emoji</span>
                    <button
                      ref={emojiButtonRef}
                      type="button"
                      onClick={() => {
                        if (isEmojiPickerOpen && emojiPickerTarget === 'create') {
                          setIsEmojiPickerOpen(false);
                        } else {
                          openEmojiPicker(emojiButtonRef, 'create');
                        }
                      }}
                      className="flex h-12 w-16 items-center justify-center rounded-md border border-blue-300 bg-white px-2 text-2xl outline-none ring-offset-white transition-colors hover:bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-blue-800 dark:bg-gray-950 dark:hover:bg-gray-900 dark:ring-offset-gray-900"
                      aria-label="Choose workspace emoji"
                      aria-expanded={isEmojiPickerOpen}
                      aria-haspopup="dialog"
                    >
                      {newWorkspaceEmoji}
                    </button>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-base text-gray-500 dark:text-gray-400">Workspace Name</span>
                    <input
                      autoFocus
                      value={newWorkspaceName}
                      onChange={event => {
                        setNewWorkspaceName(event.target.value);
                        setCreateError('');
                      }}
                      className="h-12 w-full rounded-md border border-gray-200 bg-white px-4 text-lg text-gray-950 outline-none ring-offset-white transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:ring-offset-gray-900"
                      maxLength={100}
                    />
                  </label>
                </div>

                {createError && (
                  <p role="alert" className="mt-4 text-sm font-medium text-red-600 dark:text-red-400">{createError}</p>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-gray-100 px-6 py-6 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={isCreatingWorkspace}
                  className="h-12 rounded-lg bg-blue-100 px-6 text-base font-medium text-blue-700 transition-colors hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:bg-blue-950 dark:text-blue-300 dark:hover:bg-blue-900 dark:focus-visible:ring-offset-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingWorkspace || newWorkspaceName.trim().length < 2}
                  className="h-12 rounded-lg bg-blue-600 px-7 text-base font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-gray-900"
                >
                  {isCreatingWorkspace ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEmojiPickerOpen && createPortal(
        <>
          {/* Backdrop to close picker when clicking outside */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onMouseDown={() => setIsEmojiPickerOpen(false)}
          />
          <div style={{
            ...pickerStyle,
            maxHeight: `calc(100vh - ${(pickerStyle.top as number ?? 8) + 8}px)`,
            overflowY: 'auto',
          }}>
            <Picker
              data={data}
              onEmojiSelect={(emoji: { native: string }) => {
                if (emojiPickerTarget === 'rename') {
                  setRenameEmoji(emoji.native);
                } else {
                  setNewWorkspaceEmoji(emoji.native);
                }
                setIsEmojiPickerOpen(false);
              }}
              theme="auto"
              set="native"
              previewPosition="none"
              skinTonePosition="search"
              autoFocus
            />
          </div>
        </>,
        document.body
      )}
      {renamingWorkspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-md"
          role="presentation"
          onMouseDown={closeRenameModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-workspace-title"
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Header — live preview updates as user edits */}
            <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <span className="text-2xl" aria-hidden="true">{renameEmoji || '📗'}</span>
              <p id="rename-workspace-title" className="text-sm font-semibold text-gray-950 dark:text-white">
                Edit workspace
              </p>
            </div>

            <form onSubmit={saveRename}>
              <div className="px-5 py-4 space-y-4">
                {/* Emoji + Name row — mirrors the create modal layout */}
                <div className="grid gap-3 grid-cols-[56px_1fr]">
                  <div>
                    <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">Emoji</span>
                    <button
                      ref={renameEmojiButtonRef}
                      type="button"
                      onClick={() => {
                        if (isEmojiPickerOpen && emojiPickerTarget === 'rename') {
                          setIsEmojiPickerOpen(false);
                        } else {
                          openEmojiPicker(renameEmojiButtonRef, 'rename');
                        }
                      }}
                      className="flex h-10 w-14 items-center justify-center rounded-lg border border-blue-300 bg-white text-xl outline-none ring-offset-white transition-colors hover:bg-blue-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-blue-800 dark:bg-gray-950 dark:hover:bg-gray-900 dark:ring-offset-gray-900"
                      aria-label="Choose workspace emoji"
                      aria-expanded={isEmojiPickerOpen && emojiPickerTarget === 'rename'}
                      aria-haspopup="dialog"
                    >
                      {renameEmoji || '📗'}
                    </button>
                  </div>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                      Workspace name
                    </span>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => { setRenameValue(e.target.value); setRenameError(''); }}
                      onFocus={e => e.target.select()}
                      onKeyDown={e => { if (e.key === 'Escape') closeRenameModal(); }}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-950 outline-none ring-offset-white transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:ring-offset-gray-900"
                      maxLength={100}
                    />
                  </label>
                </div>
                {renameError && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {renameError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeRenameModal}
                  disabled={isSavingRename}
                  className="h-9 rounded-lg px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingRename || renameValue.trim().length < 2}
                  className="h-9 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 dark:focus-visible:ring-offset-gray-900"
                >
                  {isSavingRename ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingWorkspace && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
          role="presentation"
          onMouseDown={closeDeleteModal}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-workspace-title"
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-5 py-4 dark:border-red-900/40 dark:bg-red-950/30">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/60">
                <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" aria-hidden="true" />
              </div>
              <p id="delete-workspace-title" className="text-sm font-semibold text-red-900 dark:text-red-200">
                Delete workspace
              </p>
            </div>

            <form onSubmit={confirmDelete}>
              <div className="px-5 py-4 space-y-4">
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  This will permanently delete{' '}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {deletingWorkspace.emoji} {deletingWorkspace.name}
                  </span>{' '}
                  and all its monitors, snapshots, history, invites, and API keys. This cannot be undone.
                </p>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Type <span className="font-semibold text-gray-900 dark:text-white">{deletingWorkspace.name}</span> to confirm
                  </span>
                  <input
                    autoFocus
                    value={deleteConfirmName}
                    onChange={e => { setDeleteConfirmName(e.target.value); setDeleteError(''); }}
                    onKeyDown={e => { if (e.key === 'Escape') closeDeleteModal(); }}
                    placeholder={deletingWorkspace.name}
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-950 outline-none ring-offset-white transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:ring-offset-gray-900"
                    maxLength={200}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                    Your password
                  </span>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={e => { setDeletePassword(e.target.value); setDeleteError(''); }}
                    onKeyDown={e => { if (e.key === 'Escape') closeDeleteModal(); }}
                    placeholder="Enter your password"
                    className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-950 outline-none ring-offset-white transition-colors focus:border-red-500 focus:ring-2 focus:ring-red-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:ring-offset-gray-900"
                  />
                </label>

                {deleteError && (
                  <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                    {deleteError}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  disabled={isDeletingWorkspace}
                  className="h-9 rounded-lg px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2 disabled:opacity-60 dark:text-gray-400 dark:hover:bg-gray-800 dark:focus-visible:ring-offset-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDeletingWorkspace || deleteConfirmName !== deletingWorkspace.name || !deletePassword.trim()}
                  className="h-9 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:focus-visible:ring-offset-gray-900"
                >
                  {isDeletingWorkspace ? 'Deleting…' : 'Delete workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </aside>
  );
}

