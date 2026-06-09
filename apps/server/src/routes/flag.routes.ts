// /api/flags — content flagging. Any authenticated user can raise a flag; listing and
// status changes are moderator/admin only.
import { Router } from 'express';
import { flagCreateSchema, flagListQuerySchema, flagUpdateStatusSchema } from '@samagama/shared';
import { flagController } from '../controllers/flag.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(requireAuth);

// Any authenticated user can create or amend their own flag.
router.post('/', validate(flagCreateSchema), asyncHandler(flagController.create));

// Listing and status updates are moderator/admin only.
router.get(
  '/',
  requireRole('moderator', 'admin'),
  validate(flagListQuerySchema, 'query'),
  asyncHandler(flagController.list),
);
router.patch(
  '/:id/status',
  requireRole('moderator', 'admin'),
  validate(flagUpdateStatusSchema),
  asyncHandler(flagController.updateStatus),
);

export const flagRouter = router;
