import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { NotificationType } from '@deltaora/shared-types';
import { sendNotificationEmail } from './email.service';

export const createNotification = async (userId: string, pageId: string, summaryId: string, pageTitle: string, summaryText: string) => {
  try {
    // 1. Create In-App Notification
    await Notification.create({
      userId,
      pageId,
      summaryId,
      type: NotificationType.IN_APP,
      isRead: false
    });

    // 2. Send Email (could check user preferences here in the future)
    const user = await User.findById(userId);
    if (user && user.email) {
      await sendNotificationEmail(user.email, pageTitle, summaryText);
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};
