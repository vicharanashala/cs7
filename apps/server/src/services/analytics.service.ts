// Analytics service. Mirrors remote analyticsService.js.
//
// Responsibilities:
//   1. Track discrete events (FAQ viewed, search run, question asked, etc.)
//   2. Compute and cache admin-facing aggregations:
//        - Portal overview (counts, activity trends)
//        - Issue heatmap (question volume by day over N days)
//        - Unanswered searches (queries with no FAQ click-through)
//   3. Recompute FAQ quality scores on demand.
//
// Cache TTL: 10 minutes for most aggregations (same as remote).
import { Types } from 'mongoose';
import { AnalyticsEventModel, type AnalyticsEventType } from '../models/AnalyticsEvent.model.js';
import { AnalyticsCacheModel } from '../models/AnalyticsCache.model.js';
import { SearchLogModel } from '../models/SearchLog.model.js';
import { FaqModel } from '../models/Faq.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { AnswerModel } from '../models/Answer.model.js';
import { UserModel } from '../models/User.model.js';
import { AuditLogModel } from '../models/AuditLog.model.js';

const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Event tracking ───────────────────────────────────────────────────────────

export const analyticsService = {
  /** Fire-and-forget event append. Never throws — analytics must not block the request. */
  async track(
    eventType: AnalyticsEventType,
    opts: {
      userId?: string;
      entityType?: 'faq' | 'question' | 'answer' | 'search' | 'user';
      entityId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    try {
      await AnalyticsEventModel.create({
        eventType,
        userId: opts.userId ? new Types.ObjectId(opts.userId) : undefined,
        entityType: opts.entityType,
        entityId: opts.entityId ? new Types.ObjectId(opts.entityId) : undefined,
        metadata: opts.metadata,
        occurredAt: new Date(),
      });
    } catch {
      // Swallow — analytics failures must never surface to the user.
    }
  },

  /** Log a search query and result count. Used to surface unanswered searches. */
  async logSearch(opts: {
    userId?: string;
    query: string;
    resultCount: number;
    clickedFaqId?: string;
  }): Promise<void> {
    try {
      await SearchLogModel.create({
        userId: opts.userId ? new Types.ObjectId(opts.userId) : undefined,
        query: opts.query,
        normalizedQuery: opts.query.toLowerCase().trim().replace(/\s+/g, ' '),
        resultCount: opts.resultCount,
        clickedFaqId: opts.clickedFaqId ? new Types.ObjectId(opts.clickedFaqId) : undefined,
        searchedAt: new Date(),
      });
    } catch {
      // Swallow.
    }
  },

  // ─── Cached aggregations ───────────────────────────────────────────────────

  /** Admin portal overview — total counts + 7-day activity snapshot. */
  async getOverview() {
    const cacheKey = 'admin:overview';
    const cached = await readCache(cacheKey);
    if (cached) return cached;

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalFaqs,
      publishedFaqs,
      totalQuestions,
      unresolvedQuestions,
      totalAnswers,
      pendingAnswers,
      totalUsers,
      recentEvents,
    ] = await Promise.all([
      FaqModel.countDocuments({}),
      FaqModel.countDocuments({ status: 'published' }),
      QuestionModel.countDocuments({}),
      QuestionModel.countDocuments({ status: { $in: ['open', 'answered'] } }),
      AnswerModel.countDocuments({}),
      AnswerModel.countDocuments({ status: 'pending' }),
      UserModel.countDocuments({ status: 'active' }),
      AnalyticsEventModel.countDocuments({ occurredAt: { $gte: sevenDaysAgo } }),
    ]);

    const result = {
      faqs: { total: totalFaqs, published: publishedFaqs },
      questions: { total: totalQuestions, unresolved: unresolvedQuestions },
      answers: { total: totalAnswers, pending: pendingAnswers },
      users: { total: totalUsers },
      activityLast7Days: recentEvents,
      computedAt: now.toISOString(),
    };

    await writeCache(cacheKey, result);
    return result;
  },

  /**
   * Issue heatmap — question-ask volume grouped by day.
   * Mirrors remote GET /api/admin/issue-heatmap?days=.
   */
  async getIssueHeatmap(days = 30) {
    const cacheKey = `admin:heatmap:${days}`;
    const cached = await readCache(cacheKey);
    if (cached) return cached;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const buckets = await QuestionModel.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } },
    ]);

    const result = buckets.map((b) => ({
      date: `${b._id.year}-${String(b._id.month).padStart(2, '0')}-${String(b._id.day).padStart(2, '0')}`,
      count: b.count as number,
    }));

    await writeCache(cacheKey, result);
    return result;
  },

  /**
   * Unanswered searches — queries with resultCount = 0 or no FAQ click-through,
   * grouped by normalizedQuery, sorted by frequency.
   * Mirrors remote GET /api/admin/unanswered-searches?limit=.
   */
  async getUnansweredSearches(limit = 20) {
    const cacheKey = `admin:unanswered-searches:${limit}`;
    const cached = await readCache(cacheKey);
    if (cached) return cached;

    const rows = await SearchLogModel.aggregate([
      {
        $match: {
          $or: [{ resultCount: 0 }, { clickedFaqId: null }],
          normalizedQuery: { $ne: '' },
        },
      },
      {
        $group: {
          _id: '$normalizedQuery',
          count: { $sum: 1 },
          lastSearchedAt: { $max: '$searchedAt' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);

    const result = rows.map((r) => ({
      query: r._id as string,
      count: r.count as number,
      lastSearchedAt: (r.lastSearchedAt as Date).toISOString(),
    }));

    await writeCache(cacheKey, result);
    return result;
  },

  /**
   * Daily helpful/unhelpful/flagged vote counts for the last 7 days.
   * Returns an array of 7 objects sorted oldest → newest.
   * Each day that had zero events still appears (filled with 0s).
   */
  async getVotesTrend(): Promise<
    { date: string; helpful: number; unhelpful: number; flagged: number }[]
  > {
    const cacheKey = 'stats:votes-trend';
    const cached = await readCache(cacheKey);
    if (cached)
      return cached as { date: string; helpful: number; unhelpful: number; flagged: number }[];

    const days = 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await AnalyticsEventModel.aggregate([
      {
        $match: {
          eventType: { $in: ['faq_helpful', 'faq_unhelpful', 'faq_flagged'] },
          occurredAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$occurredAt' },
            month: { $month: '$occurredAt' },
            day: { $dayOfMonth: '$occurredAt' },
            type: '$eventType',
          },
          count: { $sum: 1 },
        },
      },
    ]);

    // Build a map of date → counts.
    const map = new Map<string, { helpful: number; unhelpful: number; flagged: number }>();
    for (const row of rows) {
      const dateStr = `${row._id.year}-${String(row._id.month).padStart(2, '0')}-${String(row._id.day).padStart(2, '0')}`;
      if (!map.has(dateStr)) map.set(dateStr, { helpful: 0, unhelpful: 0, flagged: 0 });
      const entry = map.get(dateStr)!;
      if (row._id.type === 'faq_helpful') entry.helpful += row.count as number;
      if (row._id.type === 'faq_unhelpful') entry.unhelpful += row.count as number;
      if (row._id.type === 'faq_flagged') entry.flagged += row.count as number;
    }

    // Fill in all 7 days, oldest first.
    const result: { date: string; helpful: number; unhelpful: number; flagged: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      result.push({
        date: dateStr,
        ...(map.get(dateStr) ?? { helpful: 0, unhelpful: 0, flagged: 0 }),
      });
    }

    await writeCache(cacheKey, result);
    return result;
  },

  /** Recompute qualityScore for all published FAQs. Runs via scheduled job. */
  async recomputeAllQualityScores(): Promise<void> {
    const ids = await FaqModel.find({ status: 'published' }).distinct('_id');
    for (const id of ids) {
      await FaqModel.calculateQualityScore(id.toString());
    }
  },

  /**
   * FAQ quality table — sorted by qualityScore ascending (worst first by default).
   * Mirrors remote GET /api/admin/faq-quality?limit=&sort=.
   */
  async getFaqQuality(opts: { limit?: number; sort?: 'worst' | 'best' } = {}) {
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const sortDir = opts.sort === 'best' ? -1 : 1;

    const cacheKey = `admin:faq-quality:${limit}:${sortDir}`;
    const cached = await readCache(cacheKey);
    if (cached) return cached;

    const faqs = await FaqModel.aggregate([
      {
        $addFields: {
          helpfulnessRatio: {
            $cond: [
              { $gt: [{ $add: ['$helpfulCount', '$unhelpfulCount'] }, 0] },
              { $divide: ['$helpfulCount', { $add: ['$helpfulCount', '$unhelpfulCount'] }] },
              0,
            ],
          },
        },
      },
      { $sort: { qualityScore: sortDir, updatedAt: -1 } },
      { $limit: limit },
      {
        $project: {
          faqId: '$_id',
          title: 1,
          status: 1,
          qualityScore: 1,
          helpfulnessRatio: 1,
          helpfulCount: 1,
          unhelpfulCount: 1,
          viewCount: 1,
          flagCount: 1,
          updatedAt: 1,
        },
      },
    ]);

    const items = faqs.map((faq) => {
      const action =
        (faq.helpfulnessRatio as number) < 0.4 && (faq.viewCount as number) > 50
          ? 'rewrite'
          : (faq.qualityScore as number) < 20 && (faq.viewCount as number) < 10
            ? 'archive'
            : 'ok';
      return { ...faq, action };
    });

    const result = {
      faqs: items,
      summary: `${items.filter((i) => i.action !== 'ok').length} of ${items.length} FAQs need editorial attention.`,
    };

    await writeCache(cacheKey, result);
    return result;
  },

  /**
   * Moderation load — pending queue depth, per-moderator stats, category backlog.
   * Mirrors remote GET /api/admin/moderation-load?days=.
   */
  async getModerationLoad(opts: { days?: number } = {}) {
    const days = Math.min(Math.max(opts.days ?? 14, 1), 90);
    const cacheKey = `admin:moderation-load:${days}`;
    const cached = await readCache(cacheKey);
    if (cached) return cached;

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [pendingDepth, resolvedThisWeek, moderatorStats, categoryBacklog] = await Promise.all([
      AnswerModel.aggregate([
        { $match: { status: 'pending' } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgAgeHours: {
              $avg: { $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60] },
            },
          },
        },
      ]),
      QuestionModel.countDocuments({ status: 'resolved', updatedAt: { $gte: weekStart } }),
      AnswerModel.aggregate([
        {
          $match: {
            moderatorId: { $exists: true, $ne: null },
            updatedAt: { $gte: since },
            status: { $in: ['approved', 'rejected'] },
          },
        },
        {
          $group: {
            _id: '$moderatorId',
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
            avgResponseHours: {
              $avg: { $divide: [{ $subtract: ['$updatedAt', '$createdAt'] }, 1000 * 60 * 60] },
            },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user',
          },
        },
        { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            moderatorId: '$_id',
            name: '$user.name',
            email: '$user.email',
            approved: 1,
            rejected: 1,
            avgResponseHours: { $round: ['$avgResponseHours', 1] },
          },
        },
        { $sort: { approved: -1 } },
      ]),
      QuestionModel.aggregate([
        { $match: { status: 'open', createdAt: { $gte: since } } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'cat',
          },
        },
        { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
        { $project: { category: { $ifNull: ['$cat.name', 'Unknown'] }, count: 1 } },
      ]),
    ]);

    const result = {
      pendingQueueDepth: (pendingDepth[0]?.count as number) ?? 0,
      avgPendingAgeHours: Math.round((pendingDepth[0]?.avgAgeHours as number) ?? 0),
      resolvedThisWeek,
      moderators: moderatorStats,
      categoryBacklog,
    };

    await writeCache(cacheKey, result);
    return result;
  },

  /**
   * Audit log query — paginated, filterable by actor, entityType, action, date range.
   * Mirrors remote GET /api/admin/audit-logs.
   */
  async getAuditLogs(
    opts: {
      page?: number;
      limit?: number;
      actorId?: string;
      entityType?: string;
      action?: string;
      dateRange?: { start?: Date; end?: Date };
    } = {},
  ) {
    const page = Math.max(opts.page ?? 1, 1);
    const limit = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (opts.actorId && Types.ObjectId.isValid(opts.actorId)) {
      filter.actorId = new Types.ObjectId(opts.actorId);
    }
    if (opts.entityType) filter.entityType = opts.entityType;
    if (opts.action) filter.action = { $regex: opts.action, $options: 'i' };
    if (opts.dateRange?.start || opts.dateRange?.end) {
      const dateFilter: Record<string, Date> = {};
      if (opts.dateRange.start) dateFilter.$gte = opts.dateRange.start;
      if (opts.dateRange.end) dateFilter.$lte = opts.dateRange.end;
      filter.createdAt = dateFilter;
    }

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('actorId', 'name email role')
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    return {
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  },
};

// ─── Cache helpers ────────────────────────────────────────────────────────────

async function readCache(key: string): Promise<unknown> {
  const doc = await AnalyticsCacheModel.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
  return doc?.payload ?? null;
}

async function writeCache(key: string, payload: unknown): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  await AnalyticsCacheModel.findOneAndUpdate(
    { key },
    { key, payload, computedAt: new Date(), expiresAt },
    { upsert: true },
  );
}
