import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { NotificationType } from '@deltaora/shared-types';
import { sendEmail } from './email.service';
import { pageChangeNotificationEmail } from '../utils/emailTemplates';

export const createNotification = async (userId: string, pageId: string, summaryId: string, pageTitle: string, summaryText: string, pageUrl?: string) => {
  try {
    // 1. Create In-App Notification (always)
    await Notification.create({
      userId,
      pageId,
      summaryId,
      type: NotificationType.IN_APP,
      isRead: false
    });

    // 2. Send Email only if user has opted in (2026 GDPR/CAN-SPAM compliance)
    const user = await User.findById(userId);
    if (user && user.email && user.emailPreferences?.notifications !== false) {
      await sendEmail({
        to: user.email,
        subject: `Deltaora Alert: Changes on ${pageTitle}`,
        htmlContent: pageChangeNotificationEmail(pageTitle, pageUrl || '', summaryText, pageId),
      });
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};

