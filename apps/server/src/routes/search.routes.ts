import { Router } from 'express';
import { search } from '../controllers/search.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', search);

export default router;
