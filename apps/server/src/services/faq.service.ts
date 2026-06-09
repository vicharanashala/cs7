// FAQ domain service.
//
// Responsibilities:
//  - CRUD with status transitions (draft -> published -> outdated)
//  - List/search with hybrid sort (text relevance OR recency/popularity/helpfulness)
//  - Default sort when no query: updatedAt desc, then viewCount desc (Change Spec §7.1)
//  - View count + recently-viewed list per user
//  - Helpful/unhelpful feedback with one-vote-per-user idempotency
//  - Role-aware projection: students see no raw counts; mods/admins do (Change Spec §7.3)
//
// NOT YET IMPLEMENTED (deferred to Phase 6):
//  - Vector search via MongoDB Atlas Vector Search
//  - Embedding generation on publish
//  - Duplicate detection via cosine similarity
import { Types, type FilterQuery } from 'mongoose';
import type {
  FaqCreateInput,
  FaqListQuery,
  FaqUpdateInput,
  PublicFaq,
  UserRole,
} from '@samagama/shared';
import { RECENT_FAQS_LIMIT } from '@samagama/shared';
import { FaqModel, type FaqDocument } from '../models/Faq.model.js';
import { UserModel } from '../models/User.model.js';
import { FlagModel } from '../models/Flag.model.js';
import { ApiError } from '../utils/api-error.js';
import { generateEmbedding, cosineSimilarity } from './embedding.service.js';
import { analyticsService } from './analytics.service.js';
import { invalidateFaqEmbeddingCache } from './qna.service.js';

interface ListOptions {
  query: FaqListQuery;
  role: UserRole;
  userId?: string;
}

interface ListResult {
  items: PublicFaq[];
  total: number;
  page: number;
  pageSize: number;
}

interface PopulatedFaq extends Omit<FaqDocument, 'categories' | 'tags'> {
  categories: { _id: Types.ObjectId; name: string; slug: string }[];
  tags: { _id: Types.ObjectId; name: string; slug: string }[];
}

function projectFaq(
  faq: PopulatedFaq,
  role: UserRole,
  userVote?: 'helpful' | 'unhelpful' | null,
): PublicFaq {
  const base: PublicFaq = {
    id: faq._id.toString(),
    title: faq.title,
    answer: faq.answer,
    summary: faq.summary ?? undefined,
    categories: faq.categories.map((c) => ({
      id: c._id.toString(),
      name: c.name,
      slug: c.slug,
    })),
    tags: faq.tags.map((t) => ({
      id: t._id.toString(),
      name: t.name,
      slug: t.slug,
    })),
    status: faq.status,
    updatedAt: faq.updatedAt.toISOString(),
    createdAt: faq.createdAt.toISOString(),
  };
  // helpfulCount and unhelpfulCount are shown to all roles so students see vote totals
  // when browsing FAQs. viewCount and flagCount remain moderator/admin-only.
  base.helpfulCount = faq.helpfulCount ?? 0;
  base.unhelpfulCount = faq.unhelpfulCount ?? 0;
  if (role === 'moderator' || role === 'admin') {
    base.viewCount = faq.viewCount;
    base.flagCount = faq.flagCount;
  }
  // userVote is only set for students (undefined signals "not applicable").
  if (userVote !== undefined) base.userVote = userVote;
  return base;
}

function buildFilter(query: FaqListQuery, role: UserRole): FilterQuery<FaqDocument> {
  const filter: FilterQuery<FaqDocument> = {};

  // Students only see published FAQs. Mods/admins can filter explicitly.
  if (role === 'student') {
    filter.status = 'published';
  } else if (query.status) {
    filter.status = query.status;
  }
  // No default status filter for mods/admins — they see draft/published/outdated.

  if (query.category) {
    const categoryIds = query.category
      .split(',')
      .map((s) => s.trim())
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));
    if (categoryIds.length === 1) {
      filter.categories = categoryIds[0];
    } else if (categoryIds.length > 1) {
      filter.categories = { $in: categoryIds };
    }
  }
  if (query.tag) {
    const tagIds = query.tag
      .split(',')
      .map((s) => s.trim())
      .filter((s) => Types.ObjectId.isValid(s))
      .map((s) => new Types.ObjectId(s));
    if (tagIds.length === 1) {
      filter.tags = tagIds[0];
    } else if (tagIds.length > 1) {
      filter.tags = { $in: tagIds };
    }
  }
  if (query.q) {
    filter.$text = { $search: query.q };
  }
  // Dashboard Spec: helpful/flagged filters surface in FAQ Management.
  if (query.filter === 'helpful') {
    filter.helpfulCount = { $gt: 0 };
  } else if (query.filter === 'flagged') {
    filter.flagCount = { $gt: 0 };
  }
  return filter;
}

export const faqService = {
  async list({ query, role, userId }: ListOptions): Promise<ListResult> {
    const filter = buildFilter(query, role);
    const skip = (query.page - 1) * query.pageSize;

    // Sort selection (Change Spec §7.1: default is recency-then-views when no query).
    type SortSpec = Record<string, 1 | -1 | { $meta: 'textScore' }>;
    let sort: SortSpec;
    let projection: Record<string, unknown> | undefined;
    if (query.q && query.sort === 'relevance') {
      sort = { score: { $meta: 'textScore' }, updatedAt: -1 };
      projection = { score: { $meta: 'textScore' } };
    } else {
      switch (query.sort) {
        case 'popular':
          sort = { viewCount: -1, updatedAt: -1 };
          break;
        case 'helpful':
          sort = { helpfulCount: -1, updatedAt: -1 };
          break;
        case 'added':
          // "Recently added" — use publishedAt for true creation order, fall back to createdAt.
          sort = { publishedAt: -1, createdAt: -1 };
          break;
        case 'relevance':
        case 'recent':
        default:
          // Change Spec §7.1: recently updated first, then most viewed.
          sort = { updatedAt: -1, viewCount: -1 };
      }
    }

    const [items, total] = await Promise.all([
      FaqModel.find(filter, projection)
        .sort(sort)
        .skip(skip)
        .limit(query.pageSize)
        .populate('categories', 'name slug')
        .populate('tags', 'name slug')
        .lean<PopulatedFaq[]>(),
      FaqModel.countDocuments(filter),
    ]);

    // Fire-and-forget: log search queries so admin can surface unanswered searches.
    if (query.q) {
      void analyticsService.logSearch({ query: query.q, resultCount: total });
    }

    // Build per-user vote map for this page in a single query.
    // Only relevant for students; mods/admins don't vote.
    const voteMap = new Map<string, 'helpful' | 'unhelpful'>();
    if (userId && items.length > 0 && role === 'student') {
      const userObjectId = new Types.ObjectId(userId);
      const pageIds = items.map((f) => f._id);
      const voted = await FaqModel.find(
        {
          _id: { $in: pageIds },
          $or: [{ helpfulVotes: userObjectId }, { unhelpfulVotes: userObjectId }],
        },
        { _id: 1 },
      )
        .select('+helpfulVotes +unhelpfulVotes')
        .lean<
          {
            _id: Types.ObjectId;
            helpfulVotes?: Types.ObjectId[];
            unhelpfulVotes?: Types.ObjectId[];
          }[]
        >();

      for (const f of voted) {
        if (f.helpfulVotes?.some((v) => v.equals(userObjectId))) {
          voteMap.set(f._id.toString(), 'helpful');
        } else if (f.unhelpfulVotes?.some((v) => v.equals(userObjectId))) {
          voteMap.set(f._id.toString(), 'unhelpful');
        }
      }
    }

    return {
      items: items.map((faq) => {
        const userVote =
          userId && role === 'student' ? (voteMap.get(faq._id.toString()) ?? null) : undefined;
        return projectFaq(faq, role, userVote);
      }),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },

  async getById(id: string, role: UserRole, userId?: string): Promise<PublicFaq> {
    const faq = await FaqModel.findById(id)
      .select('+helpfulVotes +unhelpfulVotes')
      .populate('categories', 'name slug')
      .populate('tags', 'name slug')
      .lean<
        PopulatedFaq & {
          helpfulVotes?: Types.ObjectId[];
          unhelpfulVotes?: Types.ObjectId[];
        }
      >();
    if (!faq) throw ApiError.notFound('FAQ not found');
    if (role === 'student' && faq.status !== 'published') {
      throw ApiError.notFound('FAQ not found');
    }
    let userVote: 'helpful' | 'unhelpful' | null | undefined;
    if (userId && role === 'student') {
      if (faq.helpfulVotes?.some((v) => v.toString() === userId)) {
        userVote = 'helpful';
      } else if (faq.unhelpfulVotes?.some((v) => v.toString() === userId)) {
        userVote = 'unhelpful';
      } else {
        userVote = null;
      }
    }
    return projectFaq(faq, role, userVote);
  },

  async create(input: FaqCreateInput, actorId: string) {
    const doc = await FaqModel.create({
      ...input,
      createdBy: actorId,
      updatedBy: actorId,
      publishedAt: input.status === 'published' ? new Date() : undefined,
    });

    // Fire-and-forget: generate 384-dim embedding for the FAQ title.
    // Mirrors remote embeddingBackfillJob pattern — non-blocking.
    if (input.status === 'published') {
      void scheduleEmbedding(doc._id.toString(), input.title);
      void analyticsService.track('faq_viewed', {
        entityType: 'faq',
        entityId: doc._id.toString(),
        userId: actorId,
      });
    }

    return doc;
  },

  async update(id: string, input: FaqUpdateInput, actorId: string) {
    const current = await FaqModel.findById(id).select('+helpfulVotes +unhelpfulVotes');
    if (!current) throw ApiError.notFound('FAQ not found');

    // Stat-reset rule (Dashboard Spec): when the answer body changes, the previous helpful /
    // flagged metrics no longer reflect the current content. Reset them so users can re-vote.
    // Title/summary/category/tag edits do NOT trigger a reset — they don't change correctness.
    const answerChanged =
      typeof input.answer === 'string' && input.answer.trim() !== current.answer.trim();

    Object.assign(current, input, { updatedBy: actorId });
    if (input.status === 'published' && !current.publishedAt) {
      current.publishedAt = new Date();
    }

    if (answerChanged) {
      current.helpfulCount = 0;
      current.unhelpfulCount = 0;
      current.flagCount = 0;
      current.helpfulVotes = [];
      current.unhelpfulVotes = [];
      // Outstanding flags become 'resolved' — implicitly addressed by the edit.
      // We do this in a fire-and-forget update against the Flag collection inside the controller
      // so this service stays focused on the FAQ document.
    }

    // Moderator-triggered manual resets (independent of answer change).
    if (!answerChanged) {
      if (input.resetHelpful) {
        current.helpfulCount = 0;
        current.helpfulVotes = [];
      }
      if (input.resetUnhelpful) {
        current.unhelpfulCount = 0;
        current.unhelpfulVotes = [];
      }
      if (input.resetFlags) {
        current.flagCount = 0;
      }
    }

    await current.save();

    // Regenerate embedding if title or answer changed and FAQ is published.
    if (current.status === 'published' && (input.title || answerChanged)) {
      void scheduleEmbedding(current._id.toString(), current.title);
    }
    // Recompute quality score async when a meaningful content field changes.
    if (answerChanged || input.title || input.summary) {
      void FaqModel.calculateQualityScore(current._id.toString());
    }

    return { faq: current, statsReset: answerChanged };
  },

  /** Hard-delete an FAQ with full cascade cleanup. */
  async delete(id: string): Promise<void> {
    // Delete the document first so a cleanup failure never leaves a live-but-orphaned FAQ.
    const deleted = await FaqModel.findByIdAndDelete(id);
    if (!deleted) throw ApiError.notFound('FAQ not found');

    // Best-effort cascade cleanup — partial failure leaves orphaned refs but the FAQ is gone.
    await Promise.all([
      FlagModel.deleteMany({ entityType: 'faq', entityId: id }),
      FaqModel.updateMany({ duplicateOf: id }, { $unset: { duplicateOf: '' } }),
      UserModel.updateMany(
        { 'recentlyViewedFaqs.faqId': id },
        { $pull: { recentlyViewedFaqs: { faqId: id } } },
      ),
    ]);
  },

  /** Idempotent view recording: increments counter and prepends to user's recent list. */
  async recordView(faqId: string, userId?: string): Promise<void> {
    if (!Types.ObjectId.isValid(faqId)) throw ApiError.badRequest('Invalid FAQ id');

    // Atomic counter bump — happens for anonymous and signed-in views alike.
    await FaqModel.updateOne({ _id: faqId, status: 'published' }, { $inc: { viewCount: 1 } });

    // The recently-viewed LRU is a per-account feature; anonymous visitors have no User doc,
    // so skip it (and the keyed analytics event) when there's no real user behind the id.
    if (!userId) return;

    // Maintain a bounded LRU of recently-viewed FAQs on the user.
    await UserModel.updateOne({ _id: userId }, { $pull: { recentlyViewedFaqs: { faqId } } });
    await UserModel.updateOne(
      { _id: userId },
      {
        $push: {
          recentlyViewedFaqs: {
            $each: [{ faqId, viewedAt: new Date() }],
            $position: 0,
            $slice: RECENT_FAQS_LIMIT,
          },
        },
      },
    );

    // Fire-and-forget analytics event.
    void analyticsService.track('faq_viewed', { userId, entityType: 'faq', entityId: faqId });
  },

  /** One vote per user. Switching and toggling off are allowed. Returns updated counts. */
  async submitFeedback(
    faqId: string,
    userId: string,
    rating: 'helpful' | 'unhelpful',
  ): Promise<{
    helpfulCount: number;
    unhelpfulCount: number;
    userVote: 'helpful' | 'unhelpful' | null;
  }> {
    const userObjectId = new Types.ObjectId(userId);
    const faq = await FaqModel.findById(faqId).select('+helpfulVotes +unhelpfulVotes');
    if (!faq) throw ApiError.notFound('FAQ not found');
    if (faq.status !== 'published') throw ApiError.forbidden('FAQ is not open for feedback');

    const had = {
      helpful: faq.helpfulVotes?.some((v) => v.equals(userObjectId)) ?? false,
      unhelpful: faq.unhelpfulVotes?.some((v) => v.equals(userObjectId)) ?? false,
    };

    const update: Record<string, unknown> = {};
    const inc: { helpfulCount?: number; unhelpfulCount?: number } = {};

    if (had[rating]) {
      // Toggle OFF — user clicked the same rating again, remove their vote.
      if (rating === 'helpful') {
        update.$pull = { helpfulVotes: userObjectId };
        inc.helpfulCount = -1;
      } else {
        update.$pull = { unhelpfulVotes: userObjectId };
        inc.unhelpfulCount = -1;
      }
    } else if (rating === 'helpful') {
      // Switch to helpful (and remove any previous unhelpful vote).
      update.$addToSet = { helpfulVotes: userObjectId };
      update.$pull = { unhelpfulVotes: userObjectId };
      inc.helpfulCount = 1;
      if (had.unhelpful) inc.unhelpfulCount = -1;
    } else {
      // Switch to unhelpful (and remove any previous helpful vote).
      update.$addToSet = { unhelpfulVotes: userObjectId };
      update.$pull = { helpfulVotes: userObjectId };
      inc.unhelpfulCount = 1;
      if (had.helpful) inc.helpfulCount = -1;
    }
    update.$inc = inc;

    // timestamps: false prevents Mongoose from bumping updatedAt on a vote —
    // a reaction should never change the "last edited" time shown to students.
    await FaqModel.updateOne({ _id: faqId }, update, { timestamps: false });

    // Fire-and-forget analytics event.
    void analyticsService.track(rating === 'helpful' ? 'faq_helpful' : 'faq_unhelpful', {
      userId,
      entityType: 'faq',
      entityId: faqId,
    });

    // Recompute quality score after feedback changes helpfulness ratio.
    void FaqModel.calculateQualityScore(faqId);

    return {
      helpfulCount: Math.max(0, (faq.helpfulCount ?? 0) + (inc.helpfulCount ?? 0)),
      unhelpfulCount: Math.max(0, (faq.unhelpfulCount ?? 0) + (inc.unhelpfulCount ?? 0)),
      userVote: had[rating] ? null : rating,
    };
  },

  /**
   * Cosine-similarity duplicate check. Mirrors remote POST /api/faqs/check-similar.
   * Requires embeddings to be populated on published FAQs.
   * Falls back to text search when embeddings are missing.
   */
  async checkSimilarity(
    title: string,
    opts: { limit?: number; threshold?: number } = {},
  ): Promise<{ id: string; title: string; similarity: number }[]> {
    const limit = Math.min(opts.limit ?? 5, 20);
    const threshold = opts.threshold ?? 0.5;

    const queryEmbedding = await generateEmbedding(title);

    // Fetch published FAQs with their embeddings (select: false requires explicit select).
    const faqs = await FaqModel.find({ status: 'published' })
      .select('title embedding')
      .lean<{ _id: Types.ObjectId; title: string; embedding?: number[] }[]>();

    const scored = faqs
      .filter((f) => f.embedding && f.embedding.length === 384)
      .map((f) => ({
        id: f._id.toString(),
        title: f.title,
        similarity: cosineSimilarity(queryEmbedding, f.embedding!),
      }))
      .filter((r) => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Fallback: if no embeddings are populated yet, use text search.
    if (scored.length === 0 && title.trim()) {
      const textResults = await FaqModel.find(
        { status: 'published', $text: { $search: title } },
        { score: { $meta: 'textScore' } },
      )
        .sort({ score: { $meta: 'textScore' } })
        .limit(limit)
        .lean<{ _id: Types.ObjectId; title: string }[]>();
      return textResults.map((f) => ({ id: f._id.toString(), title: f.title, similarity: 0 }));
    }

    return scored;
  },

  async getRecentlyViewed(userId: string, role: UserRole): Promise<PublicFaq[]> {
    const user = await UserModel.findById(userId)
      .select('recentlyViewedFaqs')
      .lean<{ recentlyViewedFaqs: { faqId: Types.ObjectId; viewedAt: Date }[] }>();
    if (!user) return [];
    const ids = user.recentlyViewedFaqs.map((r) => r.faqId);
    if (ids.length === 0) return [];

    const faqs = await FaqModel.find({ _id: { $in: ids }, status: 'published' })
      .populate('categories', 'name slug')
      .populate('tags', 'name slug')
      .lean<PopulatedFaq[]>();

    // Preserve the user's recency order.
    const byId = new Map(faqs.map((f) => [f._id.toString(), f]));
    const ordered = ids
      .map((id) => byId.get(id.toString()))
      .filter((f): f is PopulatedFaq => Boolean(f));
    return ordered.map((f) => projectFaq(f, role));
  },
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

/** Async, non-blocking embedding generation. Saves result back to the FAQ and clears
 * the server-wide embedding cache so checkExisting picks up the refreshed vector.
 */
async function scheduleEmbedding(faqId: string, title: string): Promise<void> {
  try {
    const embedding = await generateEmbedding(title);
    await FaqModel.updateOne({ _id: faqId }, { embedding });
    // Invalidate the cached list so the next checkExisting call re-fetches
    // and includes this FAQ's updated embedding.
    invalidateFaqEmbeddingCache();
  } catch {
    // Swallow — embedding failures must never block the request path.
  }
}
