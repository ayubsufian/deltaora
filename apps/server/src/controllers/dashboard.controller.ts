import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { Diff } from '../models/Diff';
import { AISummary } from '../models/AISummary';
import { Notification } from '../models/Notification';
import { redis } from '../config/redis';
import { ForbiddenError } from '@casl/ability';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'MonitoredPage');

    const cacheKey = `dashboard:${workspaceId}`;

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
      MonitoredPage.countDocuments({ workspaceId }),
      MonitoredPage.countDocuments({ workspaceId, lastChecked: { $gte: today } }),
      Diff.countDocuments({ workspaceId }),
      AISummary.countDocuments({ workspaceId }),
      Notification.find({ userId: req.user!.userId }).sort({ createdAt: -1 }).limit(5)
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
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: error.message });
    }
    next(error);
  }
};
