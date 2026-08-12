import { Router } from 'express';
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from '../controllers/notifications.controller';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.use(requireVerifiedEmail);

router.get('/', getNotifications);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

export default router;
