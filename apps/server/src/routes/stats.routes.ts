import { Router } from 'express';
import { getTimeseriesStats } from '../controllers/stats.controller';
import { requireAuth } from '../middleware/auth';
import { resolveAbility } from '../middleware/authorize';

const router = Router();

router.use(requireAuth);
router.use(resolveAbility);

router.get('/timeseries', getTimeseriesStats);

export default router;
