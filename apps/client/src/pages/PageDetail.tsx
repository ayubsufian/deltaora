import { useParams, Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { ArrowLeft, ExternalLink, RefreshCw, Settings } from 'lucide-react';
import { usePageDetail, usePageSummaries, usePageDiffs } from '../hooks/useApi';
import { formatDateRelative } from '@deltaora/shared-utils';

export function PageDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading } = usePageDetail(id!);
  const { data: summaries } = usePageSummaries(id!);
  const { data: diffs } = usePageDiffs(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12 text-gray-500">Page not found.</div>
    );
  }

  const { page, latestDiff } = data;
  const latestSummary = summaries?.[0];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4">
        <Link to="/pages">
          <Button variant="ghost" size="icon">
            <ArrowLeft size={20} />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">{page.title}</h2>
            <Badge variant={page.status === 'active' ? 'success' : 'warning'} className="uppercase">{page.status}</Badge>
          </div>
          <a href={page.url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:underline mt-1 w-fit">
            {page.url} <ExternalLink size={12} className="ml-1" />
          </a>
        </div>
        <div className="flex gap-2">
          <Button variant="outline"><RefreshCw size={16} className="mr-2" /> Force Check</Button>
          <Button variant="outline" size="icon"><Settings size={16} /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Latest Change Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {latestSummary ? (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-lg p-4">
                <p className="text-gray-800 dark:text-gray-200">
                  {latestSummary.summary}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  {formatDateRelative(new Date(latestSummary.createdAt))}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4">
                No changes detected yet. The first check will create a baseline snapshot.
              </p>
            )}

            {latestDiff && (
              <div className="mt-8">
                <h3 className="font-semibold text-lg mb-4">Content Diff</h3>
                <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden bg-white dark:bg-gray-900 p-4 font-mono text-sm max-h-96 overflow-y-auto">
                  {latestDiff.diffText.split('\n').map((line, i) => (
                    <div
                      key={i}
                      className={
                        line.startsWith('+') ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5' :
                        line.startsWith('-') ? 'text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-0.5' :
                        'text-gray-500 px-2 py-0.5'
                      }
                    >
                      {line || '\u00A0'}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">Check Interval</span>
                <span className="font-medium text-gray-900 dark:text-white">Every {page.checkInterval} minutes</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">Last Checked</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {page.lastChecked ? formatDateRelative(new Date(page.lastChecked)) : 'Never'}
                </span>
              </div>
              <div className="flex justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                <span className="text-gray-500">Category</span>
                <span className="font-medium text-gray-900 dark:text-white capitalize">{page.category}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Total Changes</span>
                <span className="font-medium text-gray-900 dark:text-white">{diffs?.length ?? 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          {summaries && summaries.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Version History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {summaries.map((s) => (
                    <div key={s._id} className="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0">
                      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{s.summary}</p>
                      <p className="text-xs text-gray-400 mt-1">{formatDateRelative(new Date(s.createdAt))}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
