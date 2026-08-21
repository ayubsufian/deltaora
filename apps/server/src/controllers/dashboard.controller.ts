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

    const statsCacheKey = `dashboard:stats:${workspaceId}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Try workspace-scoped stats from cache first
    let workspaceStats: Record<string, unknown>;
    const cachedStats = await redis.get(statsCacheKey);

    if (cachedStats) {
      workspaceStats = JSON.parse(cachedStats);
    } else {
      // Run workspace-scoped aggregations in parallel
      const [totalPages, checkedToday, totalChanges, summariesGenerated] = await Promise.all([
        MonitoredPage.countDocuments({ workspaceId }),
        MonitoredPage.countDocuments({ workspaceId, lastChecked: { $gte: today } }),
        Diff.countDocuments({ workspaceId }),
        AISummary.countDocuments({ workspaceId }),
      ]);

      workspaceStats = { totalPages, checkedToday, totalChanges, summariesGenerated };

      // Cache workspace stats for 10 minutes (safe — no user-specific data)
      await redis.set(statsCacheKey, JSON.stringify(workspaceStats), 'EX', 600);
    }

    // User-specific notifications are NEVER cached under a shared workspace key
    const latestNotifications = await Notification.find({ userId: req.user!.userId })
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({ ...workspaceStats, latestNotifications });
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: error.message });
    }
    next(error);
  }
};
