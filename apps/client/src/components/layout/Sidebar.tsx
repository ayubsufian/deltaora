import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Globe, LayoutDashboard, LogOut, Plus, Settings } from 'lucide-react';
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

  const openEmojiPicker = () => {
    if (!emojiButtonRef.current) return;
    const rect = emojiButtonRef.current.getBoundingClientRect();
    const pickerWidth = 352;
    const pickerHeight = 435;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    let left = rect.left;
    let top = rect.bottom + 8;

    // Flip left if it would overflow right edge
    if (left + pickerWidth > viewportW - 8) {
      left = viewportW - pickerWidth - 8;
    }
    // Flip above if it would overflow bottom
    if (top + pickerHeight > viewportH - 8) {
      top = rect.top - pickerHeight - 8;
    }

    setPickerStyle({ position: 'fixed', top, left, zIndex: 9999 });
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
        <div className={`min-h-0 flex-1 space-y-1 overflow-y-auto py-4 ${isCollapsed ? 'px-3' : 'px-4'}`}>
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

            return (
              <Link
                key={workspace.id}
                to={`/pages?workspace=${workspace.id}`}
                onClick={() => handleWorkspaceClick(workspace.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`${navBaseClass(isCollapsed)} ${navStateClass(isActive)}`}
                title={workspace.name}
              >
                <span className={`${isCollapsed ? '' : 'mr-3'} shrink-0 text-lg leading-none`} aria-hidden="true">
                  {workspace.emoji || '📗'}
                </span>
                <span className={isCollapsed ? 'sr-only' : 'truncate'}>{workspace.name}</span>
              </Link>
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
                        if (isEmojiPickerOpen) {
                          setIsEmojiPickerOpen(false);
                        } else {
                          openEmojiPicker();
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
          <div style={pickerStyle}>
            <Picker
              data={data}
              onEmojiSelect={(emoji: { native: string }) => {
                setNewWorkspaceEmoji(emoji.native);
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
    </aside>
  );
}

