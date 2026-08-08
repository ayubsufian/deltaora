import { Router } from 'express';
import authRoutes from './auth.routes';
import pagesRoutes from './pages.routes';
import notificationsRoutes from './notifications.routes';
import dashboardRoutes from './dashboard.routes';
import searchRoutes from './search.routes';
import historyRoutes from './history.routes';
import statsRoutes from './stats.routes';
import workspacesRoutes from './workspaces.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/workspaces', workspacesRoutes);
router.use('/pages', pagesRoutes);
router.use('/pages/:pageId', historyRoutes); // Mount nested history routes
router.use('/notifications', notificationsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/search', searchRoutes);
router.use('/stats', statsRoutes);

export default router;
