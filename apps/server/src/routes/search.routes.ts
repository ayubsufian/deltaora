import { Router } from 'express';
import { search } from '../controllers/search.controller';
import { requireAuth, requireVerifiedEmail } from '../middleware/auth';
import { resolveAbility } from '../middleware/authorize';

const router = Router();

router.use(requireAuth);
router.use(requireVerifiedEmail);
router.use(resolveAbility);

router.get('/', search);

export default router;
