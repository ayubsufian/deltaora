import { Router } from 'express';
import { getSnapshots, getDiffs, getSummaries } from '../controllers/history.controller';
import { requireAuth } from '../middleware/auth';

const router = Router({ mergeParams: true }); // mergeParams to access :pageId from parent

router.use(requireAuth);

router.get('/snapshots', getSnapshots);
router.get('/diffs', getDiffs);
router.get('/summaries', getSummaries);

export default router;
