import { Router } from 'express';
import { getSnapshots, getDiffs, getSummaries } from '../controllers/history.controller';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth';
import { resolveAbility } from '../middleware/authorize';

const router = Router({ mergeParams: true }); // mergeParams to access :pageId from parent

router.use(requireAuth);
router.use(requireVerifiedEmail);
router.use(resolveAbility);

router.get('/snapshots', getSnapshots);
router.get('/diffs', getDiffs);
router.get('/summaries', getSummaries);

export default router;
