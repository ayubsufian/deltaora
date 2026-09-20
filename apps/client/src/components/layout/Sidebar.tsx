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

const secondaryNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/dashboard' },
  { icon: BarChart3, label: 'Statistics', to: '/statistics' },
  { icon: Settings, label: 'Settings', to: '/settings' },
];

const navBaseClass =
  'group flex min-h-11 w-full items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900';

const navStateClass = (isActive: boolean) =>
  isActive
    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-950 dark:text-gray-300 dark:hover:bg-gray-800/60 dark:hover:text-white';

export function Sidebar() {
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
    <aside className="fixed inset-y-0 left-0 z-20 flex w-64 flex-col border-r border-gray-200 bg-white transition-all dark:border-gray-800 dark:bg-gray-900">
      <div className="flex h-16 shrink-0 items-center border-b border-gray-200 px-6 dark:border-gray-800">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 rounded-md text-xl font-bold tracking-tight text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:text-blue-500 dark:focus-visible:ring-offset-gray-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
            <span className="mt-0.5 text-lg leading-none text-white">Δ</span>
          </span>
          Deltaora
        </Link>
      </div>

      <div className="shrink-0 border-b border-gray-100 px-4 py-4 dark:border-gray-800">
        <div className="flex items-center gap-3 rounded-md px-2 py-2">
          <Avatar name={user?.name} src={user?.avatarUrl} />
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
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col" aria-label="Workspace navigation">
        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
          <Link
            to="/pages?scope=all"
            aria-current={isAllPagesActive ? 'page' : undefined}
            className={`${navBaseClass} ${navStateClass(isAllPagesActive)}`}
          >
            <Globe
              className={`mr-3 h-5 w-5 shrink-0 ${isAllPagesActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'}`}
              aria-hidden="true"
            />
            <span className="truncate">All Pages</span>
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
                className={`${navBaseClass} ${navStateClass(isActive)}`}
              >
                <Building2
                  className={`mr-3 h-5 w-5 shrink-0 ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'}`}
                  aria-hidden="true"
                />
                <span className="truncate">{workspace.name}</span>
              </Link>
            );
          })}

          <Link to="/settings#new-workspace" className={`${navBaseClass} ${navStateClass(false)}`}>
            <Plus className="mr-3 h-5 w-5 shrink-0 text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300" aria-hidden="true" />
            <span className="truncate">New Workspace</span>
          </Link>
        </div>

        <div className="shrink-0 border-t border-gray-100 px-4 py-4 dark:border-gray-800">
          <div className="space-y-1" aria-label="Application navigation">
            {secondaryNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `${navBaseClass} ${navStateClass(isActive)}`}
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={`mr-3 h-5 w-5 shrink-0 ${
                        isActive
                          ? 'text-blue-700 dark:text-blue-300'
                          : 'text-gray-400 group-hover:text-gray-500 dark:group-hover:text-gray-300'
                      }`}
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-4 px-3 text-xs text-gray-400 dark:text-gray-600">
            <Link to="/privacy" className="hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:text-gray-300">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:hover:text-gray-300">
              Terms
            </Link>
          </div>
        </div>
      </nav>
    </aside>
  );
}
