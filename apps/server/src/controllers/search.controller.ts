import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { AISummary } from '../models/AISummary';
import { Diff } from '../models/Diff';
import { redis } from '../config/redis';

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    const query = req.query.q as string;

    if (!query) {
      return res.json({ urls: [], summaries: [] });
    }

    const cacheKey = `search:${userId}:${query}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      // Background: Track popular search terms
      await redis.zincrby('top-searches', 1, query);
      return res.json(JSON.parse(cached));
    }

    // Find URLs
    const urls = await MonitoredPage.find({
      userId,
      $or: [
        { url: { $regex: query, $options: 'i' } },
        { title: { $regex: query, $options: 'i' } }
      ]
    }).limit(10);

    // Find Summaries (requires joining through Diffs and Pages)
    // First, find all user's pages
    const userPages = await MonitoredPage.find({ userId }).select('_id');
    const pageIds = userPages.map(p => p._id);
    
    // Then find diffs for those pages
    const diffs = await Diff.find({ pageId: { $in: pageIds } }).select('_id');
    const diffIds = diffs.map(d => d._id);

    // Finally search summaries for those diffs
    const summaries = await AISummary.find({
      diffId: { $in: diffIds },
      summary: { $regex: query, $options: 'i' }
    }).limit(10);

    const result = { urls, summaries };

    // Cache for 5 minutes
    await redis.set(cacheKey, JSON.stringify(result), 'EX', 300);
    
    // Track popular search
    await redis.zincrby('top-searches', 1, query);

    res.json(result);
  } catch (error) {
    next(error);
  }
};
