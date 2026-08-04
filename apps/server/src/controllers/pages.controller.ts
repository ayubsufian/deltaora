import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { PageStatus } from '@deltaora/shared-types';

export const getPages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { category, status, importance, search, startDate, endDate } = req.query;

    const query: any = { userId };

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
  } catch (error) {
    next(error);
  }
};

export const createPage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const { url, title, category, importance, checkInterval } = req.body;

    const existing = await MonitoredPage.findOne({ userId, url });
    if (existing) {
      return res.status(409).json({ error: 'URL is already being monitored by you' });
    }

    const page = new MonitoredPage({
      userId,
      url,
      title,
      category,
      importance,
      checkInterval,
      status: PageStatus.ACTIVE,
    });

    await page.save();

    // Trigger initial check via BullMQ (to be added)

    res.status(201).json(page);
  } catch (error) {
    next(error);
  }
};

export const getPageDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const page = await MonitoredPage.findOne({ _id: id, userId });
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const latestSnapshot = await Snapshot.findOne({ pageId: page.id }).sort({ createdAt: -1 });
    const latestDiff = await Diff.findOne({ pageId: page.id }).sort({ createdAt: -1 });

    res.json({ page, latestSnapshot, latestDiff });
  } catch (error) {
    next(error);
  }
};

export const updatePage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;
    const updateData = req.body;

    const page = await MonitoredPage.findOneAndUpdate(
      { _id: id, userId },
      { $set: updateData },
      { new: true }
    );

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(page);
  } catch (error) {
    next(error);
  }
};

export const deletePage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user!.userId;

    const page = await MonitoredPage.findOneAndDelete({ _id: id, userId });
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Also delete snapshots, diffs, etc. in a background job or transaction
    // await Snapshot.deleteMany({ pageId: id });
    // await Diff.deleteMany({ pageId: id });

    res.json({ message: 'Page deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const togglePageStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'active' or 'paused'
    const userId = req.user!.userId;

    const page = await MonitoredPage.findOneAndUpdate(
      { _id: id, userId },
      { $set: { status } },
      { new: true }
    );

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(page);
  } catch (error) {
    next(error);
  }
};
