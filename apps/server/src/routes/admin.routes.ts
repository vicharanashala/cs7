// Admin analytics routes. Mirrors remote adminRoutes.js.
// All routes require admin role — router-level guard applied once.
import { Router } from 'express';
import { adminController } from '../controllers/admin.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(requireAuth, requireRole('admin'));

router.get('/overview', asyncHandler(adminController.getOverview));
router.get('/issue-heatmap', asyncHandler(adminController.getIssueHeatmap));
router.get('/unanswered-searches', asyncHandler(adminController.getUnansweredSearches));
router.get('/faq-quality', asyncHandler(adminController.getFaqQuality));
router.get('/moderation-load', asyncHandler(adminController.getModerationLoad));
router.get('/audit-logs', asyncHandler(adminController.getAuditLogs));

export const adminRouter = router;
