import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { Diff } from '../models/Diff';
import { AISummary } from '../models/AISummary';
import { Notification } from '../models/Notification';
import { redis } from '../config/redis';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const cacheKey = `dashboard:${userId}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Run aggregations in parallel
    const [
      totalPages,
      checkedToday,
      totalChanges,
      summariesGenerated,
      latestNotifications
    ] = await Promise.all([
      MonitoredPage.countDocuments({ userId }),
      MonitoredPage.countDocuments({ userId, lastChecked: { $gte: today } }),
      // To count diffs for user's pages, we need pageIds first
      MonitoredPage.find({ userId }).select('_id').then(pages => {
        const pageIds = pages.map(p => p._id);
        return Diff.countDocuments({ pageId: { $in: pageIds } });
      }),
      MonitoredPage.find({ userId }).select('_id').then(async pages => {
        const pageIds = pages.map(p => p._id);
        const diffs = await Diff.find({ pageId: { $in: pageIds } }).select('_id');
        const diffIds = diffs.map(d => d._id);
        return AISummary.countDocuments({ diffId: { $in: diffIds } });
      }),
      Notification.find({ userId }).sort({ createdAt: -1 }).limit(5)
    ]);

    const stats = {
      totalPages,
      checkedToday,
      totalChanges,
      summariesGenerated,
      latestNotifications
    };

    // Cache for 10 minutes
    await redis.set(cacheKey, JSON.stringify(stats), 'EX', 600);

    res.json(stats);
  } catch (error) {
    next(error);
  }
};
