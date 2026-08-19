import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, resolvedTheme, cycleTheme } = useTheme();
  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={`rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white ${className}`}
      title={`Theme: ${theme}. Switch to ${nextTheme}.`}
      aria-label={`Theme: ${theme}. Switch to ${nextTheme}.`}
    >
      <ThemeIcon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
