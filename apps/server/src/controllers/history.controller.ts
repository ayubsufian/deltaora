import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { Snapshot } from '../models/Snapshot';
import { Diff } from '../models/Diff';
import { AISummary } from '../models/AISummary';
import { ForbiddenError } from '@casl/ability';

class HttpError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

const verifyPageAccess = async (req: Request, pageId: string) => {
  const workspaceId = req.workspaceId;
  if (!workspaceId) {
    throw new HttpError('No workspace context', 400);
  }

  ForbiddenError.from(req.ability!).throwUnlessCan('read', 'MonitoredPage');

  const page = await MonitoredPage.findOne({ _id: pageId, workspaceId });
  if (!page) {
    throw new HttpError('Page not found', 404);
  }
  return { page, workspaceId };
};

const handleHistoryError = (error: unknown, res: Response, next: NextFunction) => {
  if (error instanceof ForbiddenError) {
    return res.status(403).json({ error: 'Forbidden', message: error.message });
  }
  if (error instanceof HttpError) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  next(error);
};

export const getSnapshots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pageId } = req.params;
    const { workspaceId } = await verifyPageAccess(req, pageId);
    ForbiddenError.from(req.ability!).throwUnlessCan('read', 'Snapshot');

    const snapshots = await Snapshot.find({ pageId, workspaceId }).sort({ createdAt: -1 });
    res.json(snapshots);
  } catch (error) {
    handleHistoryError(error, res, next);
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
    handleHistoryError(error, res, next);
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
    handleHistoryError(error, res, next);
  }
};
