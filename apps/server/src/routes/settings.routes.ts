// /api/settings — global system settings. Readable by any authenticated user; writable by admins only.
import { Router } from 'express';
import { settingsUpdateSchema } from '@samagama/shared';
import { settingsController } from '../controllers/settings.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// Any authenticated user may read settings (students need communityAnswerCap for UI).
router.get('/', requireAuth, asyncHandler(settingsController.get));

// Only admins may change settings. Validate the body against the shared schema so
// out-of-range values and unknown keys are rejected before they reach the database.
router.patch(
  '/',
  requireAuth,
  requireRole('admin'),
  validate(settingsUpdateSchema),
  asyncHandler(settingsController.update),
);

export const settingsRouter = router;
