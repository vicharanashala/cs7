// /api/tags — tag CRUD. GET is public (login-page FAQ filters); writes require moderator/admin.
import { Router } from 'express';
import { tagCreateSchema, tagUpdateSchema } from '@samagama/shared';
import { tagController } from '../controllers/tag.controller.js';
import { optionalAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// Listing is public so the login-page FAQ browser can offer tag filters; the list controller
// only exposes inactive tags to signed-in admins. Writes stay gated below.
router.use(optionalAuth);
router.get('/', asyncHandler(tagController.list));
router.post(
  '/',
  requireRole('admin', 'moderator'),
  validate(tagCreateSchema),
  asyncHandler(tagController.create),
);
router.patch(
  '/:id',
  requireRole('admin', 'moderator'),
  validate(tagUpdateSchema),
  asyncHandler(tagController.update),
);
router.delete('/:id', requireRole('admin', 'moderator'), asyncHandler(tagController.delete));

export const tagRouter = router;
