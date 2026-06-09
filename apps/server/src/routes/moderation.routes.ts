// /api/moderation — moderator/admin dashboard actions: answer approval queue, personal-question
// responses, FAQ promotion, bulk operations, and the trash bin. Entire router is moderator/admin only.
import { Router } from 'express';
import { moderateAnswerSchema } from '@samagama/shared';
import { moderationController } from '../controllers/moderation.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(requireAuth, requireRole('moderator', 'admin'));

router.get('/pending-answers', asyncHandler(moderationController.listPending));
router.get(
  '/questions/:id/pending-answers',
  asyncHandler(moderationController.listPendingForQuestion),
);
router.post('/questions/:id/respond', asyncHandler(moderationController.respondToPersonal));
router.patch(
  '/answers/:id/approve',
  validate(moderateAnswerSchema),
  asyncHandler(moderationController.approveAnswer),
);
router.patch(
  '/answers/:id/reject',
  validate(moderateAnswerSchema),
  asyncHandler(moderationController.rejectAnswer),
);

// FAQ candidates (approved answers eligible for conversion)
router.get('/faq-candidates', asyncHandler(moderationController.listFaqCandidates));
router.post('/faq-candidates/:id/convert', asyncHandler(moderationController.convertToFaq));
router.patch('/answers/:id/mark-for-faq', asyncHandler(moderationController.markForFaq));

// Bulk operations
router.post('/bulk-approve', asyncHandler(moderationController.bulkApprove));
router.post('/bulk-reject', asyncHandler(moderationController.bulkReject));

router.post(
  '/questions/:id/convert-to-faq',
  asyncHandler(moderationController.convertQuestionToFaq),
);

// Trash — expired community posts
router.get('/trash', asyncHandler(moderationController.listTrash));
router.patch('/trash/:id/restore', asyncHandler(moderationController.restoreFromTrash));

export const moderationRouter = router;
