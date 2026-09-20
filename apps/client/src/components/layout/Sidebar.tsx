import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BarChart3, Building2, Globe, LayoutDashboard, LogOut, Plus, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { Avatar } from '../ui/Avatar';
import api from '../../lib/axios';

interface WorkspaceSummary {
  id: string;
  name: string;
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

  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isAllPagesActive = location.pathname === '/pages' && searchParams.get('scope') === 'all';

  useEffect(() => {
    let isMounted = true;

    const fetchWorkspaces = async () => {
      try {
        const res = await api.get('/workspaces');
        if (isMounted) setWorkspaces(res.data || []);
      } catch {
        if (isMounted) setWorkspaces([]);
      }
    };

    fetchWorkspaces();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const handleWorkspaceClick = (workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
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
                <Building2
                  className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 shrink-0 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'}`}
                  aria-hidden="true"
                />
                <span className={isCollapsed ? 'sr-only' : 'truncate'}>{workspace.name}</span>
              </Link>
            );
          })}

          <Link to="/settings#new-workspace" className={`${navBaseClass(isCollapsed)} ${navStateClass(false)}`} title="New Workspace">
            <Plus className={`${isCollapsed ? '' : 'mr-3'} h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300`} aria-hidden="true" />
            <span className={isCollapsed ? 'sr-only' : 'truncate'}>New Workspace</span>
          </Link>
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
    </aside>
  );
}
