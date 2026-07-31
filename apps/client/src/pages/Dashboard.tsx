import { StatsCard } from '../components/dashboard/StatsCard';
import { ChangeChart } from '../components/dashboard/ChangeChart';
import { RecentActivity } from '../components/dashboard/RecentActivity';
import { Globe, FileDiff, Sparkles, BellRing } from 'lucide-react';

export function Dashboard() {
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
          value={12} 
          icon={Globe} 
          trend={{ value: 20, isPositive: true }} 
        />
        <StatsCard 
          title="Changes Detected" 
          value={84} 
          icon={FileDiff} 
          trend={{ value: 5, isPositive: false }} 
        />
        <StatsCard 
          title="AI Summaries" 
          value={56} 
          icon={Sparkles} 
          trend={{ value: 12, isPositive: true }} 
        />
        <StatsCard 
          title="Alerts Sent" 
          value={42} 
          icon={BellRing} 
          trend={{ value: 2, isPositive: true }} 
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ChangeChart />
        </div>
        <div>
          <RecentActivity />
        </div>
      </div>
    </div>
  );
}
