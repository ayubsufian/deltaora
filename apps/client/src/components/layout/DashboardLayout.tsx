import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../contexts/AuthContext';
import { AlertTriangle } from 'lucide-react';
import api from '../../lib/axios';
import toast from 'react-hot-toast';

export function DashboardLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [isSending, setIsSending] = useState(false);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const handleResend = async () => {
    try {
      setIsSending(true);
      await api.post('/auth/send-verification');
      toast.success('Verification email sent! Check your inbox.');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send verification email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100 flex overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col lg:pl-64 h-full">
        <Header />
        <main className="flex-1 overflow-y-auto">
          {user.isEmailVerified === false && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800 p-4">
              <div className="mx-auto max-w-7xl flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center text-amber-800 dark:text-amber-200">
                  <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
                  <p className="text-sm font-medium">
                    Please verify your email address. You will not be able to create workspaces or monitor pages until your email is verified.
                  </p>
                </div>
                <button
                  onClick={handleResend}
                  disabled={isSending}
                  className="text-sm font-medium bg-amber-100 dark:bg-amber-800 hover:bg-amber-200 dark:hover:bg-amber-700 text-amber-900 dark:text-amber-100 px-4 py-2 rounded-md transition-colors disabled:opacity-50"
                >
                  {isSending ? 'Sending...' : 'Resend Email'}
                </button>
              </div>
            </div>
          )}
          <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8 h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
