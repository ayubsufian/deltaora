import { useState } from 'react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Pagination } from '../components/ui/Pagination';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '../hooks/useApi';
import { formatDateRelative } from '@deltaora/shared-utils';
import toast from 'react-hot-toast';

export function Notifications() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useNotifications(page);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync(id);
    } catch {
      toast.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Stay updated on changes to your monitored pages.
          </p>
        </div>
        {data && data.data.length > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead} isLoading={markAllRead.isPending}>
            <CheckCheck size={16} className="mr-2" /> Mark all as read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size={32} />
        </div>
      ) : !data || data.data.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You'll receive notifications here when changes are detected on your monitored pages."
        />
      ) : (
        <>
          <div className="space-y-3">
            {data.data.map((notification) => (
              <Card
                key={notification._id}
                className={`transition-colors ${!notification.isRead ? 'border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${notification.isRead ? 'bg-transparent' : 'bg-blue-500'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className={`text-sm font-semibold ${notification.isRead ? 'text-gray-600 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                        {notification.title}
                      </h3>
                      <Badge variant="outline" className="text-[10px] h-5 capitalize">{notification.type}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-2">{formatDateRelative(new Date(notification.createdAt))}</p>
                  </div>
                  {!notification.isRead && (
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Mark as read"
                      onClick={() => handleMarkRead(notification._id)}
                    >
                      <CheckCheck size={16} />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {data.meta.totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
