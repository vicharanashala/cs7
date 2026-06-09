// /api/faqs — FAQ browsing/feedback (any authenticated user) and FAQ authoring
// (create/update/delete + similarity check, moderator/admin only).
import { Router } from 'express';
import {
  faqCreateSchema,
  faqFeedbackSchema,
  faqListQuerySchema,
  faqUpdateSchema,
} from '@samagama/shared';
import { faqController } from '../controllers/faq.controller.js';
import { optionalAuth, requireAuth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

// Browsing/viewing/voting FAQs is public so the curated FAQs can be read — and rated
// anonymously — straight from the login page. `optionalAuth` still attaches the signed-in
// user when a token is present, so logged-in behaviour (per-user vote state) is unchanged.
// Authoring and personal endpoints below re-assert auth explicitly.
router.use(optionalAuth);

// Recently-viewed lives under /api/faqs/recent — a fixed segment so it doesn't conflict with /:id.
// Personal feed — requires a signed-in user.
router.get('/recent', requireAuth, asyncHandler(faqController.recentlyViewed));

// Public reads: list + single FAQ (service scopes anonymous callers to published only).
router.get('/', validate(faqListQuerySchema, 'query'), asyncHandler(faqController.list));
router.get('/:id', asyncHandler(faqController.getById));

router.post(
  '/',
  requireRole('admin', 'moderator'),
  validate(faqCreateSchema),
  asyncHandler(faqController.create),
);
router.patch(
  '/:id',
  requireRole('admin', 'moderator'),
  validate(faqUpdateSchema),
  asyncHandler(faqController.update),
);
router.delete('/:id', requireRole('admin', 'moderator'), asyncHandler(faqController.delete));

// View + feedback are public; anonymous callers are identified by a stable X-Anon-Id header
// so vote toggling and per-visitor vote state work without an account.
router.post('/:id/view', asyncHandler(faqController.recordView));
router.post(
  '/:id/feedback',
  validate(faqFeedbackSchema),
  asyncHandler(faqController.submitFeedback),
);

// Similarity check — mirrors remote POST /api/faqs/check-similar.
router.post(
  '/check-similar',
  requireRole('admin', 'moderator'),
  asyncHandler(faqController.checkSimilarity),
);

export const faqRouter = router;
