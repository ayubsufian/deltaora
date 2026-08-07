import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { Workspace } from '../models/Workspace';
import { PageStatus } from '@deltaora/shared-types';
import { ForbiddenError } from '@casl/ability';

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
    const { url, title, category, importance, checkInterval } = req.body;

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

    const page = new MonitoredPage({
      userId, // Audit trail: who created this page
      workspaceId,
      url,
      title,
      category,
      importance,
      checkInterval,
      status: PageStatus.ACTIVE,
    });

    await page.save();

    res.status(201).json(page);
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

    const latestSnapshot = await Snapshot.findOne({ pageId: page.id }).sort({ createdAt: -1 });
    const latestDiff = await Diff.findOne({ pageId: page.id }).sort({ createdAt: -1 });

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
    const updateData = req.body;

    // CASL check
    ForbiddenError.from(req.ability!).throwUnlessCan('update', 'MonitoredPage');

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
