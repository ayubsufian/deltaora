import { Router } from 'express';
import { getDashboardStats } from '../controllers/dashboard.controller';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth';
import { resolveAbility } from '../middleware/authorize';

const router = Router();

router.use(requireAuth);
router.use(requireVerifiedEmail);
router.use(resolveAbility);

router.get('/', getDashboardStats);

export default router;
