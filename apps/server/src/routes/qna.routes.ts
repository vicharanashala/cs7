// /api/qna — community Q&A: the Ask flow (existing-answer check → create), question/answer
// listing, answer submission, and voting. All routes require auth (any role).
import { Router } from 'express';
import {
  answerCreateSchema,
  checkExistingSchema,
  questionCreateSchema,
  tagMeSchema,
} from '@samagama/shared';
import { qnaController } from '../controllers/qna.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(requireAuth);

// --- Existing-answer check + question lifecycle ---
router.post(
  '/check-existing',
  validate(checkExistingSchema),
  asyncHandler(qnaController.checkExisting),
);
router.post(
  '/questions',
  validate(questionCreateSchema),
  asyncHandler(qnaController.createQuestion),
);
router.get('/questions', asyncHandler(qnaController.listQuestions));
router.get('/questions/:id', asyncHandler(qnaController.getQuestion));
router.post('/questions/:id/tag-me', validate(tagMeSchema), asyncHandler(qnaController.tagMe));

// --- Answers ---
router.get('/questions/:id/answers', asyncHandler(qnaController.listAnswers));
router.post(
  '/questions/:id/answers',
  validate(answerCreateSchema),
  asyncHandler(qnaController.submitAnswer),
);
router.post('/answers/:id/vote/:direction', asyncHandler(qnaController.voteAnswer));

export const qnaRouter = router;
