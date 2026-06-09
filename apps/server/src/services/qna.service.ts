// Community Q&A service. Implements PRD §8.6 + Change Spec §5–§6.
//
// Notable rules baked in:
//  - Existing-answer check returns top 3 FAQ matches using HYBRID search:
//      • Primary: cosine similarity on pre-generated 384-dim embeddings (semantic).
//      • Fallback: MongoDB $text if no embeddings are populated yet (keyword).
//    This catches paraphrased questions that share no keywords with the FAQ.
//    A short-lived signed token is returned; createQuestion requires it (PRD QNA-002).
//  - Community-question duplicate check (step 2) is HYBRID too: cosine similarity on
//    question embeddings built from title + description (same construction as the
//    student's query — see composeQuestionEmbeddingText), with a $text keyword fallback
//    when no embeddings exist yet. Embedding the full question (not just the derived
//    first-line title) is what keeps "Check Community" matches as relevant as FAQ search.
//  - Personal questions are visible only to the asker, moderators, and admins.
//  - Community-question answer cap: hard server-side guard at COMMUNITY_ANSWER_CAP (Change Spec §5.5).
//  - Tag-me: any student may register their interest in an existing community question.
//  - Vote toggling on answers is idempotent and atomic.
import { Types, type FilterQuery } from 'mongoose';
import jwt from 'jsonwebtoken';
import {
  SPURTI_POINTS,
  type AnswerCreateInput,
  type CheckExistingInput,
  type ExistingAnswerCheckResult,
  type PublicAnswer,
  type PublicFaqMatch,
  type PublicQuestion,
  type PublicQuestionMatch,
  type QuestionCreateInput,
  type UserRole,
} from '@samagama/shared';
import { FaqModel } from '../models/Faq.model.js';
import { QuestionModel, type QuestionDocument } from '../models/Question.model.js';
import { AnswerModel, type AnswerDocument } from '../models/Answer.model.js';
import { UserModel } from '../models/User.model.js';
import { ApiError } from '../utils/api-error.js';
import { createTtlCache } from '../utils/ttl-cache.js';
import { env } from '../config/env.js';
import {
  generateEmbedding,
  cosineSimilarity,
  composeQuestionEmbeddingText,
} from './embedding.service.js';
import { settingsService } from './settings.service.js';

/** Signed token TTL for the existing-answer check (15 minutes). Long enough to read suggestions, short enough to limit replay. */
const EXISTING_CHECK_TTL = 15 * 60;

/** How many FAQ matches to show the student (spec: 2–3). */
const FAQ_MATCH_LIMIT = 3;

/**
 * Minimum cosine similarity to be considered a meaningful FAQ match (Option A).
 *
 * Tuning guide (applies to both FAQ and community-question scans):
 *   0.35 — original value; catches broad associations but risks irrelevant results.
 *   0.50 — recommended for all-minilm / Ollama; their cosine scores spread widely.
 *   0.65 — strict for all-minilm: only close paraphrases pass.
 *   0.80 — recommended for Gemini gemini-embedding-001: the model's cosine floor
 *           for unrelated text sits at ~0.76, so 0.80 is the practical noise cutoff.
 *
 * Current provider: gemini → threshold set to 0.80.
 */
const SEMANTIC_THRESHOLD = 0.8;

/**
 * Minimum cosine similarity for community-question duplicate detection (Option C).
 * Same provider-aware calibration as SEMANTIC_THRESHOLD.
 * Slightly lower than FAQ threshold because student-written questions vary more in phrasing.
 */
const QUESTION_SEMANTIC_THRESHOLD = 0.78;

/**
 * Server-wide cache of published FAQ embeddings (title + 384-dim vector).
 *
 * Why a single shared slot:
 *   - FAQs change rarely; a 1-hour TTL is safe for an internship portal.
 *   - Eliminates a full-collection MongoDB round-trip (and 450 KB+ transfer)
 *     on every checkExisting call. The cosine scan then runs purely in CPU.
 *   - One entry = the entire FAQ list; maxEntries=1 keeps memory bounded.
 *
 * Invalidation: call faqEmbeddingCache.clear() whenever a FAQ is published
 * or its title/answer is edited (handled in faq.service.ts — see scheduleEmbedding).
 */
const faqEmbeddingCache = createTtlCache<
  { id: string; title: string; summary?: string; answer: string; embedding: number[] }[]
>({
  ttlMs: 60 * 60_000, // 1 hour
  maxEntries: 1,
});

/** Cache key for the single FAQ-embedding list slot. */
const FAQ_EMBED_CACHE_KEY = 'all';

/**
 * Fetch all published FAQ embeddings, using the server-wide cache to avoid
 * repeated MongoDB round-trips. Falls back to an empty list on DB error so
 * the caller can degrade gracefully to keyword search.
 */
async function getPublishedFaqEmbeddings(): Promise<
  { id: string; title: string; summary?: string; answer: string; embedding: number[] }[]
> {
  const cached = faqEmbeddingCache.get(FAQ_EMBED_CACHE_KEY);
  if (cached) return cached;

  const faqs = await FaqModel.find({ status: 'published' })
    .select('title summary answer embedding')
    .lean<
      {
        _id: Types.ObjectId;
        title: string;
        summary?: string;
        answer: string;
        embedding?: number[];
      }[]
    >();

  const withEmbeddings = faqs
    .filter((f) => f.embedding && f.embedding.length === 384)
    .map((f) => ({
      id: f._id.toString(),
      title: f.title,
      summary: f.summary,
      answer: f.answer,
      embedding: f.embedding!,
    }));

  faqEmbeddingCache.set(FAQ_EMBED_CACHE_KEY, withEmbeddings);
  return withEmbeddings;
}

/**
 * In-memory cache for the per-user checkExisting result.
 * TTL of 60 seconds covers the common pattern of a student clicking "Check Existing Answers"
 * twice in quick succession (e.g. after editing the description) without re-running the
 * embedding scan. Cache key includes userId so each user gets a freshly-signed token.
 */
const checkExistingCache = createTtlCache<{
  faqMatches: PublicFaqMatch[];
  questionMatches: PublicQuestionMatch[];
}>({ ttlMs: 60_000, maxEntries: 1000 });

/** Normalize free text so trivial differences (case, extra whitespace) hit the same cache row. */
function normalizeForCache(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Export so faq.service.ts can invalidate the embedding list on publish/edit. */
export function invalidateFaqEmbeddingCache(): void {
  faqEmbeddingCache.clear();
}

interface CheckTokenPayload {
  uid: string;
  th: string; // title hash
}

function hashTitle(title: string): string {
  // FNV-1a-ish lightweight hash; collision-resistant enough for replay protection of a 15-min window.
  let h = 0x811c9dc5;
  for (let i = 0; i < title.length; i++) {
    h ^= title.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

function signCheckToken(userId: string, title: string): string {
  const payload: CheckTokenPayload = { uid: userId, th: hashTitle(title) };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: EXISTING_CHECK_TTL });
}

function verifyCheckToken(token: string, userId: string, title: string): boolean {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as CheckTokenPayload;
    return decoded.uid === userId && decoded.th === hashTitle(title);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Projection helpers — never expose internal fields like vote arrays directly.
// ----------------------------------------------------------------------------

interface PopulatedQuestion extends Omit<QuestionDocument, 'category' | 'tags' | 'askedBy'> {
  category: { _id: Types.ObjectId; name: string; slug: string } | null;
  tags: { _id: Types.ObjectId; name: string; slug: string }[];
  askedBy: { _id: Types.ObjectId; name: string };
}

interface PopulatedAnswer extends Omit<AnswerDocument, 'answeredBy'> {
  answeredBy: { _id: Types.ObjectId; name: string; role: string };
}

function projectQuestion(q: PopulatedQuestion, viewerId?: string): PublicQuestion {
  const result: PublicQuestion = {
    id: q._id.toString(),
    title: q.title,
    description: q.description,
    type: q.type,
    status: q.status,
    category: q.category
      ? { id: q.category._id.toString(), name: q.category.name, slug: q.category.slug }
      : null,
    tags: q.tags.filter(Boolean).map((t) => ({ id: t._id.toString(), name: t.name, slug: t.slug })),
    author: q.askedBy
      ? { id: q.askedBy._id.toString(), name: q.askedBy.name }
      : { id: '', name: 'Deleted User' },
    screenshotUrl: q.screenshotUrl ?? undefined,
    answerCount: q.answerCount,
    viewCount: q.viewCount,
    visibilityExpiresAt:
      (q as unknown as { visibilityExpiresAt?: Date }).visibilityExpiresAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };

  // Personal question display state — only emitted when the requester is the asker (Change Spec §5.3).
  if (q.type === 'personal' && viewerId && q.askedBy?._id.toString() === viewerId) {
    if (q.answerCount > 0 || q.status === 'answered' || q.status === 'resolved') {
      result.displayState = 'responded';
    } else if (q.moderatorViewedAt) {
      result.displayState = 'seen';
    } else {
      result.displayState = 'posted';
    }
  }
  return result;
}

function projectAnswer(a: PopulatedAnswer, viewerId?: string): PublicAnswer {
  const result: PublicAnswer = {
    id: a._id.toString(),
    body: a.body,
    status: a.status,
    author: { id: a.answeredBy._id.toString(), name: a.answeredBy.name, role: a.answeredBy.role },
    upvoteCount: a.upvoteCount,
    downvoteCount: a.downvoteCount,
    moderationNote: a.moderationNote ?? undefined,
    approvedAt: a.approvedAt?.toISOString(),
    isFaqConverted: !!a.convertedFaqId,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  };
  if (viewerId) {
    const viewerObj = new Types.ObjectId(viewerId);
    if (a.upvotes?.some((v) => v.equals(viewerObj))) result.myVote = 'up';
    else if (a.downvotes?.some((v) => v.equals(viewerObj))) result.myVote = 'down';
    else result.myVote = null;
  }
  return result;
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

/**
 * Option C: Async, non-blocking embedding generation for community questions.
 * Saves the 384-dim vector back to the Question document so future checkExisting
 * calls can use cosine similarity instead of falling back to keyword search.
 * Mirrors the pattern used by scheduleEmbedding in faq.service.ts.
 */
async function scheduleQuestionEmbedding(
  questionId: string,
  title: string,
  description?: string,
): Promise<void> {
  try {
    // Embed title + description (matching the query side) so the stored vector
    // captures the whole question, not just its first line.
    const embedding = await generateEmbedding(composeQuestionEmbeddingText(title, description));
    await QuestionModel.updateOne({ _id: questionId }, { embedding });
  } catch {
    // Swallow — embedding failures must never block the request path.
  }
}

// ----------------------------------------------------------------------------
// Service
// ----------------------------------------------------------------------------

export const qnaService = {
  /**
   * Existing-answer check (PRD §8.6 / Change Spec §6.4):
   *   1. FAQ match — HYBRID (Option A + existing):
   *      a. Generate a single embedding for the student's query (title + description).
   *      b. Fetch all published FAQ embeddings from the server-wide cache.
   *      c. Score each FAQ by cosine similarity; keep those ≥ SEMANTIC_THRESHOLD (0.50).
   *      d. FALLBACK: if no embeddings are populated yet, use MongoDB $text.
   *      Returns top FAQ_MATCH_LIMIT (3) results.
   *   2. Community-question match — HYBRID semantic + keyword fallback (Option C):
   *      Reuses the same query embedding from step 1 to scan stored question embeddings.
   *      Falls back to MongoDB $text if no question embeddings exist yet.
   *      Returns top 2 open/answered community questions the student didn't author.
   *   3. Issue a short-lived JWT; createQuestion requires it (PRD QNA-002).
   */
  async checkExisting(
    input: CheckExistingInput,
    userId: string,
  ): Promise<ExistingAnswerCheckResult> {
    const normalizedTitle = normalizeForCache(input.title);
    const normalizedDescription = normalizeForCache(input.description ?? '');
    const cacheKey = `${userId}|${normalizedTitle}|${normalizedDescription}`;

    let matchedFaqs: PublicFaqMatch[];
    let matchedQuestions: PublicQuestionMatch[];

    const cached = checkExistingCache.get(cacheKey);
    if (cached) {
      matchedFaqs = cached.faqMatches;
      matchedQuestions = cached.questionMatches;
    } else {
      // Build the query text used by both the embedding call and the $text fallback.
      // Same construction as the stored question vector (composeQuestionEmbeddingText)
      // so query and document embeddings are directly comparable.
      const queryText = composeQuestionEmbeddingText(input.title, input.description);

      // ── Generate embedding + fetch community question candidates in parallel ──
      // One embedding call serves both the FAQ scan and the community-question scan (Option C).
      const [queryEmbedding, questionCandidates] = await Promise.all([
        generateEmbedding(queryText),
        // Fetch open/answered community questions (excluding the requester's own) with embeddings.
        // select('+embedding') is required because the field is select:false on the schema.
        QuestionModel.find({
          type: 'community',
          status: { $in: ['open', 'answered'] },
          askedBy: { $ne: new Types.ObjectId(userId) },
        })
          .select('+embedding')
          .lean<
            {
              _id: Types.ObjectId;
              title: string;
              description: string;
              answerCount: number;
              embedding?: number[];
            }[]
          >(),
      ]);

      // ── Step 1: FAQ cosine scan against server-wide cache ───────────────────
      const faqCandidates = await getPublishedFaqEmbeddings();

      let semanticMatches = faqCandidates
        .map((f) => ({
          id: f.id,
          title: f.title,
          summary: f.summary,
          answer: f.answer,
          score: cosineSimilarity(queryEmbedding, f.embedding),
        }))
        .filter((f) => f.score >= SEMANTIC_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, FAQ_MATCH_LIMIT);

      // FALLBACK: no FAQ embeddings populated yet → use keyword search.
      if (semanticMatches.length === 0 && queryText.trim()) {
        const textRows = await FaqModel.find(
          { status: 'published', $text: { $search: queryText } },
          { score: { $meta: 'textScore' } },
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(FAQ_MATCH_LIMIT)
          .lean<
            {
              _id: Types.ObjectId;
              title: string;
              summary?: string;
              answer: string;
              score?: number;
            }[]
          >();

        semanticMatches = textRows.map((f) => ({
          id: f._id.toString(),
          title: f.title,
          summary: f.summary,
          answer: f.answer,
          score: f.score ?? 0,
        }));
      }

      matchedFaqs = semanticMatches.map((f) => ({
        id: f.id,
        title: f.title,
        summary: f.summary ?? undefined,
        answer: f.answer,
        score: f.score,
      }));

      // ── Step 2: Community-question semantic scan (Option C) ──────────────────
      // Run cosine similarity against all community questions that have embeddings stored.
      const withEmbeddings = questionCandidates.filter(
        (q) => q.embedding && q.embedding.length === 384,
      );

      let questionMatches = withEmbeddings
        .map((q) => ({
          id: q._id.toString(),
          title: q.title,
          description: q.description,
          answerCount: q.answerCount,
          score: cosineSimilarity(queryEmbedding, q.embedding!),
        }))
        .filter((q) => q.score >= QUESTION_SEMANTIC_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      // FALLBACK: no question embeddings exist yet → use keyword search.
      if (questionMatches.length === 0 && queryText.trim()) {
        const keywordRows = await QuestionModel.find(
          {
            type: 'community',
            status: { $in: ['open', 'answered'] },
            askedBy: { $ne: new Types.ObjectId(userId) },
            $text: { $search: queryText },
          },
          { score: { $meta: 'textScore' } },
        )
          .sort({ score: { $meta: 'textScore' } })
          .limit(2)
          .lean<
            {
              _id: Types.ObjectId;
              title: string;
              description: string;
              answerCount: number;
              score?: number;
            }[]
          >();

        questionMatches = keywordRows.map((q) => ({
          id: q._id.toString(),
          title: q.title,
          description: q.description,
          answerCount: q.answerCount,
          score: (q as { score?: number }).score ?? 0,
        }));
      }

      matchedQuestions = questionMatches;

      checkExistingCache.set(cacheKey, {
        faqMatches: matchedFaqs,
        questionMatches: matchedQuestions,
      });
    }

    // Token is freshly signed every call — never cached. The cached payload is only the
    // (deterministic, user-scoped) similarity result.
    return {
      token: signCheckToken(userId, input.title),
      matchedFaqs,
      matchedQuestions,
    };
  },

  /** Tag the current student onto an existing community question (Change Spec §6.5 / §9.1). */
  async tagMe(questionId: string, userId: string, token: string): Promise<void> {
    const question = await QuestionModel.findById(questionId);
    if (!question) throw ApiError.notFound('Question not found');
    if (question.type !== 'community') {
      throw ApiError.forbidden('Only community questions can be tagged');
    }
    // Verify the token is valid and belongs to this user.
    // We only check user ID + expiry — not the title hash — because the token
    // was signed with the student's own input title, which is a different
    // phrasing of the same question (not an exact match to the existing
    // question's title). Expiry alone is sufficient: it proves the student
    // ran checkExisting within the last 15 minutes before tagging.
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as CheckTokenPayload;
      if (decoded.uid !== userId) throw new Error('user mismatch');
    } catch {
      throw ApiError.forbidden('Existing-answer check token is missing or expired');
    }
    await QuestionModel.updateOne(
      { _id: questionId },
      { $addToSet: { taggedStudents: new Types.ObjectId(userId) } },
    );
  },

  /** Create a question. The check token is required to prove the user saw suggestions. */
  async createQuestion(input: QuestionCreateInput, userId: string): Promise<PublicQuestion> {
    if (!input.existingAnswerCheckToken) {
      throw ApiError.badRequest('Run existing-answer check before submitting');
    }
    if (!verifyCheckToken(input.existingAnswerCheckToken, userId, input.title)) {
      throw ApiError.forbidden('Existing-answer check token is invalid or expired');
    }
    const created = await QuestionModel.create({
      title: input.title,
      description: input.description,
      category: input.category,
      tags: input.tags,
      type: input.type,
      screenshotUrl: input.screenshotUrl,
      askedBy: userId,
      existingAnswerCheck: { checkedAt: new Date() },
    });

    // Option C: generate and store a semantic embedding for community questions so
    // future checkExisting calls can use cosine similarity instead of keyword search.
    if (input.type === 'community') {
      void scheduleQuestionEmbedding(created._id.toString(), input.title, input.description);
      // Cache invalidation: a new community question changes what `checkExisting` would
      // return for similar drafts. Drop the whole map so it warms fresh.
      checkExistingCache.clear();
    }

    return this.getQuestionById(created.id, userId, 'student');
  },

  async listQuestions(opts: {
    role: UserRole;
    userId: string;
    type?: 'personal' | 'community';
    status?: string;
    mineOnly?: boolean;
    /** Idle bucket filter; only applies to community questions still in `open`/`answered`. */
    idle?: 'last24h' | 'over3days' | 'over1week';
  }): Promise<PublicQuestion[]> {
    const filter: FilterQuery<QuestionDocument> = {
      isTrashed: { $ne: true },
    };

    if (opts.type) filter.type = opts.type;
    if (opts.status) {
      // Accept either a single value ('open') or a comma-separated list ('open,answered').
      const parts = opts.status
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      filter.status = parts.length === 1 ? parts[0] : { $in: parts };
    }

    // Idle-bucket filter — same mutually-exclusive math as the stats aggregation so
    // the dashboard card and the filter chip always agree on what's in each bucket.
    if (opts.idle) {
      const { urgentIdleDays } = await settingsService.get();
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;
      const urgentMs = urgentIdleDays * day;
      // Idle filtering only makes sense for the open queue.
      filter.type = 'community';
      filter.status = filter.status ?? { $in: ['open', 'answered'] };
      if (opts.idle === 'last24h') {
        filter.updatedAt = { $gte: new Date(now - day) };
      } else if (opts.idle === 'over3days') {
        // Middle bucket: 24h–urgentIdleDays window so cards + chips always sum to totalOpen.
        filter.updatedAt = { $lt: new Date(now - day), $gte: new Date(now - urgentMs) };
      } else {
        filter.updatedAt = { $lt: new Date(now - urgentMs) };
      }
    }

    // Visibility:
    // - Students see community questions + their own personal questions.
    // - Moderators / admins see everything.
    if (opts.role === 'student') {
      const ownObjectId = new Types.ObjectId(opts.userId);
      if (opts.mineOnly) {
        // Show questions the student asked OR questions they tagged themselves onto.
        filter.$or = [{ askedBy: ownObjectId }, { taggedStudents: ownObjectId }];
      } else if (!opts.idle) {
        // Don't OR back to non-community when idle is set — idle implies community-only.
        filter.$or = [{ type: 'community' }, { askedBy: ownObjectId }];
      }
    } else if (opts.mineOnly) {
      filter.askedBy = new Types.ObjectId(opts.userId);
    }

    const questions = await QuestionModel.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate('category', 'name slug')
      .populate('tags', 'name slug')
      .populate('askedBy', 'name')
      .lean<PopulatedQuestion[]>();
    return questions.map((q) => projectQuestion(q, opts.userId));
  },

  async getQuestionById(id: string, viewerId: string, role: UserRole): Promise<PublicQuestion> {
    const question = await QuestionModel.findById(id)
      .populate('category', 'name slug')
      .populate('tags', 'name slug')
      .populate('askedBy', 'name')
      .lean<PopulatedQuestion>();
    if (!question) throw ApiError.notFound('Question not found');

    // Personal-question access control.
    if (
      question.type === 'personal' &&
      role === 'student' &&
      question.askedBy._id.toString() !== viewerId
    ) {
      throw ApiError.notFound('Question not found');
    }

    // Side effect: when a moderator/admin opens a personal question, set moderatorViewedAt
    // exactly once. This drives the "Seen" tick in My Questions (Change Spec §5.3).
    if (
      (role === 'moderator' || role === 'admin') &&
      question.type === 'personal' &&
      !question.moderatorViewedAt
    ) {
      await QuestionModel.updateOne(
        { _id: id, moderatorViewedAt: { $exists: false } },
        { $set: { moderatorViewedAt: new Date() } },
      );
    }

    // Increment view counter — fire-and-forget (don't block read).
    void QuestionModel.updateOne({ _id: id }, { $inc: { viewCount: 1 } });

    return projectQuestion(question, viewerId);
  },

  async listAnswers(questionId: string, viewerId: string, role: UserRole): Promise<PublicAnswer[]> {
    // Students: once a question is resolved, hide all pending answers — only the
    // approved answer(s) remain visible. Pre-resolution they can still see pending ones.
    // Moderators/admins always see every status for auditing.
    const filter: FilterQuery<AnswerDocument> = { questionId };
    if (role === 'student') {
      const q = await QuestionModel.findById(questionId).select('status').lean();
      filter.status = q?.status === 'resolved' ? 'approved' : { $in: ['pending', 'approved'] };
    }

    const answers = await AnswerModel.find(filter)
      .select('+upvotes +downvotes')
      .sort({ upvoteCount: -1, createdAt: 1 })
      .populate('answeredBy', 'name role')
      .lean<PopulatedAnswer[]>();
    return answers.map((a) => projectAnswer(a, viewerId));
  },

  /** Submit a peer answer. Server-side cap enforcement (Change Spec §5.5). */
  async submitAnswer(
    questionId: string,
    input: AnswerCreateInput,
    userId: string,
  ): Promise<PublicAnswer> {
    const question = await QuestionModel.findById(questionId);
    if (!question) throw ApiError.notFound('Question not found');
    if (question.type !== 'community') {
      throw ApiError.forbidden('Personal questions cannot receive peer answers');
    }
    if (question.status === 'resolved' || question.status === 'archived') {
      throw ApiError.forbidden('Question is closed for new answers');
    }
    const { communityAnswerCap } = await settingsService.get();
    if (question.answerCount >= communityAnswerCap) {
      throw ApiError.forbidden(
        `This question has reached the maximum of ${communityAnswerCap} answers`,
      );
    }
    // Prevent the asker from answering their own question.
    if (question.askedBy.toString() === userId) {
      throw ApiError.forbidden('You cannot answer your own question');
    }

    // Prevent duplicate submissions — one answer per student per question.
    const alreadyAnswered = await AnswerModel.exists({ questionId, answeredBy: userId });
    if (alreadyAnswered) {
      throw ApiError.conflict('You have already submitted an answer for this question');
    }

    const answer = await AnswerModel.create({
      questionId,
      body: input.body,
      answeredBy: userId,
      status: 'pending',
    });

    await QuestionModel.updateOne(
      { _id: questionId },
      {
        $inc: { answerCount: 1 },
        ...(question.status === 'open' ? { $set: { status: 'answered' } } : {}),
      },
    );

    const populated = await AnswerModel.findById(answer.id)
      .select('+upvotes +downvotes')
      .populate('answeredBy', 'name role')
      .lean<PopulatedAnswer>();
    return projectAnswer(populated!, userId);
  },

  /** Up/down vote on an answer. Toggling is idempotent: same vote twice cancels it. */
  async voteAnswer(
    answerId: string,
    userId: string,
    direction: 'up' | 'down',
    allowPending = false,
  ): Promise<{ upvoteCount: number; downvoteCount: number; myVote: 'up' | 'down' | null }> {
    const userObjId = new Types.ObjectId(userId);
    const answer = await AnswerModel.findById(answerId).select('+upvotes +downvotes');
    if (!answer) throw ApiError.notFound('Answer not found');
    if (answer.status !== 'approved' && !allowPending)
      throw ApiError.forbidden('Answer is not yet approved');
    if (answer.answeredBy.toString() === userId) {
      throw ApiError.forbidden('You cannot vote on your own answer');
    }

    const had = {
      up: answer.upvotes?.some((v) => v.equals(userObjId)) ?? false,
      down: answer.downvotes?.some((v) => v.equals(userObjId)) ?? false,
    };

    let myVote: 'up' | 'down' | null = direction;
    const update: Record<string, unknown> = {};

    if (direction === 'up') {
      if (had.up) {
        // Same vote again — cancel.
        update.$pull = { upvotes: userObjId };
        update.$inc = { upvoteCount: -1 };
        myVote = null;
      } else {
        update.$addToSet = { upvotes: userObjId };
        update.$pull = { downvotes: userObjId };
        update.$inc = {
          upvoteCount: 1,
          ...(had.down ? { downvoteCount: -1 } : {}),
        };
      }
    } else {
      if (had.down) {
        update.$pull = { downvotes: userObjId };
        update.$inc = { downvoteCount: -1 };
        myVote = null;
      } else {
        update.$addToSet = { downvotes: userObjId };
        update.$pull = { upvotes: userObjId };
        update.$inc = {
          downvoteCount: 1,
          ...(had.up ? { upvoteCount: -1 } : {}),
        };
      }
    }

    const updated = await AnswerModel.findOneAndUpdate({ _id: answerId }, update, {
      new: true,
      lean: true,
    });

    // Spurti Points: a *new* upvote on an approved answer rewards the answer's author.
    // Pulling an upvote (cancelling) does NOT subtract points — the answer was helpful at
    // some point in its life, and we don't want gaming the score by toggling.
    if (direction === 'up' && !had.up) {
      await UserModel.updateOne(
        { _id: answer.answeredBy },
        { $inc: { spurtiPoints: SPURTI_POINTS.ANSWER_UPVOTED } },
      );
    }

    return {
      upvoteCount: updated?.upvoteCount ?? 0,
      downvoteCount: updated?.downvoteCount ?? 0,
      myVote,
    };
  },
};
