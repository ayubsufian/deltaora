import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { CrawlerAuthSession } from '../models/CrawlerAuthSession';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { Workspace } from '../models/Workspace';
import { PageStatus } from '@deltaora/shared-types';
import { ForbiddenError } from '@casl/ability';
import { logAuditEvent } from '../services/audit.service';
import { encryptSecret } from '../services/security.service';
import { assertSafeScrapeUrl } from '../services/urlSafety.service';
import { discoverSite as discoverSiteUrls } from '../services/siteDiscovery.service';

const splitCrawlerConfig = (crawlerConfig: any) => {
  if (!crawlerConfig) {
    return { publicCrawlerConfig: undefined, crawlerAuthEncrypted: undefined };
  }

  const { auth, ...publicCrawlerConfig } = crawlerConfig;
  return {
    publicCrawlerConfig,
    crawlerAuthEncrypted: auth ? encryptSecret(JSON.stringify(auth)) : undefined,
  };
};

export const getPages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    const { category, status, importance, search, startDate, endDate } = req.query;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context. Please select a workspace.' });
    }

    // CASL check: can the user read MonitoredPages in this workspace?
    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'MonitoredPage');

    const query: any = { workspaceId };

    if (category) query.category = category;
    if (status) query.status = status;
    if (importance) query.importance = importance;
    if (search) query.title = { $regex: search, $options: 'i' };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const pages = await MonitoredPage.find(query).sort({ createdAt: -1 });
    res.json(pages);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const createPage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.workspaceId;
    const { url, title, category, importance, checkInterval, crawlerConfig } = req.body;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context. Please select a workspace.' });
    }

    // CASL check: can the user create MonitoredPages?
    ForbiddenError.from(req.ability!).throwUnlessCan('create', 'MonitoredPage');

    // Entitlement check: enforce workspace plan limits
    const workspace = await Workspace.findById(workspaceId);
    if (workspace) {
      const currentPageCount = await MonitoredPage.countDocuments({ workspaceId });
      if (currentPageCount >= workspace.maxPages) {
        return res.status(403).json({
          error: 'Plan limit reached',
          message: `Your ${workspace.plan} plan allows a maximum of ${workspace.maxPages} monitored pages. Please upgrade your plan.`,
        });
      }
    }

    const existing = await MonitoredPage.findOne({ workspaceId, url });
    if (existing) {
      return res.status(409).json({ error: 'URL is already being monitored in this workspace' });
    }

    await assertSafeScrapeUrl(url);

    const { publicCrawlerConfig, crawlerAuthEncrypted } = splitCrawlerConfig(crawlerConfig);

    const page = new MonitoredPage({
      userId, // Audit trail: who created this page
      workspaceId,
      url,
      title,
      category,
      importance,
      checkInterval,
      crawlerConfig: publicCrawlerConfig,
      crawlerAuthEncrypted,
      status: PageStatus.ACTIVE,
    });

    await page.save();

    const discoveredPages = [];
    if (publicCrawlerConfig?.discovery?.enabled) {
      const discoveredUrls = await discoverSiteUrls(url, {
        maxDepth: publicCrawlerConfig.discovery.maxDepth,
        maxPages: publicCrawlerConfig.discovery.maxPages,
        includeSubdomains: publicCrawlerConfig.discovery.includeSubdomains,
        includeSitemaps: publicCrawlerConfig.discovery.includeSitemaps,
        respectRobots: publicCrawlerConfig.compliance?.robotsPolicy === 'ignore'
          ? false
          : publicCrawlerConfig.respectRobots ?? true,
      });
      const existingUrls = new Set(
        (await MonitoredPage.find({ workspaceId }).select('url')).map(existingPage => existingPage.url)
      );
      let remainingSlots = Math.max(0, (workspace?.maxPages ?? Number.MAX_SAFE_INTEGER) - existingUrls.size);

      for (const discovered of discoveredUrls) {
        if (remainingSlots <= 0) break;
        if (existingUrls.has(discovered.url)) continue;

        const discoveredUrl = new URL(discovered.url);
        const discoveredPage = await MonitoredPage.create({
          userId,
          workspaceId,
          url: discovered.url,
          title: `${title} ${discoveredUrl.pathname === '/' ? 'Home' : discoveredUrl.pathname}`,
          category,
          importance,
          checkInterval,
          crawlerConfig: {
            ...publicCrawlerConfig,
            discovery: {
              ...publicCrawlerConfig.discovery,
              enabled: false,
            },
          },
          crawlerAuthEncrypted,
          status: PageStatus.ACTIVE,
        });
        discoveredPages.push(discoveredPage);
        existingUrls.add(discovered.url);
        remainingSlots -= 1;
      }
    }
    
    // Log Audit Event
    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: userId,
      action: 'page.created',
      resourceId: page.id,
      metadata: { url, title },
      req
    });

    res.status(201).json(discoveredPages.length ? { page, discoveredPages } : page);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const discoverSite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context. Please select a workspace.' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('create', 'MonitoredPage');

    const urls = await discoverSiteUrls(req.body.url, {
      maxDepth: req.body.maxDepth,
      maxPages: req.body.maxPages,
      includeSubdomains: req.body.includeSubdomains,
      includeSitemaps: req.body.includeSitemaps,
      respectRobots: req.body.respectRobots,
    });

    res.json({ urls, count: urls.length });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const getCrawlerAuthSessions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context. Please select a workspace.' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'MonitoredPage');

    const sessions = await CrawlerAuthSession.find({ workspaceId })
      .sort({ updatedAt: -1 })
      .select('-storageStateEncrypted');

    res.json(sessions);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const createCrawlerAuthSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context. Please select a workspace.' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('create', 'MonitoredPage');

    const originUrl = await assertSafeScrapeUrl(req.body.origin);
    const session = await CrawlerAuthSession.create({
      userId,
      workspaceId,
      name: req.body.name,
      origin: originUrl.origin,
      storageStateEncrypted: encryptSecret(JSON.stringify(req.body.storageState)),
    });

    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: userId,
      action: 'crawler_auth_session.created',
      resourceId: session.id,
      metadata: { origin: originUrl.origin, name: req.body.name },
      req
    });

    res.status(201).json({
      _id: session.id,
      userId: session.userId,
      workspaceId: session.workspaceId,
      name: session.name,
      origin: session.origin,
      lastUsedAt: session.lastUsedAt,
      createdAt: (session as any).createdAt,
      updatedAt: (session as any).updatedAt,
    });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const deleteCrawlerAuthSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context. Please select a workspace.' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('delete', 'MonitoredPage');

    const session = await CrawlerAuthSession.findOneAndDelete({ _id: req.params.sessionId, workspaceId });
    if (!session) {
      return res.status(404).json({ error: 'Crawler auth session not found' });
    }

    res.json({ message: 'Crawler auth session deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const getPageDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;

    // CASL check
    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'MonitoredPage');

    const page = await MonitoredPage.findOne({ _id: id, workspaceId });
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const latestSnapshot = await Snapshot.findOne({ pageId: page.id, workspaceId }).sort({ createdAt: -1 });
    const latestDiff = await Diff.findOne({ pageId: page.id, workspaceId }).sort({ createdAt: -1 });

    res.json({ page, latestSnapshot, latestDiff });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const updatePage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;
    const updateData = { ...req.body };

    // CASL check
    ForbiddenError.from(req.ability!).throwUnlessCan('update', 'MonitoredPage');

    if (updateData.url) {
      await assertSafeScrapeUrl(updateData.url);
    }

    if (updateData.crawlerConfig) {
      const { publicCrawlerConfig, crawlerAuthEncrypted } = splitCrawlerConfig(updateData.crawlerConfig);
      updateData.crawlerConfig = publicCrawlerConfig;
      if (crawlerAuthEncrypted) {
        updateData.crawlerAuthEncrypted = crawlerAuthEncrypted;
      }
    }

    const page = await MonitoredPage.findOneAndUpdate(
      { _id: id, workspaceId },
      { $set: updateData },
      { new: true }
    );

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(page);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const deletePage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const workspaceId = req.workspaceId;

    // CASL check
    ForbiddenError.from(req.ability!).throwUnlessCan('delete', 'MonitoredPage');

    const page = await MonitoredPage.findOneAndDelete({ _id: id, workspaceId });
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    // Log Audit Event
    await logAuditEvent({
      workspaceId: workspaceId as string,
      actorId: req.user!.userId,
      action: 'page.deleted',
      resourceId: id,
      metadata: { url: page.url, title: page.title },
      req
    });

    res.json({ message: 'Page deleted successfully' });
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};

export const togglePageStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const workspaceId = req.workspaceId;

    // CASL check
    ForbiddenError.from(req.ability!).throwUnlessCan('update', 'MonitoredPage');

    const page = await MonitoredPage.findOneAndUpdate(
      { _id: id, workspaceId },
      { $set: { status } },
      { new: true }
    );

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(page);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};
