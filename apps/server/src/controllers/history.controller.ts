import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { AISummary } from '../models/AISummary';
import { ForbiddenError } from '@casl/ability';

const verifyPageAccess = async (req: Request, pageId: string) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) throw new Error('No workspace context');

  ForbiddenError.from(req.ability!).throwUnlessCan('read', 'MonitoredPage');

  const page = await MonitoredPage.findOne({ _id: pageId, workspaceId });
  if (!page) throw new Error('Unauthorized or Page not found');
  return { page, workspaceId };
};

export const getSnapshots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;
    const { workspaceId } = await verifyPageAccess(req, pageId);
    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'Snapshot');

    const snapshots = await Snapshot.find({ pageId, workspaceId }).sort({ createdAt: -1 });
    res.json(snapshots);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
};

export const getDiffs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;
    const { workspaceId } = await verifyPageAccess(req, pageId);
    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'Diff');

    const diffs = await Diff.find({ pageId, workspaceId }).sort({ createdAt: -1 });
    res.json(diffs);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
};

export const getSummaries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;
    const { workspaceId } = await verifyPageAccess(req, pageId);
    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'AISummary');

    // Get all diffs for the page first
    const diffs = await Diff.find({ pageId, workspaceId }).select('_id');
    const diffIds = diffs.map(d => d._id);

    const summaries = await AISummary.find({ workspaceId, diffId: { $in: diffIds } }).sort({ createdAt: -1 });
    res.json(summaries);
  } catch (error) {
    res.status(403).json({ error: (error as Error).message });
  }
};
