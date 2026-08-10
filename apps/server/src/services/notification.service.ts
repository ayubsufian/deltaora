import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { NotificationType } from '@deltaora/shared-types';
import { sendEmail } from './email.service';

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
      await sendEmail({
        to: user.email,
        subject: `Deltaora Alert: Changes on ${pageTitle}`,
        htmlContent: `
          <h2>Changes detected on ${pageTitle}</h2>
          <p>${summaryText}</p>
          <a href="http://localhost:5173/pages/${pageId}">View Details</a>
        `
      });
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};
