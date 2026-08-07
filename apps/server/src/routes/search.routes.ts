import { Router } from 'express';
import { search } from '../controllers/search.controller';
import { requireAuth } from '../middleware/auth';
import { resolveAbility } from '../middleware/authorize';

const router = Router();

router.use(requireAuth);
router.use(resolveAbility);

router.get('/', search);

export default router;
