import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { AISummary } from '../models/AISummary';

// Helper to verify user owns the page
const verifyPageOwnership = async (pageId: string, userId: string) => {
  const page = await MonitoredPage.findOne({ _id: pageId, userId });
  if (!page) throw new Error('Unauthorized or Page not found');
};

export const getSnapshots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;
    const userId = req.user!.userId;
    
    await verifyPageOwnership(pageId, userId);

    const snapshots = await Snapshot.find({ pageId }).sort({ createdAt: -1 });
    res.json(snapshots);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
};

export const getDiffs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;
    const userId = req.user!.userId;
    
    await verifyPageOwnership(pageId, userId);

    const diffs = await Diff.find({ pageId }).sort({ createdAt: -1 });
    res.json(diffs);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
};

export const getSummaries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;
    const userId = req.user!.userId;
    
    await verifyPageOwnership(pageId, userId);

    // Get all diffs for the page first
    const diffs = await Diff.find({ pageId }).select('_id');
    const diffIds = diffs.map(d => d._id);

    const summaries = await AISummary.find({ diffId: { $in: diffIds } }).sort({ createdAt: -1 });
    res.json(summaries);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
};
