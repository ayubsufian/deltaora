import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function DashboardLayout() {
  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 flex overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col lg:pl-64 h-full">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
