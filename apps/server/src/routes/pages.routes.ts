import { Router } from 'express';
import { getPages, createPage, getPageDetails, updatePage, deletePage, togglePageStatus } from '../controllers/pages.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPageSchema, updatePageSchema } from '@deltaora/validation';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);

router.get('/', getPages);
router.post('/', validate(createPageSchema), createPage);
router.get('/:id', getPageDetails);
router.put('/:id', validate(updatePageSchema), updatePage);
router.delete('/:id', deletePage);
router.patch('/:id/status', validate(z.object({ status: z.enum(['active', 'paused']) })), togglePageStatus);

export default router;
