import { Router } from 'express';
import { getTimeseriesStats } from '../controllers/stats.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/timeseries', getTimeseriesStats);

export default router;
