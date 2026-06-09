// Read-only metrics endpoints. Each route picks its own role gate.
import { Router } from 'express';
import { statsController } from '../controllers/stats.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(requireAuth);

// Moderator/admin metrics.
router.get('/faqs', requireRole('moderator', 'admin'), asyncHandler(statsController.getFaqStats));
router.get(
  '/moderator',
  requireRole('moderator', 'admin'),
  asyncHandler(statsController.getModeratorStats),
);

// Student dashboard metrics.
router.get('/student', requireRole('student'), asyncHandler(statsController.getStudentStats));
router.get(
  '/student-dashboard',
  requireRole('student'),
  asyncHandler(statsController.getStudentDashboard),
);

// Spurti Points leaderboard — students only (moderators/admins don't accumulate points).
router.get('/leaderboard', requireRole('student'), asyncHandler(statsController.getLeaderboard));
// Expand one collapsed gap range on the leaderboard.
router.get(
  '/leaderboard/range',
  requireRole('student'),
  asyncHandler(statsController.getLeaderboardRange),
);

// Idle-bucket counts for the community queue. Available to all authenticated roles.
router.get('/community-idle', asyncHandler(statsController.getCommunityIdle));

// Admin intelligence overview — admin only.
router.get(
  '/admin-intelligence',
  requireRole('admin'),
  asyncHandler(statsController.getAdminIntelligence),
);

// Consolidated Admin Dashboard — moderator/admin (shared dashboard surface).
router.get(
  '/admin-dashboard',
  requireRole('moderator', 'admin'),
  asyncHandler(statsController.getAdminDashboard),
);

// Per-moderator performance — admin only.
router.get(
  '/moderation-load',
  requireRole('admin'),
  asyncHandler(statsController.getModerationLoad),
);

// Personal moderator stats — moderator/admin only.
router.get(
  '/moderator-personal',
  requireRole('moderator', 'admin'),
  asyncHandler(statsController.getModeratorPersonal),
);

// FAQ quality scores — admin/moderator only.
router.get(
  '/faq-quality',
  requireRole('moderator', 'admin'),
  asyncHandler(statsController.getFaqQuality),
);

// Daily vote trend for the last 7 days — moderator/admin only.
router.get(
  '/votes-trend',
  requireRole('moderator', 'admin'),
  asyncHandler(statsController.getVotesTrend),
);

export const statsRouter = router;
