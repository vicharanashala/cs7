// Chatbot routes — Phase 6 (Yaksha RAG chatbot).
//   Student routes:  POST /chat/query, GET /chat/session/:id, POST /chat/feedback
//   Admin/mod routes: GET /chat/feedback, GET /chat/feedback/stats
import { Router } from 'express';
import { chatbotController } from '../controllers/chatbot.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';
import {
  chatQuerySchema,
  chatFeedbackSchema,
  chatRetractFeedbackSchema,
  updateFeedbackStatusSchema,
} from '@samagama/shared';

const router = Router();

router.use(requireAuth);

// ── Student-facing ────────────────────────────────────────────────────────────
router.post(
  '/query',
  requireRole('student', 'moderator', 'admin'),
  validate(chatQuerySchema),
  asyncHandler(chatbotController.sendMessage),
);

// Auto-restore the caller's current conversation thread (resolved by userId).
router.get(
  '/active',
  requireRole('student', 'moderator', 'admin'),
  asyncHandler(chatbotController.getActiveSession),
);

// "Clear / Start new" — close the active thread so the next message opens a fresh one.
router.post(
  '/new',
  requireRole('student', 'moderator', 'admin'),
  asyncHandler(chatbotController.startNewSession),
);

router.get(
  '/session/:sessionId',
  requireRole('student', 'moderator', 'admin'),
  asyncHandler(chatbotController.getSession),
);

router.post(
  '/stream/:sessionId?',
  requireRole('student', 'moderator', 'admin'),
  asyncHandler(chatbotController.streamMessage),
);

router.post(
  '/feedback',
  requireRole('student', 'moderator', 'admin'),
  validate(chatFeedbackSchema),
  asyncHandler(chatbotController.submitFeedback),
);

router.post(
  '/feedback/retract',
  requireRole('student', 'moderator', 'admin'),
  validate(chatRetractFeedbackSchema),
  asyncHandler(chatbotController.retractFeedback),
);

// ── Admin / moderator read paths ──────────────────────────────────────────────
router.get(
  '/feedback/stats',
  requireRole('moderator', 'admin'),
  asyncHandler(chatbotController.getStats),
);
router.get(
  '/feedback',
  requireRole('moderator', 'admin'),
  asyncHandler(chatbotController.listFeedback),
);

// ── Admin / moderator write paths ─────────────────────────────────────────────
router.patch(
  '/feedback/:id',
  requireRole('moderator', 'admin'),
  validate(updateFeedbackStatusSchema),
  asyncHandler(chatbotController.updateFeedbackStatus),
);

router.delete(
  '/feedback/:id',
  requireRole('admin'),
  asyncHandler(chatbotController.deleteFeedback),
);

export const chatbotRouter = router;
