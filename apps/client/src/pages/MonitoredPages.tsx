import { useEffect, useState } from 'react';
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
import { Link, useSearchParams } from 'react-router-dom';
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
import { useAuth } from '../contexts/AuthContext';

const updatePageSchema = createPageSchema.extend({
  id: z.string(),
});

type CreatePageForm = z.infer<typeof createPageSchema>;
type UpdatePageForm = z.infer<typeof updatePageSchema>;

const categoryOptions = [
  { label: 'General', value: 'general' },
  { label: 'Pricing', value: 'pricing' },
  { label: 'Policy / legal', value: 'policy' },
  { label: 'Product', value: 'product' },
  { label: 'Documentation', value: 'documentation' },
  { label: 'Status / uptime', value: 'status' },
  { label: 'Security / trust', value: 'security' },
  { label: 'Competitor / market', value: 'competitor' },
  { label: 'Careers', value: 'careers' },
];

const importanceOptions = [
  { label: 'Low', value: 'low' },
  { label: 'Medium', value: 'medium' },
  { label: 'High', value: 'high' },
  { label: 'Critical', value: 'critical' },
];

const checkIntervalLimits = {
  min: 5,
  default: 60,
  max: 10080,
};

const defaultCrawlerOptions = {
  authSessionId: '',
  includeSelectors: '',
  excludeSelectors: '',
  waitForSelector: '',
  clickSelectors: '',
  clickText: '',
  recipeSteps: '',
  customHeaders: '',
  paginationNextSelector: '',
  paginationNextText: '',
  paginationMaxPages: 1,
  paginationWaitForSelector: '',
  scrollToBottom: false,
  waitAfterLoadMs: 0,
  acceptCookieBanners: true,
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
  includeFeeds: true,
  respectRobots: true,
  blockedHandling: 'manual_review',
};

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

const normalizeHttpUrl = (value: string) => {
  const url = new URL(value.trim());
  return url.href;
};

const safeJson = (value: string, label = 'JSON') => {
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
};

export function MonitoredPages() {
  const [searchParams] = useSearchParams();
  const { activeWorkspaceId, setActiveWorkspaceId } = useAuth();
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
  const [crawlerOptions, setCrawlerOptions] = useState(defaultCrawlerOptions);

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

  const isAllWorkspacesView = searchParams.get('scope') === 'all';
  const requestedWorkspaceId = searchParams.get('workspace');

  useEffect(() => {
    if (requestedWorkspaceId && requestedWorkspaceId !== activeWorkspaceId) {
      setActiveWorkspaceId(requestedWorkspaceId);
    }
  }, [activeWorkspaceId, requestedWorkspaceId, setActiveWorkspaceId]);

  const { data: pages, isLoading } = usePages({
    allWorkspaces: isAllWorkspacesView,
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
    defaultValues: {
      category: 'general',
      importance: 'medium',
      checkInterval: checkIntervalLimits.default,
    },
  });

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setDiscoveryPreview([]);
    setShowAdvancedCrawler(false);
    setCrawlerOptions(defaultCrawlerOptions);
    reset();
  };

  const buildCrawlerConfig = () => {
    if (!showAdvancedCrawler) return undefined;

    const includeSelectors = splitList(crawlerOptions.includeSelectors);
    const excludeSelectors = splitList(crawlerOptions.excludeSelectors);
    const clickSelectors = splitList(crawlerOptions.clickSelectors);
    const clickText = splitList(crawlerOptions.clickText);
    const apiIncludePatterns = splitList(crawlerOptions.apiIncludePatterns);
    const apiExcludePatterns = splitList(crawlerOptions.apiExcludePatterns);
    const recipeSteps = safeJson(crawlerOptions.recipeSteps, 'Recipe steps JSON');
    const customHeaders = safeJson(crawlerOptions.customHeaders, 'Headers JSON');

    if (recipeSteps !== undefined && !Array.isArray(recipeSteps)) {
      throw new Error('Recipe steps JSON must be an array');
    }

    if (customHeaders !== undefined && (typeof customHeaders !== 'object' || Array.isArray(customHeaders))) {
      throw new Error('Headers JSON must be an object');
    }

    return {
      authSessionId: crawlerOptions.authSessionId || undefined,
      respectRobots: crawlerOptions.respectRobots,
      discovery: {
        enabled: crawlerOptions.discoveryEnabled,
        maxDepth: crawlerOptions.discoveryMaxDepth,
        maxPages: crawlerOptions.discoveryMaxPages,
        includeSubdomains: crawlerOptions.includeSubdomains,
        includeSitemaps: crawlerOptions.includeSitemaps,
        includeFeeds: crawlerOptions.includeFeeds,
      },
      extraction: includeSelectors.length || excludeSelectors.length ? {
        includeSelectors: includeSelectors.length ? includeSelectors : undefined,
        excludeSelectors: excludeSelectors.length ? excludeSelectors : undefined,
      } : undefined,
      behavior: {
        waitForSelector: crawlerOptions.waitForSelector || undefined,
        clickSelectors: clickSelectors.length ? clickSelectors : undefined,
        clickText: clickText.length ? clickText : undefined,
        steps: Array.isArray(recipeSteps) ? recipeSteps : undefined,
        scrollToBottom: crawlerOptions.scrollToBottom,
        waitAfterLoadMs: crawlerOptions.waitAfterLoadMs > 0 ? Math.min(15000, crawlerOptions.waitAfterLoadMs) : undefined,
        acceptCookieBanners: crawlerOptions.acceptCookieBanners,
        locale: crawlerOptions.locale || undefined,
        timezoneId: crawlerOptions.timezoneId || undefined,
      },
      pagination: crawlerOptions.paginationMaxPages > 1 ? {
        nextSelector: crawlerOptions.paginationNextSelector || undefined,
        nextText: crawlerOptions.paginationNextText || undefined,
        maxPages: crawlerOptions.paginationMaxPages,
        waitForSelector: crawlerOptions.paginationWaitForSelector || undefined,
      } : undefined,
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
      auth: customHeaders && typeof customHeaders === 'object' && !Array.isArray(customHeaders)
        ? { headers: customHeaders }
        : undefined,
    };
  };

  const onSubmit = async (data: CreatePageForm) => {
    try {
      await createPage.mutateAsync({ ...data, url: normalizeHttpUrl(data.url), crawlerConfig: buildCrawlerConfig() });
      toast.success('Page added successfully');
      closeAddModal();
    } catch (error: any) {
      toast.error(error.response?.data?.error || error.message || 'Failed to add page');
    }
  };

  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEdit, formState: { errors: editErrors } } = useForm<UpdatePageForm>({
    resolver: zodResolver(updatePageSchema),
  });

  const onEditSubmit = async (data: UpdatePageForm) => {
    try {
      await updatePage.mutateAsync({ id: data.id, data: { title: data.title, url: normalizeHttpUrl(data.url), category: data.category, importance: data.importance as any, checkInterval: data.checkInterval } });
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
        url: normalizeHttpUrl(url),
        maxDepth: crawlerOptions.discoveryMaxDepth,
        maxPages: crawlerOptions.discoveryMaxPages,
        includeSubdomains: crawlerOptions.includeSubdomains,
        includeSitemaps: crawlerOptions.includeSitemaps,
        includeFeeds: crawlerOptions.includeFeeds,
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
      if (!sessionForm.storageState.trim()) {
        throw new Error('Storage state JSON is required');
      }

      await createAuthSession.mutateAsync({
        name: sessionForm.name,
        origin: normalizeHttpUrl(sessionForm.origin),
        storageState: safeJson(sessionForm.storageState, 'Storage state JSON') as Record<string, unknown>,
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
          <h2 className="text-3xl font-bold tracking-tight">{isAllWorkspacesView ? 'All Pages' : 'Monitored Pages'}</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {isAllWorkspacesView
              ? 'Review monitored URLs across every workspace you can access.'
              : 'Manage the URLs you are tracking for changes.'}
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
                ...categoryOptions,
              ]} 
              className="w-44"
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
                        <Link
                          to={`/pages/${page._id}`}
                          onClick={() => {
                            if (page.workspaceId) setActiveWorkspaceId(String(page.workspaceId));
                          }}
                          className="font-semibold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400"
                        >
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
                        <Link
                          to={`/pages/${page._id}`}
                          onClick={() => {
                            if (page.workspaceId) setActiveWorkspaceId(String(page.workspaceId));
                          }}
                        >
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

      <Modal isOpen={isAddModalOpen} onClose={closeAddModal} title="Add Monitored Page" description="Add an HTTP or HTTPS page and choose how Deltaora should monitor it.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Title"
            placeholder="e.g. Stripe pricing"
            autoComplete="off"
            maxLength={100}
            {...register('title')}
            error={errors.title?.message}
          />
          <Input
            label="URL"
            type="url"
            placeholder="https://example.com/pricing"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={2048}
            {...register('url')}
            error={errors.url?.message}
          />
          
          <Select 
            label="Category" 
            options={categoryOptions} 
            {...register('category')}
            error={errors.category?.message}
          />

          <Select 
            label="Importance" 
            options={importanceOptions} 
            {...register('importance')}
            error={errors.importance?.message}
          />
          
          <Input
            label="Check interval (minutes)"
            type="number"
            min={checkIntervalLimits.min}
            max={checkIntervalLimits.max}
            step={5}
            inputMode="numeric"
            {...register('checkInterval', { valueAsNumber: true })}
            error={errors.checkInterval?.message}
          />

          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <Button
              type="button"
              variant="outline"
              className="w-full justify-between"
              onClick={() => setShowAdvancedCrawler(value => !value)}
            >
              <span className="flex items-center gap-2">
                <Settings2 size={16} /> {showAdvancedCrawler ? 'Hide advanced settings' : 'Show advanced settings'}
              </span>
            </Button>
          </div>

          {showAdvancedCrawler && (
            <div className="space-y-5">
              <fieldset className="space-y-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">Access</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <Select
                    label="Saved login"
                    options={[
                      { label: 'None', value: '' },
                      ...(authSessions || []).map(session => ({ label: `${session.name} (${session.origin})`, value: session._id })),
                    ]}
                    value={crawlerOptions.authSessionId}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, authSessionId: e.target.value }))}
                  />
                  <div className="flex items-end">
                    <Button type="button" variant="secondary" className="w-full" onClick={() => setIsSessionModalOpen(true)}>
                      <KeyRound size={16} className="mr-2" /> Add login
                    </Button>
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="crawler-headers-json" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Request headers JSON
                    </label>
                    <textarea
                      id="crawler-headers-json"
                      className="min-h-24 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                      value={crawlerOptions.customHeaders}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, customHeaders: e.target.value }))}
                      placeholder='{"Authorization":"Bearer token"}'
                      spellCheck={false}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">Content targeting</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Include selectors"
                    value={crawlerOptions.includeSelectors}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, includeSelectors: e.target.value }))}
                    placeholder="main, .pricing"
                    maxLength={1000}
                  />
                  <Input
                    label="Exclude selectors"
                    value={crawlerOptions.excludeSelectors}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, excludeSelectors: e.target.value }))}
                    placeholder=".ads, footer"
                    maxLength={1000}
                  />
                  <Input
                    label="Wait selector"
                    value={crawlerOptions.waitForSelector}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, waitForSelector: e.target.value }))}
                    placeholder="#content"
                    maxLength={240}
                  />
                  <Input
                    label="Wait after load (ms)"
                    type="number"
                    min={0}
                    max={15000}
                    step={250}
                    value={crawlerOptions.waitAfterLoadMs || ''}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, waitAfterLoadMs: Math.min(15000, Math.max(0, Number(e.target.value))) }))}
                    placeholder="3000"
                  />
                  <Input
                    label="Locale"
                    value={crawlerOptions.locale}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, locale: e.target.value }))}
                    placeholder="en-US"
                    maxLength={35}
                  />
                  <Input
                    label="Timezone"
                    value={crawlerOptions.timezoneId}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, timezoneId: e.target.value }))}
                    placeholder="America/New_York"
                    maxLength={80}
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">Page behavior</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    label="Click selectors"
                    value={crawlerOptions.clickSelectors}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, clickSelectors: e.target.value }))}
                    placeholder="button.show-more"
                    maxLength={1000}
                  />
                  <Input
                    label="Click text"
                    value={crawlerOptions.clickText}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, clickText: e.target.value }))}
                    placeholder="Load more, Pricing"
                    maxLength={1000}
                  />
                  <Input
                    label="Pagination pages"
                    type="number"
                    min={1}
                    max={50}
                    value={crawlerOptions.paginationMaxPages}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, paginationMaxPages: Math.min(50, Math.max(1, Number(e.target.value))) }))}
                  />
                  {crawlerOptions.paginationMaxPages > 1 && (
                    <>
                      <Input
                        label="Next selector"
                        value={crawlerOptions.paginationNextSelector}
                        onChange={(e) => setCrawlerOptions(value => ({ ...value, paginationNextSelector: e.target.value }))}
                        placeholder="a.next"
                        maxLength={240}
                      />
                      <Input
                        label="Next text"
                        value={crawlerOptions.paginationNextText}
                        onChange={(e) => setCrawlerOptions(value => ({ ...value, paginationNextText: e.target.value }))}
                        placeholder="Next"
                        maxLength={120}
                      />
                      <Input
                        label="Pagination wait selector"
                        value={crawlerOptions.paginationWaitForSelector}
                        onChange={(e) => setCrawlerOptions(value => ({ ...value, paginationWaitForSelector: e.target.value }))}
                        placeholder=".results"
                        maxLength={240}
                      />
                    </>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={crawlerOptions.scrollToBottom}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, scrollToBottom: e.target.checked }))}
                    />
                    Scroll to bottom
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={crawlerOptions.acceptCookieBanners}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, acceptCookieBanners: e.target.checked }))}
                    />
                    Accept cookie banners
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={crawlerOptions.screenshotDiff}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, screenshotDiff: e.target.checked }))}
                    />
                    Screenshot diffing
                  </label>
                </div>
                <div>
                  <label htmlFor="crawler-recipe-json" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Recipe steps JSON
                  </label>
                  <textarea
                    id="crawler-recipe-json"
                    className="min-h-28 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
                    value={crawlerOptions.recipeSteps}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, recipeSteps: e.target.value }))}
                    placeholder='[{"action":"fill","selector":"#search","value":"pricing"},{"action":"press","selector":"#search","key":"Enter"}]'
                    spellCheck={false}
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">API capture</legend>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={crawlerOptions.apiCapture}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, apiCapture: e.target.checked }))}
                  />
                  Capture stable API responses
                </label>
                {crawlerOptions.apiCapture && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <Select
                      label="Data handling"
                      options={[
                        { label: 'Append to page content', value: 'append' },
                        { label: 'Prefer API response', value: 'prefer' },
                      ]}
                      value={crawlerOptions.apiMode}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, apiMode: e.target.value }))}
                    />
                    <Input
                      label="Include URL patterns"
                      value={crawlerOptions.apiIncludePatterns}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, apiIncludePatterns: e.target.value }))}
                      placeholder="/api/, graphql"
                      maxLength={1000}
                    />
                    <Input
                      label="Exclude URL patterns"
                      value={crawlerOptions.apiExcludePatterns}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, apiExcludePatterns: e.target.value }))}
                      placeholder="analytics, tracking"
                      maxLength={1000}
                    />
                  </div>
                )}
              </fieldset>

              <fieldset className="space-y-3 rounded-lg border border-gray-100 p-4 dark:border-gray-800">
                <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-white">Site discovery and compliance</legend>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={crawlerOptions.discoveryEnabled}
                      onChange={(e) => {
                        setCrawlerOptions(value => ({ ...value, discoveryEnabled: e.target.checked }));
                        if (!e.target.checked) setDiscoveryPreview([]);
                      }}
                    />
                    Add discovered site URLs
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={crawlerOptions.respectRobots}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, respectRobots: e.target.checked }))}
                    />
                    Respect robots.txt
                  </label>
                  <Select
                    label="Blocked handling"
                    options={[
                      { label: 'Manual review', value: 'manual_review' },
                      { label: 'Fail crawl', value: 'fail' },
                    ]}
                    value={crawlerOptions.blockedHandling}
                    onChange={(e) => setCrawlerOptions(value => ({ ...value, blockedHandling: e.target.value }))}
                  />
                </div>

                {crawlerOptions.discoveryEnabled && (
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={crawlerOptions.includeSitemaps}
                        onChange={(e) => setCrawlerOptions(value => ({ ...value, includeSitemaps: e.target.checked }))}
                      />
                      Include sitemaps
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={crawlerOptions.includeFeeds}
                        onChange={(e) => setCrawlerOptions(value => ({ ...value, includeFeeds: e.target.checked }))}
                      />
                      Include feeds
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={crawlerOptions.includeSubdomains}
                        onChange={(e) => setCrawlerOptions(value => ({ ...value, includeSubdomains: e.target.checked }))}
                      />
                      Include subdomains
                    </label>
                    <Input
                      label="Max depth"
                      type="number"
                      min={0}
                      max={5}
                      value={crawlerOptions.discoveryMaxDepth}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, discoveryMaxDepth: Math.min(5, Math.max(0, Number(e.target.value))) }))}
                    />
                    <Input
                      label="Max pages"
                      type="number"
                      min={1}
                      max={500}
                      value={crawlerOptions.discoveryMaxPages}
                      onChange={(e) => setCrawlerOptions(value => ({ ...value, discoveryMaxPages: Math.min(500, Math.max(1, Number(e.target.value))) }))}
                    />
                    <div className="flex items-end">
                      <Button type="button" variant="secondary" className="w-full" onClick={handleDiscoveryPreview} isLoading={discoverSite.isPending}>
                        <ShieldCheck size={16} className="mr-2" /> Preview URLs
                      </Button>
                    </div>
                  </div>
                )}

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
              </fieldset>
            </div>
          )}
          
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeAddModal}>Cancel</Button>
            <Button type="submit" isLoading={createPage.isPending}>Add Page</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isSessionModalOpen} onClose={() => setIsSessionModalOpen(false)} title="Add Saved Login">
        <div className="space-y-4">
          <Input
            label="Name"
            value={sessionForm.name}
            onChange={(e) => setSessionForm(value => ({ ...value, name: e.target.value }))}
            placeholder="Vendor dashboard"
            maxLength={100}
          />
          <Input
            label="Origin"
            type="url"
            value={sessionForm.origin}
            onChange={(e) => setSessionForm(value => ({ ...value, origin: e.target.value }))}
            placeholder="https://example.com"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={2048}
          />
          <div>
            <label htmlFor="crawler-storage-state-json" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Storage state JSON
            </label>
            <textarea
              id="crawler-storage-state-json"
              className="min-h-40 w-full rounded-md border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
              value={sessionForm.storageState}
              onChange={(e) => setSessionForm(value => ({ ...value, storageState: e.target.value }))}
              spellCheck={false}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIsSessionModalOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleCreateSession} isLoading={createAuthSession.isPending}>Save login</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!editingPage} onClose={() => setEditingPage(null)} title="Edit Monitored Page" description="Update the configuration for this URL.">
        <form onSubmit={handleSubmitEdit(onEditSubmit)} className="space-y-4">
          <Input type="hidden" {...registerEdit('id')} />
          <Input
            label="Title"
            placeholder="e.g. Stripe pricing"
            autoComplete="off"
            maxLength={100}
            {...registerEdit('title')}
            error={editErrors.title?.message}
          />
          <Input
            label="URL"
            type="url"
            placeholder="https://example.com/pricing"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            maxLength={2048}
            {...registerEdit('url')}
            error={editErrors.url?.message}
          />
          
          <Select 
            label="Category" 
            options={categoryOptions} 
            {...registerEdit('category')}
            error={editErrors.category?.message}
          />

          <Select 
            label="Importance" 
            options={importanceOptions} 
            {...registerEdit('importance')}
            error={editErrors.importance?.message}
          />
          
          <Input
            label="Check interval (minutes)"
            type="number"
            min={checkIntervalLimits.min}
            max={checkIntervalLimits.max}
            step={5}
            inputMode="numeric"
            {...registerEdit('checkInterval', { valueAsNumber: true })}
            error={editErrors.checkInterval?.message}
          />
          
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditingPage(null)}>Cancel</Button>
            <Button type="submit" isLoading={updatePage.isPending}>Save Changes</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
