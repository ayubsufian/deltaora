import { Notification } from '../models/Notification';
import { User } from '../models/User';
import { NotificationType } from '@deltaora/shared-types';
import { sendEmail } from './email.service';
import { pageChangeNotificationEmail } from '../utils/emailTemplates';
import { env } from '../config/env';

const importanceRank: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };

export const createNotification = async (
  userId: string,
  pageId: string,
  summaryId: string,
  pageTitle: string,
  summaryText: string,
  pageUrl?: string,
  changeImportance?: number,
) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Check user's minimum importance preference
    const userMinImportance = importanceRank[user.emailPreferences?.minimumImportance ?? 'medium'] ?? 1;
    if (changeImportance !== undefined && changeImportance < userMinImportance) {
      return; // Skip notification — below user's threshold
    }

    // 1. Create In-App Notification (if user has in-app notifications enabled)
    if (user.emailPreferences?.inApp !== false) {
      await Notification.create({
        userId,
        pageId,
        summaryId,
        type: NotificationType.IN_APP,
        isRead: false,
        title: `Change detected: ${pageTitle}`,
        message: summaryText.length > 200 ? summaryText.substring(0, 200) + '...' : summaryText,
      });
    }

    // 2. Send Email only if user has opted in (2026 GDPR/CAN-SPAM compliance)
    if (user.email && user.emailPreferences?.notifications !== false) {
      await sendEmail({
        to: user.email,
        subject: `Deltaora Alert: Changes on ${pageTitle}`,
        htmlContent: pageChangeNotificationEmail(pageTitle, pageUrl || '', summaryText, pageId, env.CLIENT_URL),
      });
    }
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};
