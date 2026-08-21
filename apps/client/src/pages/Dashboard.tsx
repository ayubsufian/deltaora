import { StatsCard } from '../components/dashboard/StatsCard';
import { ChangeChart } from '../components/dashboard/ChangeChart';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { Globe, FileDiff, Sparkles, BellRing } from 'lucide-react';
import { useDashboardStats, useTimeseriesStats } from '../hooks/useApi';
import { Spinner } from '../components/ui/Spinner';

export function Dashboard() {
  const { data: stats, isLoading } = useDashboardStats();
  const { data: timeseries } = useTimeseriesStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Overview of your monitored pages and recent changes.
        </p>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard 
          title="Monitored Pages" 
          value={stats?.totalPages ?? 0} 
          icon={Globe} 
        />
        <StatsCard 
          title="Checked Today" 
          value={stats?.checkedToday ?? 0} 
          icon={FileDiff} 
        />
        <StatsCard 
          title="AI Summaries" 
          value={stats?.summariesGenerated ?? 0} 
          icon={Sparkles} 
        />
        <StatsCard 
          title="Total Changes" 
          value={stats?.totalChanges ?? 0} 
          icon={BellRing} 
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChangeChart data={timeseries?.weekly} />
        </div>
        <div>
          <RecentActivity notifications={stats?.latestNotifications} />
        </div>
      </div>
    </div>
  );
}
