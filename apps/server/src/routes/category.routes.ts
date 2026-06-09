// /api/categories — category CRUD. GET is public (login-page FAQ filters); writes require moderator/admin.
import { Router } from 'express';
import { categoryCreateSchema, categoryUpdateSchema } from '@samagama/shared';
import { categoryController } from '../controllers/category.controller.js';
import { optionalAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// Listing is public so the login-page FAQ browser can offer category filters; the list
// controller only exposes inactive categories to signed-in admins. Writes stay gated below.
router.use(optionalAuth);
router.get('/', asyncHandler(categoryController.list));
router.post(
  '/',
  requireRole('admin', 'moderator'),
  validate(categoryCreateSchema),
  asyncHandler(categoryController.create),
);
router.patch(
  '/:id',
  requireRole('admin', 'moderator'),
  validate(categoryUpdateSchema),
  asyncHandler(categoryController.update),
);
router.delete('/:id', requireRole('admin', 'moderator'), asyncHandler(categoryController.delete));

export const categoryRouter = router;
