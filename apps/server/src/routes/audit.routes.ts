// Audit log routes — admin only.
import { Router } from 'express';
import { auditController } from '../controllers/audit.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/', asyncHandler(auditController.list));

export const auditRouter = router;
