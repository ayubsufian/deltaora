import { Request, Response, NextFunction } from 'express';
import { MonitoredPage } from '../models/MonitoredPage';
import { Diff } from '../models/Diff';
import { AISummary } from '../models/AISummary';
import mongoose from 'mongoose';

export const getTimeseriesStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;
    
    // First, find all user's pages
    const userPages = await MonitoredPage.find({ userId }).select('_id');
    const pageIds = userPages.map(p => p._id);
    
    if (pageIds.length === 0) {
      return res.json({ weekly: [], monthly: [] });
    }

    // Weekly stats (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const weeklyChanges = await Diff.aggregate([
      { $match: { pageId: { $in: pageIds }, createdAt: { $gte: sevenDaysAgo } } },
      { 
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          changes: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format weekly data for Recharts (Mon, Tue, etc.)
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const weekly = weeklyChanges.map(w => ({
      name: days[new Date(w._id).getDay()],
      changes: w.changes
    }));

    // Monthly stats (last 4 weeks grouped by week)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyChanges = await Diff.aggregate([
      { $match: { pageId: { $in: pageIds }, createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $isoWeek: "$createdAt" },
          changes: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Format monthly data
    const monthly = monthlyChanges.map((m, i) => ({
      name: `Week ${i + 1}`,
      changes: m.changes,
      summaries: Math.floor(m.changes * 0.8) // Approximation for now
    }));

    res.json({ weekly, monthly });
  } catch (error) {
    next(error);
  }
};
