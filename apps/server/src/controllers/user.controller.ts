import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';

export const getPreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const user = await User.findById(userId).select('emailPreferences');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ emailPreferences: user.emailPreferences });
  } catch (error) {
    next(error);
  }
};

export const updatePreferences = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const { marketing, notifications } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (typeof marketing === 'boolean') {
      user.emailPreferences.marketing = marketing;
    }
    if (typeof notifications === 'boolean') {
      user.emailPreferences.notifications = notifications;
    }

    await user.save();

    res.json({ message: 'Preferences updated successfully', emailPreferences: user.emailPreferences });
  } catch (error) {
    next(error);
  }
};
