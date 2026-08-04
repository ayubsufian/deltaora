import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Clock } from 'lucide-react';
import { formatDateRelative } from '@deltaora/shared-utils';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

interface RecentActivityProps {
  notifications?: Notification[];
}

export function RecentActivity({ notifications }: RecentActivityProps) {
  const items = notifications ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No recent activity yet. Add a URL to start monitoring!
          </p>
        ) : (
          <div className="space-y-6">
            {items.map((item, index) => (
              <div key={item._id} className="relative flex gap-4">
                {/* Timeline line */}
                {index !== items.length - 1 && (
                  <div className="absolute left-4 top-10 -bottom-6 w-0.5 bg-gray-200 dark:bg-gray-800" />
                )}
                
                <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 ring-4 ring-white dark:ring-gray-950">
                  <Clock size={14} />
                </div>
                
                <div className="flex flex-1 flex-col pt-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.title}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDateRelative(new Date(item.createdAt))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    {item.message}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
