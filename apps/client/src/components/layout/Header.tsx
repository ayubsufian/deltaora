import React from 'react';
import { Bell, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useDashboardStats } from '../../hooks/useApi';

export function Header() {
  const navigate = useNavigate();
  const { data: stats } = useDashboardStats();
  const hasUnread = (stats?.latestNotifications ?? []).some((n: { isRead?: boolean }) => !n.isRead);

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q');
    if (q) navigate(`/search?q=${q}`);
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 px-4 shadow-sm backdrop-blur-md sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <form className="relative flex flex-1" onSubmit={handleSearch}>
          <label htmlFor="search-field" className="sr-only">
            Search
          </label>
          <Search
            className="pointer-events-none absolute inset-y-0 left-0 h-full w-5 text-gray-400"
            aria-hidden="true"
          />
          <input
            id="search-field"
            className="block h-full w-full border-0 bg-transparent py-0 pl-8 pr-0 text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-0 sm:text-sm"
            placeholder="Search URLs, summaries, keywords..."
            type="search"
            name="q"
          />
        </form>
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          <ThemeToggle />
          <Link to="/notifications" className="relative p-2 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors">
            <span className="sr-only">View notifications</span>
            <Bell className="h-6 w-6" aria-hidden="true" />
            {hasUnread && <span className="absolute top-1.5 right-1.5 block h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-gray-900" />}
          </Link>
        </div>
      </div>
    </header>
  );
}
