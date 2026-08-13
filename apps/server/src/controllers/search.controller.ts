import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { AISummary } from '../models/AISummary';
import { redis } from '../config/redis';
import { ForbiddenError } from '@casl/ability';

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = req.workspaceId;
    const query = req.query.q as string;

    if (!query) {
      return res.json({ urls: [], summaries: [] });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'No workspace context' });
    }

    // CASL check
    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'MonitoredPage');

    const cacheKey = `search:${workspaceId}:${query}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      await redis.zincrby('top-searches', 1, query);
      return res.json(JSON.parse(cached));
    }

    // Find URLs scoped to workspace
    const urls = await MonitoredPage.find({
      workspaceId,
      $or: [
        { url: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);

    const summaries = await AISummary.find({
      workspaceId,
      summary: { $regex: query, $options: 'i' }
    }).limit(10);

    const result = { urls, summaries };

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    
    // Track popular search
    await redis.zincrby('top-searches', 1, query);

    res.json(result);
  } catch (error: unknown) {
    if (error instanceof ForbiddenError) {
      return res.status(403).json({ error: 'Forbidden', message: (error as ForbiddenError<any>).message });
    }
    next(error);
  }
};
