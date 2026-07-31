import { Router } from 'express';
import authRoutes from './auth.routes';
import pagesRoutes from './pages.routes';
import notificationsRoutes from './notifications.routes';
import dashboardRoutes from './dashboard.routes';
import searchRoutes from './search.routes';
import historyRoutes from './history.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/pages', pagesRoutes);
router.use('/pages/:pageId', historyRoutes); // Mount nested history routes
router.use('/notifications', notificationsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/search', searchRoutes);

export default router;
