import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/axios';

// ── Dashboard ──
export function useDashboardStats() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard');
      return data as {
        totalPages: number;
        checkedToday: number;
        totalChanges: number;
        summariesGenerated: number;
        latestNotifications: Array<{
          _id: string;
          title: string;
          message: string;
          type: string;
          isRead: boolean;
          createdAt: string;
        }>;
      };
    },
  });
}

export function useTimeseriesStats() {
  return useQuery({
    queryKey: ['stats', 'timeseries'],
    queryFn: async () => {
      const { data } = await api.get('/stats/timeseries');
      return data as {
        weekly: Array<{ name: string; changes: number }>;
        monthly: Array<{ name: string; changes: number; summaries: number }>;
      };
    },
  });
}

// ── Monitored Pages ──
interface MonitoredPage {
  _id: string;
  userId: string;
  url: string;
  title: string;
  category: string;
  importance: string;
  status: string;
  checkInterval: number;
  lastChecked: string | null;
  lastCrawlStatus?: string;
  lastCrawlError?: string;
  lastCrawlCode?: string;
  lastHttpStatus?: number;
  lastContentType?: string;
  lastResolvedUrl?: string;
  lastCrawlRecommendation?: string;
  crawlerConfig?: any;
  createdAt: string;
  updatedAt: string;
}

interface CrawlerAuthSession {
  _id: string;
  name: string;
  origin: string;
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export function usePages(filters?: { category?: string; status?: string; importance?: string; search?: string; startDate?: string; endDate?: string }) {
  return useQuery({
    queryKey: ['pages', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.set('category', filters.category);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.importance) params.set('importance', filters.importance);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const { data } = await api.get(`/pages?${params.toString()}`);
      return data as MonitoredPage[];
    },
  });
}

export function useCreatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string;  url: string;
  category: string;
  importance: string;
  checkInterval: number;
  crawlerConfig?: any; }) => {
      const { data } = await api.post('/pages', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDiscoverSite() {
  return useMutation({
    mutationFn: async (body: {
      url: string;
      maxDepth?: number;
      maxPages?: number;
      includeSubdomains?: boolean;
      includeSitemaps?: boolean;
      includeFeeds?: boolean;
      respectRobots?: boolean;
    }) => {
      const { data } = await api.post('/pages/discover', body);
      return data as {
        count: number;
        urls: Array<{ url: string; depth: number; source: string }>;
      };
    },
  });
}

export function useCrawlerAuthSessions() {
  return useQuery({
    queryKey: ['crawler-auth-sessions'],
    queryFn: async () => {
      const { data } = await api.get('/pages/auth-sessions');
      return data as CrawlerAuthSession[];
    },
  });
}

export function useCreateCrawlerAuthSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; origin: string; storageState: Record<string, unknown> }) => {
      const { data } = await api.post('/pages/auth-sessions', body);
      return data as CrawlerAuthSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crawler-auth-sessions'] });
    },
  });
}

export function useDeleteCrawlerAuthSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/pages/auth-sessions/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crawler-auth-sessions'] });
    },
  });
}

export function useUpdatePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MonitoredPage> }) => {
      const res = await api.put(`/pages/${id}`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeletePage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/pages/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useTogglePageStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.patch(`/pages/${id}/status`, { status });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pages'] });
    },
  });
}

// ── Page Detail ──
export function usePageDetail(id: string) {
  return useQuery({
    queryKey: ['page', id],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${id}`);
      return data as {
        page: MonitoredPage;
        latestSnapshot: { _id: string; content: string; contentHash: string; createdAt: string } | null;
        latestDiff: { _id: string; oldContent: string; newContent: string; diffText: string; createdAt: string } | null;
      };
    },
    enabled: !!id,
  });
}

// ── History ──
export function usePageSnapshots(pageId: string) {
  return useQuery({
    queryKey: ['snapshots', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${pageId}/snapshots`);
      return data as Array<{ _id: string; content: string; contentHash: string; createdAt: string }>;
    },
    enabled: !!pageId,
  });
}

export function usePageDiffs(pageId: string) {
  return useQuery({
    queryKey: ['diffs', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${pageId}/diffs`);
      return data as Array<{ _id: string; oldContent: string; newContent: string; diffText: string; createdAt: string }>;
    },
    enabled: !!pageId,
  });
}

export function usePageSummaries(pageId: string) {
  return useQuery({
    queryKey: ['summaries', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/pages/${pageId}/summaries`);
      return data as Array<{ _id: string; summary: string; createdAt: string }>;
    },
    enabled: !!pageId,
  });
}

// ── Search ──
export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`);
      return data as {
        urls: MonitoredPage[];
        summaries: Array<{ _id: string; summary: string; diffId: string; createdAt: string }>;
      };
    },
    enabled: query.length > 0,
  });
}

// ── Notifications ──
interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export function useNotifications(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['notifications', page, limit],
    queryFn: async () => {
      const { data } = await api.get(`/notifications?page=${page}&limit=${limit}`);
      return data as {
        data: NotificationItem[];
        meta: { total: number; page: number; limit: number; totalPages: number };
      };
    },
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/notifications/${id}/read`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.patch('/notifications/read-all');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
