import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Clock } from 'lucide-react';
import { formatDateRelative } from '@deltaora/shared-utils';

const activities = [
  { id: 1, pageTitle: 'Stripe Pricing', category: 'pricing', changeType: 'Update', time: new Date(Date.now() - 1000 * 60 * 30) },
  { id: 2, pageTitle: 'OpenAI Terms', category: 'policy', changeType: 'Major Revision', time: new Date(Date.now() - 1000 * 60 * 120) },
  { id: 3, pageTitle: 'Vercel Changelog', category: 'product', changeType: 'New Release', time: new Date(Date.now() - 1000 * 60 * 60 * 5) },
  { id: 4, pageTitle: 'Google Careers', category: 'careers', changeType: 'New Job Added', time: new Date(Date.now() - 1000 * 60 * 60 * 24) },
];

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {activities.map((activity, index) => (
            <div key={activity.id} className="relative flex gap-4">
              {/* Timeline line */}
              {index !== activities.length - 1 && (
                <div className="absolute left-4 top-10 -bottom-6 w-0.5 bg-gray-200 dark:bg-gray-800" />
              )}
              
              <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 ring-4 ring-white dark:ring-gray-950">
                <Clock size={14} />
              </div>
              
              <div className="flex flex-1 flex-col pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {activity.pageTitle}
                  </p>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDateRelative(activity.time)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] h-5">{activity.category}</Badge>
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {activity.changeType}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
