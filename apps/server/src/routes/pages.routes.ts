import { Router } from 'express';
import { getPages, createPage, getPageDetails, updatePage, deletePage, togglePageStatus } from '../controllers/pages.controller';
import { requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPageSchema, updatePageSchema } from '@deltaora/validation';
import { z } from 'zod';

const router = Router();

router.use(requireAuth);

/**
 * @swagger
 * tags:
 *   name: Pages
 *   description: Monitored pages management
 */

/**
 * @swagger
 * /pages:
 *   get:
 *     summary: Get all monitored pages for the current user
 *     tags: [Pages]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of monitored pages
 */
router.get('/', getPages);

/**
 * @swagger
 * /pages:
 *   post:
 *     summary: Add a new page to monitor
 *     tags: [Pages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, url, category, checkInterval]
 *             properties:
 *               title:
 *                 type: string
 *               url:
 *                 type: string
 *                 format: uri
 *               category:
 *                 type: string
 *               checkInterval:
 *                 type: number
 *                 description: Check interval in minutes
 *     responses:
 *       201:
 *         description: Page added successfully
 */
router.post('/', validate(createPageSchema), createPage);

/**
 * @swagger
 * /pages/{id}:
 *   get:
 *     summary: Get page details including recent snapshots and diffs
 *     tags: [Pages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Page details
 */
router.get('/:id', getPageDetails);

/**
 * @swagger
 * /pages/{id}:
 *   put:
 *     summary: Update a monitored page
 *     tags: [Pages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Page updated successfully
 */
router.put('/:id', validate(updatePageSchema), updatePage);

/**
 * @swagger
 * /pages/{id}:
 *   delete:
 *     summary: Delete a monitored page
 *     tags: [Pages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Page deleted successfully
 */
router.delete('/:id', deletePage);

/**
 * @swagger
 * /pages/{id}/status:
 *   patch:
 *     summary: Toggle page monitoring status (active/paused)
 *     tags: [Pages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [active, paused]
 *     responses:
 *       200:
 *         description: Status updated
 */
router.patch('/:id/status', validate(z.object({ status: z.enum(['active', 'paused']) })), togglePageStatus);

export default router;
