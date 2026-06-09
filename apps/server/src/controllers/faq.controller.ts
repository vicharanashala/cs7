// FAQ HTTP layer. Delegates to faqService; role/userId are threaded through so the
// service can scope visibility (e.g. students only see published FAQs).
import type { Request, Response } from 'express';
import type {
  FaqCreateInput,
  FaqFeedbackInput,
  FaqListQuery,
  FaqUpdateInput,
  UserRole,
} from '@samagama/shared';
import { faqService } from '../services/faq.service.js';
import { created, noContent, ok } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';

// Matches a Mongo ObjectId string — the shape the client's anon id must take so it can
// slot into the existing ObjectId-keyed vote arrays without a separate code path.
const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/**
 * Resolve who is acting on a public FAQ route. A signed-in user keeps their real role and id.
 * An anonymous caller is treated as a `student` (so they see only published FAQs and get
 * per-visitor vote state), identified by a stable `X-Anon-Id` header the client persists.
 * The header is only trusted when it's ObjectId-shaped; otherwise the caller is anonymous
 * with no vote identity.
 */
function resolveFaqActor(req: Request): { role: UserRole; userId?: string } {
  if (req.user) return { role: req.user.role, userId: req.user.id };
  const anon = req.header('x-anon-id');
  const userId = anon && OBJECT_ID_RE.test(anon) ? anon.toLowerCase() : undefined;
  return { role: 'student', userId };
}

export const faqController = {
  // Paginated, filterable FAQ list. Returns items plus pagination meta. Public — anonymous
  // callers are scoped to published FAQs (resolved as a student).
  async list(req: Request, res: Response) {
    const { role, userId } = resolveFaqActor(req);
    const result = await faqService.list({
      query: req.query as unknown as FaqListQuery,
      role,
      userId,
    });
    return ok(res, result.items, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / result.pageSize)),
    });
  },

  // Fetch a single FAQ by id (visibility enforced in the service by role). Public.
  async getById(req: Request, res: Response) {
    const { role, userId } = resolveFaqActor(req);
    const faq = await faqService.getById(req.params.id!, role, userId);
    return ok(res, faq);
  },

  // Create a new FAQ (moderator/admin). Returns just the new id.
  async create(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const doc = await faqService.create(req.body as FaqCreateInput, req.user.id);
    return created(res, { id: doc.id });
  },

  // Update an FAQ. If the answer text changed, the service resets helpfulness stats
  // (statsReset=true) and we auto-resolve any open flags below, since the content is now fresh.
  async update(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const { faq, statsReset } = await faqService.update(
      req.params.id!,
      req.body as FaqUpdateInput,
      req.user.id,
    );
    // Resolve outstanding flags whenever the flag count was zeroed — either because the
    // answer was amended (statsReset) or a moderator explicitly reset flags. Otherwise the
    // Flag collection stays out of sync with the now-zero flagCount, leaving the FAQ stuck
    // in the flag inbox / Flagged filter.
    const flagsReset = statsReset || (req.body as FaqUpdateInput).resetFlags === true;
    if (flagsReset) {
      // Fire-and-forget — does not block the response, but we await import for type safety.
      const { FlagModel } = await import('../models/Flag.model.js');
      void FlagModel.updateMany(
        { entityType: 'faq', entityId: faq._id, status: { $in: ['open', 'under_review'] } },
        {
          $set: {
            status: 'resolved',
            reviewedBy: req.user.id,
            resolutionNote: statsReset
              ? 'Resolved automatically after FAQ answer was edited.'
              : 'Resolved automatically after a moderator reset the flag count.',
          },
        },
      );
    }
    return ok(res, { id: faq.id, statsReset });
  },

  // Delete an FAQ (moderator/admin).
  async delete(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    await faqService.delete(req.params.id!);
    return noContent(res);
  },

  // Record that the caller opened this FAQ (drives view counts + recently-viewed). Public:
  // an anonymous caller still bumps the view count; the per-user recently-viewed list is
  // skipped when there's no real user behind the id.
  async recordView(req: Request, res: Response) {
    const { userId } = resolveFaqActor(req);
    await faqService.recordView(req.params.id!, userId);
    return noContent(res);
  },

  // Record a helpful/not-helpful rating on an FAQ. Public — anonymous voters are tracked by
  // their stable X-Anon-Id so toggling/switching a vote behaves the same as a signed-in user.
  async submitFeedback(req: Request, res: Response) {
    const { userId } = resolveFaqActor(req);
    if (!userId) throw ApiError.badRequest('Voting requires a session or an anonymous id');
    const { rating } = req.body as FaqFeedbackInput;
    const result = await faqService.submitFeedback(req.params.id!, userId, rating);
    return ok(res, result);
  },

  // The current user's recently-viewed FAQs.
  async recentlyViewed(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    return ok(res, await faqService.getRecentlyViewed(req.user.id, req.user.role));
  },

  /** POST /api/faqs/check-similar — mirrors remote POST /api/faqs/check-similar. */
  async checkSimilarity(req: Request, res: Response) {
    const { title, limit, threshold } = req.body as {
      title: string;
      limit?: number;
      threshold?: number;
    };
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      throw ApiError.badRequest('title must be at least 3 characters');
    }
    const results = await faqService.checkSimilarity(title.trim(), { limit, threshold });
    return ok(res, results);
  },
};
