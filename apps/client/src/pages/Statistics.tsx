import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Spinner } from '../components/ui/Spinner';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useDashboardStats } from '../hooks/useApi';

// For now we generate sample data from the dashboard stats
// In a full implementation, you'd have a dedicated /api/v1/stats endpoint
function generateWeeklyData() {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return days.map(name => ({
    name,
    changes: Math.floor(Math.random() * 10) + 1,
  }));
}

function generateMonthlyData() {
  return Array.from({ length: 4 }, (_, i) => ({
    name: `Week ${i + 1}`,
    changes: Math.floor(Math.random() * 30) + 5,
    summaries: Math.floor(Math.random() * 20) + 2,
  }));
}

export function Statistics() {
  const { data: stats, isLoading } = useDashboardStats();
  const weeklyData = generateWeeklyData();
  const monthlyData = generateMonthlyData();

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
        <h2 className="text-3xl font-bold tracking-tight">Statistics</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Visualize change detection activity over time.
        </p>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Pages</p>
            <p className="text-4xl font-bold text-gray-900 dark:text-white mt-2">{stats?.totalPages ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Changes</p>
            <p className="text-4xl font-bold text-blue-600 mt-2">{stats?.totalChanges ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">AI Summaries</p>
            <p className="text-4xl font-bold text-emerald-600 mt-2">{stats?.summariesGenerated ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Changes Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Changes (This Week)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorChanges" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#3b82f6', fontWeight: 600 }}
                />
                <Area 
                  type="monotone" 
                  dataKey="changes" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorChanges)" 
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="changes" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Changes" />
                <Bar dataKey="summaries" fill="#10b981" radius={[4, 4, 0, 0]} name="Summaries" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
