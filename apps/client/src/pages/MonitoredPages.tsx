import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, Search as SearchIcon, ExternalLink, Play, Pause, Trash2, Edit2, Globe, Settings2, ShieldCheck, KeyRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPageSchema } from '@deltaora/validation';
import { z } from 'zod';
import { Link } from 'react-router-dom';
import {
  usePages,
  useCreatePage,
  useDeletePage,
  useTogglePageStatus,
  useUpdatePage,
  useDiscoverSite,
  useCrawlerAuthSessions,
  useCreateCrawlerAuthSession,
} from '../hooks/useApi';
import { formatDateRelative } from '@deltaora/shared-utils';
import toast from 'react-hot-toast';

const updatePageSchema = createPageSchema.extend({
  id: z.string(),
});

type CreatePageForm = z.infer<typeof createPageSchema>;
type UpdatePageForm = z.infer<typeof updatePageSchema>;

const crawlBadgeVariant = (status?: string) => {
  if (status === 'success') return 'success';
  if (status === 'blocked' || status === 'auth_required' || status === 'unsupported' || status === 'manual_review') return 'warning';
  if (status === 'failed') return 'destructive';
  return 'outline';
};

const splitList = (value: string) =>
  value
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean);

const safeJson = (value: string) => {
  if (!value.trim()) return undefined;
  return JSON.parse(value);
};

export function MonitoredPages() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [importanceFilter, setImportanceFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingPage, setEditingPage] = useState<UpdatePageForm | null>(null);
  const [showAdvancedCrawler, setShowAdvancedCrawler] = useState(false);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [discoveryPreview, setDiscoveryPreview] = useState<Array<{ url: string; depth: number; source: string }>>([]);
  const [sessionForm, setSessionForm] = useState({ name: '', origin: '', storageState: '' });
  const [crawlerOptions, setCrawlerOptions] = useState({
    authSessionId: '',
    includeSelectors: '',
    excludeSelectors: '',
    waitForSelector: '',
    clickSelectors: '',
    clickText: '',
    scrollToBottom: false,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    apiCapture: false,
    apiMode: 'append',
    apiIncludePatterns: '',
    apiExcludePatterns: '',
    screenshotDiff: false,
    discoveryEnabled: false,
    discoveryMaxDepth: 1,
    discoveryMaxPages: 25,
    includeSubdomains: false,
    includeSitemaps: true,
    respectRobots: true,
    blockedHandling: 'manual_review',
  });

  // Compute date bounds for filter
  let startDate: string | undefined;
  let endDate: string | undefined;
  if (dateFilter) {
    const end = new Date();
    const start = new Date();
    if (dateFilter === '24h') start.setDate(start.getDate() - 1);
    else if (dateFilter === '7d') start.setDate(start.getDate() - 7);
    else if (dateFilter === '30d') start.setDate(start.getDate() - 30);
    startDate = start.toISOString();
    endDate = end.toISOString();
  }

  const { data: pages, isLoading } = usePages({
    category: categoryFilter || undefined,
    status: statusFilter || undefined,
    importance: importanceFilter || undefined,
    startDate,
    endDate,
    search: searchQuery || undefined,
  });

  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const deletePage = useDeletePage();
  const toggleStatus = useTogglePageStatus();
  const discoverSite = useDiscoverSite();
  const { data: authSessions } = useCrawlerAuthSessions();
  const createAuthSession = useCreateCrawlerAuthSession();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<CreatePageForm>({
    resolver: zodResolver(createPageSchema),
  });

  const buildCrawlerConfig = () => {
    if (!showAdvancedCrawler) return undefined;

    const includeSelectors = splitList(crawlerOptions.includeSelectors);
    const excludeSelectors = splitList(crawlerOptions.excludeSelectors);
    const clickSelectors = splitList(crawlerOptions.clickSelectors);
    const clickText = splitList(crawlerOptions.clickText);
    const apiIncludePatterns = splitList(crawlerOptions.apiIncludePatterns);
    const apiExcludePatterns = splitList(crawlerOptions.apiExcludePatterns);

    return {
      authSessionId: crawlerOptions.authSessionId || undefined,
      respectRobots: crawlerOptions.respectRobots,
      discovery: {
        enabled: crawlerOptions.discoveryEnabled,
        maxDepth: crawlerOptions.discoveryMaxDepth,
        maxPages: crawlerOptions.discoveryMaxPages,
        includeSubdomains: crawlerOptions.includeSubdomains,
        includeSitemaps: crawlerOptions.includeSitemaps,
      },
      extraction: includeSelectors.length || excludeSelectors.length ? {
        includeSelectors: includeSelectors.length ? includeSelectors : undefined,
        excludeSelectors: excludeSelectors.length ? excludeSelectors : undefined,
      } : undefined,
      behavior: {
        waitForSelector: crawlerOptions.waitForSelector || undefined,
        clickSelectors: clickSelectors.length ? clickSelectors : undefined,
        clickText: clickText.length ? clickText : undefined,
        scrollToBottom: crawlerOptions.scrollToBottom,
        acceptCookieBanners: true,
        locale: crawlerOptions.locale || undefined,
        timezoneId: crawlerOptions.timezoneId || undefined,
      },
      apiCapture: crawlerOptions.apiCapture ? {
        enabled: true,
        mode: crawlerOptions.apiMode,
        maxResponses: 10,
        includeUrlPatterns: apiIncludePatterns.length ? apiIncludePatterns : undefined,
        excludeUrlPatterns: apiExcludePatterns.length ? apiExcludePatterns : undefined,
      } : undefined,
      content: {
        screenshotDiff: crawlerOptions.screenshotDiff,
        binaryFingerprint: true,
      },
      compliance: {
        robotsPolicy: crawlerOptions.respectRobots ? 'respect' : 'ignore',
        blockedHandling: crawlerOptions.blockedHandling,
      },
    };
  };

  const onSubmit = async (data: CreatePageForm) => {
    try {
      await createPage.mutateAsync({ ...data, crawlerConfig: buildCrawlerConfig() });
      toast.success('Page added successfully');
      setIsAddModalOpen(false);
      setDiscoveryPreview([]);
      reset();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add page');
    }
  };

  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, formState: { errors: editErrors } } = useForm<UpdatePageForm>({
    resolver: zodResolver(updatePageSchema),
  });

  const onEditSubmit = async (data: UpdatePageForm) => {
    try {
      await updatePage.mutateAsync({ id: data.id, data: { title: data.title, url: data.url, category: data.category, importance: data.importance as any, checkInterval: data.checkInterval } });
      toast.success('Page updated successfully');
      setEditingPage(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update page');
    }
  };

  const openEditModal = (page: any) => {
    const payload = { id: page._id, title: page.title, url: page.url, category: page.category, importance: page.importance, checkInterval: page.checkInterval };
    setEditingPage(payload);
    resetEdit(payload);
  };

  const handleDiscoveryPreview = async () => {
    const url = watch('url');
    if (!url) {
      toast.error('Enter a URL first');
      return;
    }

    try {
      const result = await discoverSite.mutateAsync({
        url,
        maxDepth: crawlerOptions.discoveryMaxDepth,
        maxPages: crawlerOptions.discoveryMaxPages,
        includeSubdomains: crawlerOptions.includeSubdomains,
        includeSitemaps: crawlerOptions.includeSitemaps,
        respectRobots: crawlerOptions.respectRobots,
      });
      setDiscoveryPreview(result.urls);
      toast.success(`Found ${result.count} URLs`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Discovery failed');
    }
  };

  const handleCreateSession = async () => {
    try {
      await createAuthSession.mutateAsync({
        name: sessionForm.name,
        origin: sessionForm.origin,
        storageState: safeJson(sessionForm.storageState) as Record<string, unknown>,
      });
      toast.success('Session saved');
      setSessionForm({ name: '', origin: '', storageState: '' });
      setIsSessionModalOpen(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to save session');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deletePage.mutateAsync(id);
      toast.success('Page deleted');
    } catch {
      toast.error('Failed to delete page');
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await toggleStatus.mutateAsync({ id, status: newStatus });
      toast.success(`Page ${newStatus === 'active' ? 'resumed' : 'paused'}`);
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Monitored Pages</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage the URLs you are tracking for changes.
          </p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} className="mr-2" /> Add URL
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <Input
              className="pl-10"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select 
              options={[
                { label: 'All Categories', value: '' },
                { label: 'General', value: 'general' },
                { label: 'Pricing', value: 'pricing' },
                { label: 'Policy', value: 'policy' },
                { label: 'Product', value: 'product' },
                { label: 'Careers', value: 'careers' },
              ]} 
              className="w-32"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            />
            <Select 
              options={[
                { label: 'All Importance', value: '' },
                { label: 'Critical', value: 'critical' },
                { label: 'High', value: 'high' },
                { label: 'Medium', value: 'medium' },
                { label: 'Low', value: 'low' },
              ]} 
              className="w-36"
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(e.target.value)}
            />
            <Select 
              options={[
                { label: 'Any Date', value: '' },
                { label: 'Past 24 hours', value: '24h' },
                { label: 'Past 7 days', value: '7d' },
                { label: 'Past 30 days', value: '30d' },
              ]} 
              className="w-36"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
            <Select 
              options={[
                { label: 'All Status', value: '' },
                { label: 'Active', value: 'active' },
                { label: 'Paused', value: 'paused' },
              ]} 
              className="w-32"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={32} />
          </div>
        ) : !pages || pages.length === 0 ? (
          <div className="py-8">
            <EmptyState
              icon={Globe}
              title="No monitored pages"
              description="Add your first URL to start tracking changes."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-500 dark:text-gray-400">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-xs uppercase text-gray-700 dark:text-gray-300">
                <tr>
                  <th className="px-6 py-4 font-medium">Page Title / URL</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium">Last Checked</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map((page) => (
                  <tr key={page._id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <Link to={`/pages/${page._id}`} className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                          {page.title}
                        </Link>
                        <div className="flex items-center text-xs text-gray-500 mt-1">
                          <a href={page.url} target="_blank" rel="noopener noreferrer" className="flex items-center hover:underline">
                            {page.url} <ExternalLink size={10} className="ml-1" />
                          </a>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="capitalize">{page.category}</Badge>
                      <Badge variant={page.importance === 'high' || page.importance === 'critical' ? 'warning' : 'outline'} className="capitalize mt-1 ml-1 text-[10px]">
                        {page.importance}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={page.status === 'active' ? 'success' : 'warning'} className="uppercase">{page.status}</Badge>
                        {page.lastCrawlStatus && (
                          <Badge
                            variant={crawlBadgeVariant(page.lastCrawlStatus)}
                            className="uppercase"
                            title={page.lastCrawlError || undefined}
                          >
                            {page.lastCrawlStatus.replace(/_/g, ' ')}
                          </Badge>
                        )}
                        {page.lastCrawlRecommendation && (
                          <span className="max-w-60 text-xs text-gray-500 dark:text-gray-400">
                            {page.lastCrawlRecommendation}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {page.lastChecked ? formatDateRelative(new Date(page.lastChecked)) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/pages/${page._id}`}>
                          <Button variant="ghost" size="icon" title="View details">
                             <SearchIcon size={16} />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" title="Edit URL" onClick={() => openEditModal(page)}>
                           <Edit2 size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={page.status === 'active' ? 'Pause' : 'Resume'}
                          onClick={() => handleToggleStatus(page._id, page.status)}
                        >
                          {page.status === 'active' ? <Pause size={16} /> : <Play size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => handleDelete(page._id, page.title)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Add Monitored Page" description="Enter the URL and configuration for the page you want to track.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input label="Title" placeholder="e.g. Stripe Pricing Page" {...register('title')} error={errors.title?.message} />
          <Input label="URL" type="url" placeholder="https://example.com" {...register('url')} error={errors.url?.message} />
          
          <Select 
            label="Category" 
            options={[
              { label: 'General', value: 'general' },
              { label: 'Pricing', value: 'pricing' },
              { label: 'Policy', value: 'policy' },
              { label: 'Product', value: 'product' },
              { label: 'Careers', value: 'careers' },
            ]} 
            {...register('category')}
            error={errors.category?.message}
          />

          <Select 
            label="Importance" 
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Critical', value: 'critical' },
            ]} 
            {...register('importance')}
            error={errors.importance?.message}
          />
          
          <Input label="Check Interval (minutes)" type="number" defaultValue={60} {...register('checkInterval', { valueAsNumber: true })} error={errors.checkInterval?.message} />

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              onClick={() => setShowAdvancedCrawler(value => !value)}
            >
              <span className="flex items-center gap-2"><Settings2 size={16} /> Advanced crawler</span>
              <span>{showAdvancedCrawler ? 'Hide' : 'Show'}</span>
            </Button>
          </div>

          {showAdvancedCrawler && (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-2">
                <Select
                  label="Saved session"
                  options={[
                    { label: 'None', value: '' },
                    ...(authSessions || []).map(session => ({ label: `${session.name} (${session.origin})`, value: session._id })),
                  ]}
                  value={crawlerOptions.authSessionId}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, authSessionId: e.target.value }))}
                />
                <div className="flex items-end">
                  <Button type="button" variant="secondary" className="w-full" onClick={() => setIsSessionModalOpen(true)}>
                    <KeyRound size={16} className="mr-2" /> Save session
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  label="Include selectors"
                  value={crawlerOptions.includeSelectors}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, includeSelectors: e.target.value }))}
                  placeholder="main, .pricing"
                />
                <Input
                  label="Exclude selectors"
                  value={crawlerOptions.excludeSelectors}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, excludeSelectors: e.target.value }))}
                  placeholder=".ads, footer"
                />
                <Input
                  label="Wait selector"
                  value={crawlerOptions.waitForSelector}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, waitForSelector: e.target.value }))}
                  placeholder="#content"
                />
                <Input
                  label="Click selectors"
                  value={crawlerOptions.clickSelectors}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, clickSelectors: e.target.value }))}
                  placeholder="button.show-more"
                />
                <Input
                  label="Click text"
                  value={crawlerOptions.clickText}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, clickText: e.target.value }))}
                  placeholder="Load more, Pricing"
                />
                <Input
                  label="Locale"
                  value={crawlerOptions.locale}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, locale: e.target.value }))}
                />
                <Input
                  label="Timezone"
                  value={crawlerOptions.timezoneId}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, timezoneId: e.target.value }))}
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={crawlerOptions.scrollToBottom}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, scrollToBottom: e.target.checked }))}
                  />
                  Scroll page
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={crawlerOptions.screenshotDiff}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, screenshotDiff: e.target.checked }))}
                  />
                  Screenshot fingerprint
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={crawlerOptions.apiCapture}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, apiCapture: e.target.checked }))}
                  />
                  Capture JSON APIs
                </label>
                <Select
                  label="API mode"
                  options={[
                    { label: 'Append', value: 'append' },
                    { label: 'Prefer', value: 'prefer' },
                  ]}
                  value={crawlerOptions.apiMode}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, apiMode: e.target.value }))}
                />
                <Input
                  label="API include"
                  value={crawlerOptions.apiIncludePatterns}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, apiIncludePatterns: e.target.value }))}
                  placeholder="/api/, graphql"
                />
                <Input
                  label="API exclude"
                  value={crawlerOptions.apiExcludePatterns}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, apiExcludePatterns: e.target.value }))}
                  placeholder="analytics, tracking"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={crawlerOptions.discoveryEnabled}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, discoveryEnabled: e.target.checked }))}
                  />
                  Crawl site
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={crawlerOptions.includeSitemaps}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, includeSitemaps: e.target.checked }))}
                  />
                  Sitemaps
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={crawlerOptions.includeSubdomains}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, includeSubdomains: e.target.checked }))}
                  />
                  Subdomains
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={crawlerOptions.respectRobots}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, respectRobots: e.target.checked }))}
                  />
                  Respect robots.txt
                </label>
                <Input
                  label="Max depth"
                  type="number"
                  value={crawlerOptions.discoveryMaxDepth}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, discoveryMaxDepth: Number(e.target.value) }))}
                />
                <Input
                  label="Max pages"
                  type="number"
                  value={crawlerOptions.discoveryMaxPages}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, discoveryMaxPages: Number(e.target.value) }))}
                />
                <Select
                  label="Blocked handling"
                  options={[
                    { label: 'Manual review', value: 'manual_review' },
                    { label: 'Fail crawl', value: 'fail' },
                  ]}
                  value={crawlerOptions.blockedHandling}
                  onChange={(e) => setCrawlerOptions(value => ({ ...value, blockedHandling: e.target.value }))}
                />
                <div className="flex items-end">
                  <Button type="button" variant="secondary" className="w-full" onClick={handleDiscoveryPreview} isLoading={discoverSite.isPending}>
                    <ShieldCheck size={16} className="mr-2" /> Preview URLs
                  </Button>
                </div>
              </div>

              {discoveryPreview.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded-md border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {discoveryPreview.slice(0, 50).map(item => (
                        <tr key={item.url} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <td className="px-3 py-2 text-gray-500">{item.source}</td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{item.url}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="submit" isLoading={createPage.isPending}>Add Page</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} title="Save Auth Session">
        <div className="space-y-4">
          <Input
            label="Name"
            value={sessionForm.name}
            onChange={(e) => setSessionForm(value => ({ ...value, name: e.target.value }))}
            placeholder="Vendor dashboard"
          />
          <Input
            label="Origin"
            type="url"
            value={sessionForm.origin}
            onChange={(e) => setSessionForm(value => ({ ...value, origin: e.target.value }))}
            placeholder="https://example.com"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Storage state JSON
            </label>
            <textarea
              className="min-h-40 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
              value={sessionForm.storageState}
              onChange={(e) => setSessionForm(value => ({ ...value, storageState: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsSessionModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleCreateSession} isLoading={createAuthSession.isPending}>Save Session</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editingPage} onClose={() => setEditingPage(null)} title="Edit Monitored Page" description="Update the configuration for this URL.">
        <form onSubmit={handleSubmitEdit(onEditSubmit)} className="space-y-4">
          <Input type="hidden" {...registerEdit('id')} />
          <Input label="Title" placeholder="e.g. Stripe Pricing Page" {...registerEdit('title')} error={editErrors.title?.message} />
          <Input label="URL" type="url" placeholder="https://example.com" {...registerEdit('url')} error={editErrors.url?.message} />
          
          <Select 
            label="Category" 
            options={[
              { label: 'General', value: 'general' },
              { label: 'Pricing', value: 'pricing' },
              { label: 'Policy', value: 'policy' },
              { label: 'Product', value: 'product' },
              { label: 'Careers', value: 'careers' },
            ]} 
            {...registerEdit('category')}
            error={editErrors.category?.message}
          />

          <Select 
            label="Importance" 
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Medium', value: 'medium' },
              { label: 'High', value: 'high' },
              { label: 'Critical', value: 'critical' },
            ]} 
            {...registerEdit('importance')}
            error={editErrors.importance?.message}
          />
          
          <Input label="Check Interval (minutes)" type="number" {...registerEdit('checkInterval', { valueAsNumber: true })} error={editErrors.checkInterval?.message} />
          
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditingPage(null)}>Cancel</Button>
            <Button type="submit" isLoading={updatePage.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
