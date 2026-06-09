// Aggregate metrics for the FAQ Management dashboard cards.
//
// Helpful%   = average over FAQs with any vote of helpfulCount / (helpfulCount + unhelpfulCount).
//              Reported as 0 when no FAQs have been voted on.
// Flagged%   = flaggedFaqCount / publishedFaqCount, where a flagged FAQ has flagCount > 0
//              OR an open/under_review flag in the Flag collection.
//
// Definitions are documented here so the Dashboard Spec can be audited against them.
import mongoose from 'mongoose';
import { FaqModel } from '../models/Faq.model.js';
import { FlagModel } from '../models/Flag.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { AnswerModel } from '../models/Answer.model.js';
import { UserModel } from '../models/User.model.js';
import { CategoryModel } from '../models/Category.model.js';
import { SystemSettingsModel } from '../models/SystemSettings.model.js';

/**
 * Derives a stable, human-presentable student ID from a Mongo object id. The schema has no
 * dedicated student-ID field yet, so the leaderboard exposes this so users can still search by
 * "ID". Stable because it's a pure function of the immutable `_id`.
 */
function toStudentId(objectId: string): string {
  return `STU-${objectId.slice(-6).toUpperCase()}`;
}

// Leaderboard layout knobs (Kaggle-style collapsed gaps).
const LB_TOP_COUNT = 5;
const LB_BOTTOM_COUNT = 2;
/** Below this cohort size we show every student — collapsing would hide almost nothing. */
const LB_FULL_THRESHOLD = 10;
/** Hard cap on how many rows one gap expansion returns, so a huge gap can't blow up a response. */
const LB_RANGE_MAX = 1000;

/**
 * Computes the full all-time Spurti Points ranking for every active student. Ordered by live
 * `spurtiPoints` (the source-of-truth balance), tie-broken by approved-answer count then name, so
 * the ranking updates automatically as points change and no denormalised rank column can drift.
 *
 * Shared by the default board, gap-range expansion, and search so they always agree. The sort is
 * in-process (one indexed `find` + one aggregation); for very large cohorts this should move to a
 * `$sort`/`$setWindowFields` aggregation on the existing `spurtiPoints` index.
 */
async function computeLeaderboardRanking(currentUserId: string): Promise<LeaderboardRow[]> {
  const answersByStudent = await AnswerModel.aggregate<{
    _id: mongoose.Types.ObjectId;
    approvedAnswers: number;
  }>([
    { $match: { status: 'approved' } },
    { $group: { _id: '$answeredBy', approvedAnswers: { $sum: 1 } } },
  ]);
  const approvedByUser = new Map(
    answersByStudent.map((row) => [row._id.toString(), row.approvedAnswers]),
  );

  const students = await UserModel.find({ role: 'student', status: 'active' })
    .select('name spurtiPoints')
    .lean<{ _id: mongoose.Types.ObjectId; name: string; spurtiPoints?: number }[]>();

  return students
    .map((s) => {
      const id = s._id.toString();
      return {
        rank: 0,
        userId: id,
        studentId: toStudentId(id),
        name: s.name,
        spurtiPoints: s.spurtiPoints ?? 0,
        approvedAnswers: approvedByUser.get(id) ?? 0,
        isMe: id === currentUserId,
      };
    })
    .sort((a, b) => {
      if (b.spurtiPoints !== a.spurtiPoints) return b.spurtiPoints - a.spurtiPoints;
      if (b.approvedAnswers !== a.approvedAnswers) return b.approvedAnswers - a.approvedAnswers;
      return a.name.localeCompare(b.name);
    })
    .map((r, idx) => ({ ...r, rank: idx + 1 }));
}

/** Builds a gap descriptor for an inclusive rank range, or null when the range is empty. */
function makeGap(fromRank: number, toRank: number): LeaderboardGap | null {
  if (fromRank > toRank) return null;
  return { fromRank, toRank, count: toRank - fromRank + 1 };
}

export interface FaqStats {
  totalFaqs: number;
  publishedFaqs: number;
  helpfulPercentage: number;
  flaggedPercentage: number;
  flaggedCount: number;
}

export interface StudentHomeStats {
  /** Open community questions — both `open` and `answered` (anything not yet resolved). */
  openCommunityQuestions: number;
  /** Subset above with no answers yet. */
  unansweredCommunityQuestions: number;
  /** Approved answers authored by this student. */
  questionsYouAnswered: number;
  /** Live Spurti Points balance. */
  spurtiPoints: number;
}

/**
 * Everything the redesigned Student Dashboard renders, in one fetch. Each field maps
 * to a card/widget so the client never hardcodes a number:
 *   - questionsAsked / answered carry a `thisWeek` delta for the "↑ N this week" tag.
 *   - pending  = the student's own questions still awaiting a first response.
 *   - community = open community-queue health (mirrors the idle-bucket semantics).
 *   - contribution = the bottom "snapshot" strip.
 */
export interface StudentDashboardStats {
  questionsAsked: { total: number; thisWeek: number };
  /** Student's own questions still `open` (awaiting a response). */
  pending: number;
  answered: { total: number; thisWeek: number };
  spurtiPoints: number;
  community: {
    /** Open community questions (status ∈ {open, answered}) — panel total. */
    totalOpen: number;
    /** Open community questions touched within the last hour. */
    activeLastHour: number;
    /** Open community questions idle 3–7 days (need attention). */
    idleOver3Days: number;
    /** Open community questions idle more than 7 days (follow-up). */
    idleOver1Week: number;
  };
  contribution: {
    /** Approved answers left on questions this student asked. */
    acceptedAnswers: number;
    /** Answers this student authored for the community. */
    answersGiven: number;
    /** Total upvotes across this student's approved answers. */
    upvotesReceived: number;
    /** % of this student's questions that received at least one answer. */
    responseRate: number;
  };
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  /** Human-presentable student identifier derived from the Mongo id (no real field exists yet). */
  studentId: string;
  name: string;
  spurtiPoints: number;
  approvedAnswers: number;
  isMe: boolean;
}

/** A collapsed range of consecutive ranks that the client renders as one expandable row. */
export interface LeaderboardGap {
  fromRank: number;
  toRank: number;
  count: number;
}

export interface LeaderboardResponse {
  /** Total ranked students — the denominator for "rank N of M". */
  totalStudents: number;
  /**
   * Whole ranked list, populated ONLY for small cohorts (< 10 students) where collapsing makes
   * no sense. When set the client renders these plainly and ignores top/me/bottom/gaps.
   */
  full: LeaderboardRow[] | null;
  /** Top 5 ranked students (Kaggle-style head). Empty when `full` is set. */
  top: LeaderboardRow[];
  /** Current user's row — present only when they fall outside the top and bottom slices. */
  me: LeaderboardRow | null;
  /** Bottom 2 ranked students. Empty when `full` is set. */
  bottom: LeaderboardRow[];
  /** Collapsed gap right after the top — before `me` (or before the bottom when `me` is null). */
  gapTop: LeaderboardGap | null;
  /** Collapsed gap after `me` and before the bottom. Null unless `me` is shown. */
  gapBottom: LeaderboardGap | null;
  /** Populated only when a search query is supplied; null otherwise. */
  search: { query: string; results: LeaderboardRow[] } | null;
}

/** Rows for one expanded collapsed-gap range. */
export interface LeaderboardRangeResponse {
  fromRank: number;
  toRank: number;
  rows: LeaderboardRow[];
}

/**
 * Idle-bucket counts for **open community questions** (status ∈ {open, answered}).
 * Buckets are mutually exclusive so a question is counted exactly once:
 *   - last24h:  updatedAt within the last 24 hours
 *   - over3days: updatedAt is older than 3 days but newer than 7 days
 *   - over1week: updatedAt is older than 7 days
 *
 * Activity proxy: `updatedAt`. Mongoose bumps it on save; submitting an answer also
 * touches the question (via $inc on answerCount), so a fresh answer "wakes" the row.
 */
export interface IdleBuckets {
  last24h: number;
  over3days: number;
  over1week: number;
  /** Convenience total of all three buckets — equals openCommunityQuestions overall. */
  totalOpen: number;
}

export const statsService = {
  async getFaqStats(): Promise<FaqStats> {
    const [totalFaqs, publishedFaqs, votedAgg, flaggedFaqIds] = await Promise.all([
      FaqModel.countDocuments({}),
      FaqModel.countDocuments({ status: 'published' }),
      FaqModel.aggregate<{ ratio: number }>([
        { $match: { status: 'published' } },
        {
          $project: {
            total: { $add: ['$helpfulCount', '$unhelpfulCount'] },
            helpful: '$helpfulCount',
          },
        },
        { $match: { total: { $gt: 0 } } },
        { $project: { ratio: { $divide: ['$helpful', '$total'] } } },
        { $group: { _id: null, avg: { $avg: '$ratio' } } },
        { $project: { _id: 0, ratio: { $ifNull: ['$avg', 0] } } },
      ]),
      // FAQs with any open flag — counts each FAQ only once even if multiple flags exist.
      FlagModel.distinct('entityId', {
        entityType: 'faq',
        status: { $in: ['open', 'under_review'] },
      }),
    ]);

    const flaggedCount = flaggedFaqIds.length;
    const helpfulPercentage =
      Math.round(((votedAgg[0]?.ratio ?? 0) * 100 + Number.EPSILON) * 10) / 10;
    const flaggedPercentage =
      publishedFaqs > 0 ? Math.round((flaggedCount / publishedFaqs) * 1000) / 10 : 0;

    return {
      totalFaqs,
      publishedFaqs,
      helpfulPercentage,
      flaggedPercentage,
      flaggedCount,
    };
  },

  /**
   * Stats that drive the four cards on the student home page.
   * Counts approved answers from day 1 (PRD: "from day 1").
   */
  async getStudentHomeStats(userId: string): Promise<StudentHomeStats> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const [openCommunityQuestions, unansweredCommunityQuestions, questionsYouAnswered, user] =
      await Promise.all([
        QuestionModel.countDocuments({
          type: 'community',
          status: { $in: ['open', 'answered'] },
        }),
        QuestionModel.countDocuments({ type: 'community', status: 'open', answerCount: 0 }),
        AnswerModel.countDocuments({ answeredBy: userObjectId, status: 'approved' }),
        UserModel.findById(userId).select('spurtiPoints').lean<{ spurtiPoints?: number }>(),
      ]);
    return {
      openCommunityQuestions,
      unansweredCommunityQuestions,
      questionsYouAnswered,
      spurtiPoints: user?.spurtiPoints ?? 0,
    };
  },

  /**
   * Single-fetch payload for the redesigned Student Dashboard. Every metric is derived
   * live from the database so the cards reflect the student's real activity; the client
   * polls this endpoint (and invalidates it on relevant mutations) for near-real-time updates.
   */
  async getStudentDashboardStats(userId: string): Promise<StudentDashboardStats> {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const weekAgo = new Date(now - 7 * day);
    const hourAgo = new Date(now - 60 * 60 * 1000);
    const threeDaysAgo = new Date(now - 3 * day);
    const sevenDaysAgo = new Date(now - 7 * day);
    const openCommunity = { type: 'community', status: { $in: ['open', 'answered'] } };

    const [
      questionsAskedTotal,
      questionsAskedThisWeek,
      pending,
      answeredTotal,
      answeredThisWeek,
      answeredQuestionsCount,
      user,
      communityTotalOpen,
      communityActiveLastHour,
      communityIdle3to7,
      communityIdleOver7,
      answersGiven,
      acceptedAnswersAgg,
      upvotesAgg,
    ] = await Promise.all([
      QuestionModel.countDocuments({ askedBy: userObjectId }),
      QuestionModel.countDocuments({ askedBy: userObjectId, createdAt: { $gte: weekAgo } }),
      QuestionModel.countDocuments({ askedBy: userObjectId, status: 'open' }),
      QuestionModel.countDocuments({
        askedBy: userObjectId,
        status: { $in: ['answered', 'resolved'] },
      }),
      QuestionModel.countDocuments({
        askedBy: userObjectId,
        status: { $in: ['answered', 'resolved'] },
        updatedAt: { $gte: weekAgo },
      }),
      QuestionModel.countDocuments({ askedBy: userObjectId, answerCount: { $gt: 0 } }),
      UserModel.findById(userId).select('spurtiPoints').lean<{ spurtiPoints?: number }>(),
      QuestionModel.countDocuments(openCommunity),
      QuestionModel.countDocuments({ ...openCommunity, updatedAt: { $gte: hourAgo } }),
      QuestionModel.countDocuments({
        ...openCommunity,
        updatedAt: { $lt: threeDaysAgo, $gte: sevenDaysAgo },
      }),
      QuestionModel.countDocuments({ ...openCommunity, updatedAt: { $lt: sevenDaysAgo } }),
      AnswerModel.countDocuments({ answeredBy: userObjectId }),
      // Approved answers left on questions this student asked ("accepted answers").
      AnswerModel.aggregate<{ n: number }>([
        { $match: { status: 'approved' } },
        {
          $lookup: {
            from: 'questions',
            localField: 'questionId',
            foreignField: '_id',
            as: 'q',
          },
        },
        { $unwind: '$q' },
        { $match: { 'q.askedBy': userObjectId } },
        { $count: 'n' },
      ]),
      // Total upvotes across this student's approved answers.
      AnswerModel.aggregate<{ total: number }>([
        { $match: { answeredBy: userObjectId, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$upvoteCount' } } },
      ]),
    ]);

    const responseRate =
      questionsAskedTotal > 0
        ? Math.round((answeredQuestionsCount / questionsAskedTotal) * 100)
        : 0;

    return {
      questionsAsked: { total: questionsAskedTotal, thisWeek: questionsAskedThisWeek },
      pending,
      answered: { total: answeredTotal, thisWeek: answeredThisWeek },
      spurtiPoints: user?.spurtiPoints ?? 0,
      community: {
        totalOpen: communityTotalOpen,
        activeLastHour: communityActiveLastHour,
        idleOver3Days: communityIdle3to7,
        idleOver1Week: communityIdleOver7,
      },
      contribution: {
        acceptedAnswers: acceptedAnswersAgg[0]?.n ?? 0,
        answersGiven,
        upvotesReceived: upvotesAgg[0]?.total ?? 0,
        responseRate,
      },
    };
  },

  /**
   * Kaggle-style Spurti Points leaderboard for the student home dashboard.
   *
   * The default view collapses the long middle of the table into expandable "gap" rows so the
   * client only ships a handful of rows regardless of cohort size: top 5 → collapsed gap → the
   * caller's own row → collapsed gap → bottom 2. Gap ranges are computed from the live ranking
   * and the caller's position; the client expands a gap on demand via {@link getLeaderboardRange}.
   *
   * - Cohorts under {@link LB_FULL_THRESHOLD} are returned whole (in `full`) with no gaps.
   * - When the caller sits inside the top 5 or bottom 2 there is a single middle gap and no
   *   dedicated "Your Rank" row (it would duplicate a highlighted row already on screen).
   * - When `search` is supplied we instead filter the whole ranked cohort by rank number, name,
   *   or student ID (case-insensitive, partial) and return up to 50 matches.
   *
   * See {@link computeLeaderboardRanking} for how ranking stays live and the scaling note.
   */
  async getLeaderboard(currentUserId: string, search?: string): Promise<LeaderboardResponse> {
    const ranked = await computeLeaderboardRanking(currentUserId);
    const totalStudents = ranked.length;

    const empty: LeaderboardResponse = {
      totalStudents,
      full: null,
      top: [],
      me: null,
      bottom: [],
      gapTop: null,
      gapBottom: null,
      search: null,
    };

    // Search mode: match against rank number, name, or student ID across the whole cohort.
    const query = (search ?? '').trim();
    if (query) {
      const lower = query.toLowerCase();
      const asRank = Number.parseInt(query.replace(/^#/, ''), 10);
      const results = ranked
        .filter(
          (r) =>
            r.name.toLowerCase().includes(lower) ||
            r.studentId.toLowerCase().includes(lower) ||
            (Number.isInteger(asRank) && r.rank === asRank),
        )
        .slice(0, 50);
      return { ...empty, search: { query, results } };
    }

    // Small cohort: skip collapsing entirely and return everyone.
    if (totalStudents < LB_FULL_THRESHOLD) {
      return { ...empty, full: ranked };
    }

    const top = ranked.slice(0, LB_TOP_COUNT); // ranks 1..5
    const bottom = ranked.slice(totalStudents - LB_BOTTOM_COUNT); // ranks (T-1)..T
    const meRow = ranked.find((r) => r.isMe) ?? null;
    const meRank = meRow?.rank ?? 0;
    const inTop = meRank >= 1 && meRank <= LB_TOP_COUNT;
    const inBottom = meRank >= totalStudents - LB_BOTTOM_COUNT + 1;
    const showMe = Boolean(meRow) && !inTop && !inBottom;

    // Last rank that still belongs to the collapsible middle (everything above the bottom slice).
    const middleEnd = totalStudents - LB_BOTTOM_COUNT;

    if (showMe) {
      return {
        ...empty,
        top,
        me: meRow,
        bottom,
        gapTop: makeGap(LB_TOP_COUNT + 1, meRank - 1),
        gapBottom: makeGap(meRank + 1, middleEnd),
      };
    }

    // Caller is inside the top/bottom (or has no rank): one middle gap, no dedicated row.
    return { ...empty, top, me: null, bottom, gapTop: makeGap(LB_TOP_COUNT + 1, middleEnd) };
  },

  /**
   * Returns the ranked rows for one collapsed-gap range (inclusive 1-based ranks). Used when the
   * user expands a "View N more" row. The range is clamped to the cohort and capped at
   * {@link LB_RANGE_MAX} rows so a giant gap can't produce an unbounded response.
   */
  async getLeaderboardRange(
    currentUserId: string,
    fromRank: number,
    toRank: number,
  ): Promise<LeaderboardRangeResponse> {
    const ranked = await computeLeaderboardRanking(currentUserId);
    const from = Math.max(1, Math.min(fromRank, toRank));
    const to = Math.min(ranked.length, Math.max(fromRank, toRank));
    const end = Math.min(to, from - 1 + LB_RANGE_MAX);
    return { fromRank: from, toRank: end, rows: ranked.slice(from - 1, end) };
  },

  /**
   * Single-aggregation idle bucket counts for the open community queue.
   * Used by both the dashboard cards and the community-page filter chips, so the
   * card and the filter always agree.
   *
   * Bucket math (mutually exclusive — every open community question fits exactly one):
   *   - last24h:   updatedAt within the last 24 hours
   *   - over3days: updatedAt is older than 24h but newer than 7 days  (the "needs a nudge" middle)
   *   - over1week: updatedAt is older than 7 days
   *
   * The middle bucket spans 24h–7d so the three counts always sum to totalOpen. The spec
   * literally says "more than 3 days", but a strict > 3d cutoff would leave open questions
   * idle for 1-3 days uncounted on every dashboard, which is worse than a slightly wider
   * middle bucket. Documented here so future readers can see the choice.
   */
  async getCommunityIdleBuckets(): Promise<IdleBuckets> {
    const settings = await SystemSettingsModel.findById('global').lean();
    const urgentIdleDays = settings?.urgentIdleDays ?? 7;
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    const threshold24h = new Date(now - day);
    const threshold7d = new Date(now - urgentIdleDays * day);

    const [row] = await QuestionModel.aggregate<{
      last24h: number;
      over3days: number;
      over1week: number;
      totalOpen: number;
    }>([
      { $match: { type: 'community', status: { $in: ['open', 'answered'] } } },
      {
        $facet: {
          last24h: [{ $match: { updatedAt: { $gte: threshold24h } } }, { $count: 'n' }],
          over3days: [
            { $match: { updatedAt: { $lt: threshold24h, $gte: threshold7d } } },
            { $count: 'n' },
          ],
          over1week: [{ $match: { updatedAt: { $lt: threshold7d } } }, { $count: 'n' }],
          totalOpen: [{ $count: 'n' }],
        },
      },
      {
        $project: {
          last24h: { $ifNull: [{ $arrayElemAt: ['$last24h.n', 0] }, 0] },
          over3days: { $ifNull: [{ $arrayElemAt: ['$over3days.n', 0] }, 0] },
          over1week: { $ifNull: [{ $arrayElemAt: ['$over1week.n', 0] }, 0] },
          totalOpen: { $ifNull: [{ $arrayElemAt: ['$totalOpen.n', 0] }, 0] },
        },
      },
    ]);

    return row ?? { last24h: 0, over3days: 0, over1week: 0, totalOpen: 0 };
  },

  /**
   * Admin intelligence metrics — single-screen system-health overview.
   */
  async getAdminIntelligenceStats(): Promise<AdminIntelligenceStats> {
    const [
      unresolvedQuestions,
      pendingModerationItems,
      faqsNeedingReview,
      faqStats,
      avgResolutionTime,
      qualityAlerts,
    ] = await Promise.all([
      QuestionModel.countDocuments({ status: { $in: ['open', 'answered'] } }),
      AnswerModel.countDocuments({ status: 'pending' }),
      FaqModel.countDocuments({ status: { $in: ['draft', 'outdated'] } }),
      this.getFaqStats(),
      this._computeAvgResolutionTime(),
      this._computeQualityAlerts(5),
    ]);

    return {
      unresolvedQuestions,
      pendingModerationItems,
      faqsNeedingReview,
      avgResolutionTimeHours: avgResolutionTime,
      publishedFaqs: faqStats.publishedFaqs,
      totalFaqs: faqStats.totalFaqs,
      helpfulPercentage: faqStats.helpfulPercentage,
      flaggedCount: faqStats.flaggedCount,
      qualityAlerts,
    };
  },

  /**
   * Average time (in hours) from question creation to resolved status.
   * Only considers community questions resolved in the last 30 days.
   */
  async _computeAvgResolutionTime(): Promise<number> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [result] = await QuestionModel.aggregate<{ avgHours: number }>([
      { $match: { status: 'resolved', updatedAt: { $gte: thirtyDaysAgo } } },
      {
        $project: {
          resolutionMs: { $subtract: ['$updatedAt', '$createdAt'] },
        },
      },
      {
        $group: {
          _id: null,
          avgMs: { $avg: '$resolutionMs' },
        },
      },
      {
        $project: {
          _id: 0,
          avgHours: { $round: [{ $divide: ['$avgMs', 3600000] }, 1] },
        },
      },
    ]);
    return result?.avgHours ?? 0;
  },

  /**
   * Top N FAQs that are at quality risk — high flag ratio or low helpful ratio.
   */
  async _computeQualityAlerts(limit: number): Promise<QualityAlert[]> {
    const faqs = await FaqModel.find({ status: 'published' })
      .select('title helpfulCount unhelpfulCount flagCount viewCount updatedAt')
      .lean();

    const scored = faqs.map((faq) => {
      const total = (faq.helpfulCount ?? 0) + (faq.unhelpfulCount ?? 0);
      const helpfulRatio = total > 0 ? (faq.helpfulCount ?? 0) / total : 0.5;
      const flagRatio = (faq.viewCount ?? 0) > 0 ? (faq.flagCount ?? 0) / (faq.viewCount ?? 1) : 0;
      // Lower score = higher risk
      const qualityScore = Math.round(
        (0.4 * helpfulRatio +
          0.35 * (1 - Math.min(flagRatio * 10, 1)) +
          0.25 * computeFreshnessScore(faq.updatedAt)) *
          100,
      );
      return {
        id: faq._id.toString(),
        title: faq.title,
        qualityScore,
        helpfulRatio: Math.round(helpfulRatio * 100),
        flagCount: faq.flagCount ?? 0,
        viewCount: faq.viewCount ?? 0,
        updatedAt: faq.updatedAt.toISOString(),
      };
    });

    // Sort by quality score ascending (worst first), take top N.
    scored.sort((a, b) => a.qualityScore - b.qualityScore);
    return scored.slice(0, limit);
  },

  /**
   * Per-moderator performance stats — approvals, rejections, avg response time.
   */
  async getModerationLoadStats(): Promise<ModerationLoadStats> {
    const now = Date.now();
    const todayStart = new Date(now - (now % (24 * 60 * 60 * 1000)));
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    // Per-moderator aggregation from Answer.moderatorId
    const modPerformance = await AnswerModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      totalApprovals: number;
      totalRejections: number;
      approvalsThisWeek: number;
      avgResponseTimeMs: number;
    }>([
      { $match: { moderatorId: { $exists: true, $ne: null } } },
      {
        $facet: {
          byMod: [
            {
              $group: {
                _id: '$moderatorId',
                totalApprovals: {
                  $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] },
                },
                totalRejections: {
                  $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] },
                },
                approvalsThisWeek: {
                  $sum: {
                    $cond: [
                      {
                        $and: [
                          { $eq: ['$status', 'approved'] },
                          { $gte: ['$approvedAt', weekAgo] },
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                avgResponseTimeMs: {
                  $avg: { $subtract: ['$updatedAt', '$createdAt'] },
                },
              },
            },
          ],
        },
      },
      { $unwind: '$byMod' },
      { $replaceRoot: { newRoot: '$byMod' } },
    ]);

    // Look up moderator names
    const modIds = modPerformance.map((m) => m._id);
    const moderators = await UserModel.find({ _id: { $in: modIds } })
      .select('name email')
      .lean();
    const modMap = new Map(
      moderators.map((m) => [m._id.toString(), { name: m.name, email: m.email }]),
    );

    const moderatorMetrics: ModeratorMetric[] = modPerformance.map((m) => ({
      moderatorId: m._id.toString(),
      name: modMap.get(m._id.toString())?.name ?? 'Unknown',
      email: modMap.get(m._id.toString())?.email ?? '',
      totalApprovals: m.totalApprovals,
      totalRejections: m.totalRejections,
      approvalsThisWeek: m.approvalsThisWeek,
      avgResponseTimeHours: Math.round((m.avgResponseTimeMs / 3600000) * 10) / 10,
    }));

    // Category backlog
    const categoryBacklog = await AnswerModel.aggregate<{
      category: string;
      count: number;
    }>([
      { $match: { status: 'pending' } },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionId',
          foreignField: '_id',
          as: 'question',
        },
      },
      { $unwind: '$question' },
      {
        $lookup: {
          from: 'categories',
          localField: 'question.category',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$cat.name', count: { $sum: 1 } } },
      { $project: { _id: 0, category: { $ifNull: ['$_id', 'Uncategorized'] }, count: 1 } },
      { $sort: { count: -1 } },
    ]);

    const pendingTotal = await AnswerModel.countDocuments({ status: 'pending' });

    return {
      pendingQueueDepth: pendingTotal,
      moderators: moderatorMetrics,
      categoryBacklog,
    };
  },

  /**
   * Personal stats for a specific moderator (their own analytics page).
   */
  async getModeratorPersonalStats(moderatorId: string): Promise<ModeratorPersonalStats> {
    const now = Date.now();
    const todayStart = new Date(now - (now % (24 * 60 * 60 * 1000)));
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const modObjectId = new mongoose.Types.ObjectId(moderatorId);

    const [approvalsToday, approvalsThisWeek, totalApprovals, totalRejections, avgTime] =
      await Promise.all([
        AnswerModel.countDocuments({
          moderatorId: modObjectId,
          status: 'approved',
          approvedAt: { $gte: todayStart },
        }),
        AnswerModel.countDocuments({
          moderatorId: modObjectId,
          status: 'approved',
          approvedAt: { $gte: weekAgo },
        }),
        AnswerModel.countDocuments({ moderatorId: modObjectId, status: 'approved' }),
        AnswerModel.countDocuments({ moderatorId: modObjectId, status: 'rejected' }),
        AnswerModel.aggregate<{ avgMs: number }>([
          { $match: { moderatorId: modObjectId, status: { $in: ['approved', 'rejected'] } } },
          { $group: { _id: null, avgMs: { $avg: { $subtract: ['$updatedAt', '$createdAt'] } } } },
        ]),
      ]);

    // Category breakdown for this moderator
    const categoryBreakdown = await AnswerModel.aggregate<{
      category: string;
      count: number;
    }>([
      { $match: { moderatorId: modObjectId, status: { $in: ['approved', 'rejected'] } } },
      {
        $lookup: {
          from: 'questions',
          localField: 'questionId',
          foreignField: '_id',
          as: 'question',
        },
      },
      { $unwind: '$question' },
      {
        $lookup: {
          from: 'categories',
          localField: 'question.category',
          foreignField: '_id',
          as: 'cat',
        },
      },
      { $unwind: { path: '$cat', preserveNullAndEmptyArrays: true } },
      { $group: { _id: '$cat.name', count: { $sum: 1 } } },
      { $project: { _id: 0, category: { $ifNull: ['$_id', 'Uncategorized'] }, count: 1 } },
      { $sort: { count: -1 } },
    ]);

    return {
      approvalsToday,
      approvalsThisWeek,
      totalApprovals,
      totalRejections,
      avgResponseTimeHours: Math.round(((avgTime[0]?.avgMs ?? 0) / 3600000) * 10) / 10,
      categoryBreakdown,
    };
  },

  /**
   * FAQs with computed quality scores for the admin FAQ Quality page.
   */
  async listFaqsForQuality(filter: 'all' | 'rewrite' | 'archive'): Promise<FaqQualityRow[]> {
    const faqs = await FaqModel.find({ status: { $in: ['published', 'outdated'] } })
      .select('title helpfulCount unhelpfulCount flagCount viewCount status updatedAt categories')
      .populate('categories', 'name')
      .lean();

    const rows: FaqQualityRow[] = faqs.map((faq) => {
      const total = (faq.helpfulCount ?? 0) + (faq.unhelpfulCount ?? 0);
      const helpfulRatio = total > 0 ? (faq.helpfulCount ?? 0) / total : 0.5;
      const flagRatio = (faq.viewCount ?? 0) > 0 ? (faq.flagCount ?? 0) / (faq.viewCount ?? 1) : 0;
      const freshness = computeFreshnessScore(faq.updatedAt);
      const qualityScore = Math.round(
        (0.4 * helpfulRatio + 0.35 * (1 - Math.min(flagRatio * 10, 1)) + 0.25 * freshness) * 100,
      );

      let classification: 'good' | 'rewrite' | 'archive' = 'good';
      if (qualityScore < 30) classification = 'archive';
      else if (qualityScore < 60) classification = 'rewrite';

      const cats = (faq.categories as unknown as { name: string }[]) ?? [];

      return {
        id: faq._id.toString(),
        title: faq.title,
        qualityScore,
        helpfulRatio: Math.round(helpfulRatio * 100),
        flagCount: faq.flagCount ?? 0,
        viewCount: faq.viewCount ?? 0,
        status: faq.status as string,
        classification,
        category: cats[0]?.name ?? '—',
        updatedAt: faq.updatedAt.toISOString(),
      };
    });

    rows.sort((a, b) => a.qualityScore - b.qualityScore);

    if (filter === 'rewrite') return rows.filter((r) => r.classification === 'rewrite');
    if (filter === 'archive') return rows.filter((r) => r.classification === 'archive');
    return rows;
  },

  /** All counts needed by the moderator dashboard — 5 cards. */
  async getModeratorDashboardStats(): Promise<ModeratorDashboardStats> {
    const now = Date.now();
    const todayStart = new Date(now - (now % (24 * 60 * 60 * 1000)));
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      // Personal questions
      personalTotal,
      personalUnanswered,
      personalToday,
      // Community questions (all-time)
      communityTotal,
      communityAnswered,
      communityUnanswered,
      // Community questions today
      communityTodayTotal,
      communityTodayAnswered,
      communityTodayUnanswered,
      // FAQs
      faqTotal,
      faqToday,
      faqThisWeek,
      // Flagged FAQs
      flaggedTotal,
      flaggedToday,
      flaggedThisWeek,
      // Published FAQs count (denominator for helpful/unhelpful %)
      publishedTotal,
      // Helpful/unhelpful aggregation
      engagementAgg,
    ] = await Promise.all([
      // --- Personal questions ---
      QuestionModel.countDocuments({ type: 'personal' }),
      QuestionModel.countDocuments({ type: 'personal', answerCount: 0 }),
      QuestionModel.countDocuments({ type: 'personal', createdAt: { $gte: todayStart } }),
      // --- Community questions all-time ---
      QuestionModel.countDocuments({ type: 'community' }),
      QuestionModel.countDocuments({ type: 'community', answerCount: { $gt: 0 } }),
      QuestionModel.countDocuments({ type: 'community', answerCount: 0 }),
      // --- Community questions today ---
      QuestionModel.countDocuments({ type: 'community', createdAt: { $gte: todayStart } }),
      QuestionModel.countDocuments({
        type: 'community',
        createdAt: { $gte: todayStart },
        answerCount: { $gt: 0 },
      }),
      QuestionModel.countDocuments({
        type: 'community',
        createdAt: { $gte: todayStart },
        answerCount: 0,
      }),
      // --- FAQs ---
      FaqModel.countDocuments({}),
      FaqModel.countDocuments({ createdAt: { $gte: todayStart } }),
      FaqModel.countDocuments({ createdAt: { $gte: weekAgo } }),
      // --- Flagged FAQs (distinct FAQs with an open/under_review flag) ---
      FlagModel.distinct('entityId', {
        entityType: 'faq',
        status: { $in: ['open', 'under_review'] },
      }).then((ids) => ids.length),
      FlagModel.distinct('entityId', {
        entityType: 'faq',
        status: { $in: ['open', 'under_review'] },
        createdAt: { $gte: todayStart },
      }).then((ids) => ids.length),
      FlagModel.distinct('entityId', {
        entityType: 'faq',
        status: { $in: ['open', 'under_review'] },
        createdAt: { $gte: weekAgo },
      }).then((ids) => ids.length),
      // --- Published FAQs ---
      FaqModel.countDocuments({ status: 'published' }),
      // --- Helpful / unhelpful aggregate across published FAQs ---
      FaqModel.aggregate<{ totalHelpful: number; totalUnhelpful: number }>([
        { $match: { status: 'published' } },
        {
          $group: {
            _id: null,
            totalHelpful: { $sum: '$helpfulCount' },
            totalUnhelpful: { $sum: '$unhelpfulCount' },
          },
        },
      ]).then((r) => r[0] ?? { totalHelpful: 0, totalUnhelpful: 0 }),
    ]);

    const totalVotes = engagementAgg.totalHelpful + engagementAgg.totalUnhelpful;
    const helpfulPct = totalVotes > 0 ? (engagementAgg.totalHelpful / totalVotes) * 100 : 0;
    const unhelpfulPct = totalVotes > 0 ? (engagementAgg.totalUnhelpful / totalVotes) * 100 : 0;

    return {
      personal: { total: personalTotal, unanswered: personalUnanswered, today: personalToday },
      community: {
        total: communityTotal,
        answered: communityAnswered,
        unanswered: communityUnanswered,
      },
      communityToday: {
        total: communityTodayTotal,
        answered: communityTodayAnswered,
        unanswered: communityTodayUnanswered,
      },
      faqs: { total: faqTotal, today: faqToday, thisWeek: faqThisWeek },
      flaggedFaqs: { total: flaggedTotal, today: flaggedToday, thisWeek: flaggedThisWeek },
      helpfulFaqs: { percentage: Math.round(helpfulPct * 10) / 10, publishedTotal },
      unhelpfulFaqs: { percentage: Math.round(unhelpfulPct * 10) / 10, publishedTotal },
    };
  },

  /**
   * One-shot payload for the Admin Dashboard. Every section the page renders comes from
   * this single snapshot so all counts/percentages/lists are mutually consistent — the
   * client polls this endpoint for near-real-time refresh. Each sub-section is computed by
   * a focused private helper; the helpers run in parallel.
   */
  async getAdminDashboard(): Promise<AdminDashboard> {
    const [
      actionRequired,
      todayOverview,
      performance,
      moderationQueue,
      platformHealth,
      topCategories,
      recentActivity,
    ] = await Promise.all([
      this._dashActionRequired(),
      this._dashTodayOverview(),
      this._dashPerformance(),
      this._dashModerationQueue(),
      this._dashPlatformHealth(),
      this._dashTopCategories(),
      this._dashRecentActivity(),
    ]);

    return {
      actionRequired,
      todayOverview,
      performance,
      moderationQueue,
      platformHealth,
      topCategories,
      recentActivity,
      generatedAt: new Date().toISOString(),
    };
  },

  /** "Action Required" strip — four counters that gate moderator attention. */
  async _dashActionRequired(): Promise<AdminDashboard['actionRequired']> {
    const [pendingModeration, flaggedContent, unansweredQuestions, faqReviewsPending] =
      await Promise.all([
        AnswerModel.countDocuments({ status: 'pending' }),
        FlagModel.countDocuments({ status: { $in: ['open', 'under_review'] } }),
        QuestionModel.countDocuments({ status: 'open', answerCount: 0 }),
        FaqModel.countDocuments({
          $or: [
            { status: { $in: ['draft', 'outdated'] } },
            { reviewState: { $in: ['needs_review', 'in_review'] } },
          ],
        }),
      ]);
    return { pendingModeration, flaggedContent, unansweredQuestions, faqReviewsPending };
  },

  /** "Today's Overview" — today's volume per metric with a % change vs yesterday. */
  async _dashTodayOverview(): Promise<AdminDashboard['todayOverview']> {
    const todayStart = startOfDay(new Date());
    const yesterdayStart = new Date(todayStart.getTime() - DAY_MS);
    const todayRange = { $gte: todayStart };
    const yesterdayRange = { $gte: yesterdayStart, $lt: todayStart };

    const [
      qToday,
      qYesterday,
      aToday,
      aYesterday,
      fToday,
      fYesterday,
      activeToday,
      activeYesterday,
    ] = await Promise.all([
      QuestionModel.countDocuments({ createdAt: todayRange }),
      QuestionModel.countDocuments({ createdAt: yesterdayRange }),
      AnswerModel.countDocuments({ createdAt: todayRange }),
      AnswerModel.countDocuments({ createdAt: yesterdayRange }),
      FaqModel.countDocuments({ createdAt: todayRange }),
      FaqModel.countDocuments({ createdAt: yesterdayRange }),
      countActiveUsers(todayRange),
      countActiveUsers(yesterdayRange),
    ]);

    return {
      questions: { count: qToday, deltaPct: pctChange(qToday, qYesterday) },
      answers: { count: aToday, deltaPct: pctChange(aToday, aYesterday) },
      newFaqs: { count: fToday, deltaPct: pctChange(fToday, fYesterday) },
      activeStudents: { count: activeToday, deltaPct: pctChange(activeToday, activeYesterday) },
    };
  },

  /** "Performance Overview" — four trend cards (total, delta vs previous period, sparkline). */
  async _dashPerformance(): Promise<AdminDashboard['performance']> {
    const now = Date.now();
    const last7 = new Date(now - 7 * DAY_MS);
    const prev7 = new Date(now - 14 * DAY_MS);
    const last30 = new Date(now - 30 * DAY_MS);
    const prev30 = new Date(now - 60 * DAY_MS);

    const [
      questionsSeries,
      questionsLast7,
      questionsPrev7,
      answersSeries,
      answersLast7,
      answersPrev7,
      faqsSeries,
      faqsLast30,
      faqsPrev30,
      respSeries,
      respLast7,
      respPrev7,
    ] = await Promise.all([
      dailySeries(QuestionModel, 'createdAt', 7),
      QuestionModel.countDocuments({ createdAt: { $gte: last7 } }),
      QuestionModel.countDocuments({ createdAt: { $gte: prev7, $lt: last7 } }),
      dailySeries(AnswerModel, 'createdAt', 7),
      AnswerModel.countDocuments({ createdAt: { $gte: last7 } }),
      AnswerModel.countDocuments({ createdAt: { $gte: prev7, $lt: last7 } }),
      dailySeries(FaqModel, 'createdAt', 30),
      FaqModel.countDocuments({ createdAt: { $gte: last30 } }),
      FaqModel.countDocuments({ createdAt: { $gte: prev30, $lt: last30 } }),
      responseTimeSeries(7),
      avgResponseHours({ $gte: last7 }),
      avgResponseHours({ $gte: prev7, $lt: last7 }),
    ]);

    return {
      questionsTrend: {
        total: questionsLast7,
        deltaPct: pctChange(questionsLast7, questionsPrev7),
        series: questionsSeries,
      },
      answersTrend: {
        total: answersLast7,
        deltaPct: pctChange(answersLast7, answersPrev7),
        series: answersSeries,
      },
      faqsCreated: {
        total: faqsLast30,
        deltaPct: pctChange(faqsLast30, faqsPrev30),
        series: faqsSeries,
      },
      avgResponseTime: {
        total: respLast7,
        deltaPct: pctChange(respLast7, respPrev7),
        series: respSeries,
      },
    };
  },

  /** Items awaiting moderator action — pending answers + unanswered/open questions. */
  async _dashModerationQueue(): Promise<AdminDashboard['moderationQueue']> {
    const [pendingAnswers, openQuestions, pendingAnswerCount, openQuestionCount] = await Promise.all(
      [
        AnswerModel.find({ status: 'pending' })
          .sort({ createdAt: -1 })
          .limit(8)
          .populate('answeredBy', 'name')
          .populate('questionId', 'title')
          .lean(),
        QuestionModel.find({ status: 'open', answerCount: 0 })
          .sort({ createdAt: -1 })
          .limit(8)
          .populate('askedBy', 'name')
          .lean(),
        AnswerModel.countDocuments({ status: 'pending' }),
        QuestionModel.countDocuments({ status: 'open', answerCount: 0 }),
      ],
    );

    const items: ModerationQueueItem[] = [
      ...pendingAnswers.map((a) => {
        const author = a.answeredBy as unknown as { name?: string } | null;
        const question = a.questionId as unknown as { title?: string } | null;
        return {
          id: String(a._id),
          title: question?.title ?? 'Community answer',
          type: 'answer' as const,
          author: author?.name ?? 'Unknown',
          createdAt: (a.createdAt as Date).toISOString(),
        };
      }),
      ...openQuestions.map((q) => {
        const author = q.askedBy as unknown as { name?: string } | null;
        return {
          id: String(q._id),
          title: q.title as string,
          type: 'question' as const,
          author: author?.name ?? 'Unknown',
          createdAt: (q.createdAt as Date).toISOString(),
        };
      }),
    ];

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    return {
      count: pendingAnswerCount + openQuestionCount,
      items: items.slice(0, 6),
    };
  },

  /**
   * Platform health rates. Each headline `value` is the current cumulative rate; `deltaPct`
   * is the change between the last-7d and previous-7d windows (percentage points) so the
   * "vs last 7 days" tag reflects a real, comparable trend.
   */
  async _dashPlatformHealth(): Promise<AdminDashboard['platformHealth']> {
    const now = Date.now();
    const last7 = new Date(now - 7 * DAY_MS);
    const prev7 = new Date(now - 14 * DAY_MS);
    const last7Range = { $gte: last7 };
    const prev7Range = { $gte: prev7, $lt: last7 };

    const [
      totalQuestions,
      answeredQuestions,
      resolvedQuestions,
      totalFaqs,
      publishedFaqs,
      openFlags,
      // windowed numerators/denominators for deltas
      qCreatedLast7,
      qAnsweredLast7,
      qResolvedLast7,
      qCreatedPrev7,
      qAnsweredPrev7,
      qResolvedPrev7,
      faqCreatedLast7,
      faqPublishedLast7,
      faqCreatedPrev7,
      faqPublishedPrev7,
      flagsLast7,
      flagsPrev7,
      contentLast7,
      contentPrev7,
    ] = await Promise.all([
      QuestionModel.countDocuments({}),
      QuestionModel.countDocuments({ answerCount: { $gt: 0 } }),
      QuestionModel.countDocuments({ status: 'resolved' }),
      FaqModel.countDocuments({}),
      FaqModel.countDocuments({ status: 'published' }),
      FlagModel.countDocuments({ status: { $in: ['open', 'under_review'] } }),
      QuestionModel.countDocuments({ createdAt: last7Range }),
      QuestionModel.countDocuments({ createdAt: last7Range, answerCount: { $gt: 0 } }),
      QuestionModel.countDocuments({ createdAt: last7Range, status: 'resolved' }),
      QuestionModel.countDocuments({ createdAt: prev7Range }),
      QuestionModel.countDocuments({ createdAt: prev7Range, answerCount: { $gt: 0 } }),
      QuestionModel.countDocuments({ createdAt: prev7Range, status: 'resolved' }),
      FaqModel.countDocuments({ createdAt: last7Range }),
      FaqModel.countDocuments({ createdAt: last7Range, status: 'published' }),
      FaqModel.countDocuments({ createdAt: prev7Range }),
      FaqModel.countDocuments({ createdAt: prev7Range, status: 'published' }),
      FlagModel.countDocuments({ createdAt: last7Range }),
      FlagModel.countDocuments({ createdAt: prev7Range }),
      contentCreatedCount(last7Range),
      contentCreatedCount(prev7Range),
    ]);

    const answerRate = ratePct(answeredQuestions, totalQuestions);
    const resolutionRate = ratePct(resolvedQuestions, totalQuestions);
    const faqCoverage = ratePct(publishedFaqs, totalFaqs);
    const flagRate = ratePct(openFlags, publishedFaqs);

    return {
      answerRate: {
        value: answerRate,
        deltaPct: pointDiff(
          ratePct(qAnsweredLast7, qCreatedLast7),
          ratePct(qAnsweredPrev7, qCreatedPrev7),
        ),
      },
      resolutionRate: {
        value: resolutionRate,
        deltaPct: pointDiff(
          ratePct(qResolvedLast7, qCreatedLast7),
          ratePct(qResolvedPrev7, qCreatedPrev7),
        ),
      },
      faqCoverage: {
        value: faqCoverage,
        deltaPct: pointDiff(
          ratePct(faqPublishedLast7, faqCreatedLast7),
          ratePct(faqPublishedPrev7, faqCreatedPrev7),
        ),
      },
      flagRate: {
        value: flagRate,
        deltaPct: pointDiff(ratePct(flagsLast7, contentLast7), ratePct(flagsPrev7, contentPrev7)),
      },
    };
  },

  /** Top categories by question activity over the last 30 days, with a vs-prior-30d trend. */
  async _dashTopCategories(): Promise<AdminDashboard['topCategories']> {
    const now = Date.now();
    const last30 = new Date(now - 30 * DAY_MS);
    const prev30 = new Date(now - 60 * DAY_MS);

    const rows = await QuestionModel.aggregate<{
      _id: mongoose.Types.ObjectId;
      recent: number;
      previous: number;
    }>([
      { $match: { createdAt: { $gte: prev30 } } },
      {
        $group: {
          _id: '$category',
          recent: { $sum: { $cond: [{ $gte: ['$createdAt', last30] }, 1, 0] } },
          previous: { $sum: { $cond: [{ $lt: ['$createdAt', last30] }, 1, 0] } },
        },
      },
      { $sort: { recent: -1 } },
      { $limit: 4 },
    ]);

    const catIds = rows.map((r) => r._id).filter(Boolean);
    const cats = await CategoryModel.find({ _id: { $in: catIds } })
      .select('name')
      .lean<{ _id: mongoose.Types.ObjectId; name: string }[]>();
    const nameById = new Map(cats.map((c) => [c._id.toString(), c.name]));

    return rows.map((r) => ({
      id: r._id ? r._id.toString() : 'uncategorized',
      name: (r._id && nameById.get(r._id.toString())) || 'Uncategorized',
      count: r.recent,
      deltaPct: pctChange(r.recent, r.previous),
    }));
  },

  /**
   * Unified "Recent Activity" feed merged from real domain events across collections
   * (new FAQs, answered questions, flags raised, new student registrations).
   */
  async _dashRecentActivity(): Promise<RecentActivityItem[]> {
    const [faqs, answers, flags, students] = await Promise.all([
      FaqModel.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('createdBy', 'name')
        .select('title createdAt createdBy')
        .lean(),
      AnswerModel.find({ status: 'approved' })
        .sort({ approvedAt: -1 })
        .limit(5)
        .populate('answeredBy', 'name')
        .populate('questionId', 'title')
        .select('questionId answeredBy approvedAt createdAt')
        .lean(),
      FlagModel.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('reportedBy', 'name')
        .select('entityType reason reportedBy createdAt')
        .lean(),
      UserModel.find({ role: 'student' })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('name createdAt')
        .lean<{ _id: mongoose.Types.ObjectId; name: string; createdAt: Date }[]>(),
    ]);

    const items: RecentActivityItem[] = [];

    for (const f of faqs) {
      const actor = f.createdBy as unknown as { name?: string } | null;
      items.push({
        id: `faq-${String(f._id)}`,
        type: 'faq',
        message: `New FAQ "${truncate(f.title as string, 48)}" added`,
        actor: actor?.name,
        createdAt: (f.createdAt as Date).toISOString(),
      });
    }
    for (const a of answers) {
      const actor = a.answeredBy as unknown as { name?: string } | null;
      const question = a.questionId as unknown as { title?: string } | null;
      const when = (a.approvedAt as Date | undefined) ?? (a.createdAt as Date);
      items.push({
        id: `answer-${String(a._id)}`,
        type: 'answer',
        message: `Question "${truncate(question?.title ?? 'a question', 40)}" was answered`,
        actor: actor?.name,
        createdAt: when.toISOString(),
      });
    }
    for (const fl of flags) {
      const actor = fl.reportedBy as unknown as { name?: string } | null;
      items.push({
        id: `flag-${String(fl._id)}`,
        type: 'flag',
        message: `${capitalize(fl.entityType as string)} flagged for ${(fl.reason as string).replace(/_/g, ' ')}`,
        actor: actor?.name,
        createdAt: (fl.createdAt as Date).toISOString(),
      });
    }
    for (const s of students) {
      items.push({
        id: `user-${s._id.toString()}`,
        type: 'user',
        message: `New student ${s.name} registered`,
        createdAt: s.createdAt.toISOString(),
      });
    }

    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return items.slice(0, 6);
  },
};

// ─── Helper ──────────────────────────────────────────────────────────────────
function computeFreshnessScore(updatedAt: Date): number {
  const daysOld = (Date.now() - updatedAt.getTime()) / (24 * 60 * 60 * 1000);
  if (daysOld <= 7) return 1;
  if (daysOld <= 30) return 0.7;
  if (daysOld <= 90) return 0.4;
  return 0.1;
}

// ─── Admin Dashboard helpers ──────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Percent change of `curr` relative to `prev`, rounded to 1 decimal. */
function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

/** Difference between two rates in percentage points, rounded to 1 decimal. */
function pointDiff(currRate: number, prevRate: number): number {
  return Math.round((currRate - prevRate) * 10) / 10;
}

/** numerator/denominator as a 0–100 percentage rounded to 1 decimal (0 when denom is 0). */
function ratePct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function capitalize(text: string): string {
  return text.length ? text[0]!.toUpperCase() + text.slice(1) : text;
}

/** Distinct users who asked a question or posted an answer within the given date range. */
async function countActiveUsers(range: Record<string, Date>): Promise<number> {
  const [askers, answerers] = await Promise.all([
    QuestionModel.distinct('askedBy', { createdAt: range }),
    AnswerModel.distinct('answeredBy', { createdAt: range }),
  ]);
  const ids = new Set<string>();
  for (const id of askers) ids.add(String(id));
  for (const id of answerers) ids.add(String(id));
  return ids.size;
}

/** Count of new content (questions + answers + faqs) created within a date range. */
async function contentCreatedCount(range: Record<string, Date>): Promise<number> {
  const [q, a, f] = await Promise.all([
    QuestionModel.countDocuments({ createdAt: range }),
    AnswerModel.countDocuments({ createdAt: range }),
    FaqModel.countDocuments({ createdAt: range }),
  ]);
  return q + a + f;
}

/** Minimal structural shape so dailySeries works across any Mongoose model. */
type AggregatableModel = {
  aggregate<R>(pipeline: mongoose.PipelineStage[]): mongoose.Aggregate<R[]>;
};

/**
 * Daily document counts for the last `days` days (oldest → newest), with empty days
 * filled as 0 so the sparkline always has exactly `days` points.
 */
async function dailySeries(
  model: AggregatableModel,
  dateField: string,
  days: number,
): Promise<TrendPoint[]> {
  const since = startOfDay(new Date(Date.now() - (days - 1) * DAY_MS));
  const rows = await model.aggregate<{ date: string; count: number }>([
    { $match: { [dateField]: { $gte: since } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: `$${dateField}` } },
        count: { $sum: 1 },
      },
    },
    { $project: { _id: 0, date: '$_id', count: 1 } },
  ]);
  const byDate = new Map(rows.map((r) => [r.date, r.count]));
  return buildDateAxis(days).map((date) => ({ date, value: byDate.get(date) ?? 0 }));
}

/** Average moderator response time (hours) for answers actioned within a date range. */
async function avgResponseHours(range: Record<string, Date>): Promise<number> {
  const [row] = await AnswerModel.aggregate<{ avgHours: number }>([
    {
      $match: {
        moderatorId: { $exists: true, $ne: null },
        status: { $in: ['approved', 'rejected'] },
        updatedAt: range,
      },
    },
    { $group: { _id: null, avgMs: { $avg: { $subtract: ['$updatedAt', '$createdAt'] } } } },
    { $project: { _id: 0, avgHours: { $round: [{ $divide: ['$avgMs', 3600000] }, 1] } } },
  ]);
  return row?.avgHours ?? 0;
}

/** Daily average moderator response time (hours) over the last `days` days. */
async function responseTimeSeries(days: number): Promise<TrendPoint[]> {
  const since = startOfDay(new Date(Date.now() - (days - 1) * DAY_MS));
  const rows = await AnswerModel.aggregate<{ date: string; avgHours: number }>([
    {
      $match: {
        moderatorId: { $exists: true, $ne: null },
        status: { $in: ['approved', 'rejected'] },
        updatedAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
        avgMs: { $avg: { $subtract: ['$updatedAt', '$createdAt'] } },
      },
    },
    { $project: { _id: 0, date: '$_id', avgHours: { $round: [{ $divide: ['$avgMs', 3600000] }, 1] } } },
  ]);
  const byDate = new Map(rows.map((r) => [r.date, r.avgHours]));
  return buildDateAxis(days).map((date) => ({ date, value: byDate.get(date) ?? 0 }));
}

/** Array of YYYY-MM-DD strings for the last `days` days, oldest → newest. */
function buildDateAxis(days: number): string[] {
  const axis: string[] = [];
  const today = startOfDay(new Date());
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    axis.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  }
  return axis;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AdminIntelligenceStats {
  unresolvedQuestions: number;
  pendingModerationItems: number;
  faqsNeedingReview: number;
  avgResolutionTimeHours: number;
  publishedFaqs: number;
  totalFaqs: number;
  helpfulPercentage: number;
  flaggedCount: number;
  qualityAlerts: QualityAlert[];
}

export interface QualityAlert {
  id: string;
  title: string;
  qualityScore: number;
  helpfulRatio: number;
  flagCount: number;
  viewCount: number;
  updatedAt: string;
}

export interface ModerationLoadStats {
  pendingQueueDepth: number;
  moderators: ModeratorMetric[];
  categoryBacklog: { category: string; count: number }[];
}

export interface ModeratorMetric {
  moderatorId: string;
  name: string;
  email: string;
  totalApprovals: number;
  totalRejections: number;
  approvalsThisWeek: number;
  avgResponseTimeHours: number;
}

export interface ModeratorPersonalStats {
  approvalsToday: number;
  approvalsThisWeek: number;
  totalApprovals: number;
  totalRejections: number;
  avgResponseTimeHours: number;
  categoryBreakdown: { category: string; count: number }[];
}

export interface FaqQualityRow {
  id: string;
  title: string;
  qualityScore: number;
  helpfulRatio: number;
  flagCount: number;
  viewCount: number;
  status: string;
  classification: 'good' | 'rewrite' | 'archive';
  category: string;
  updatedAt: string;
}

// ─── Admin Dashboard types ────────────────────────────────────────────────────

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendCard {
  total: number;
  deltaPct: number;
  series: TrendPoint[];
}

export interface MetricDelta {
  count: number;
  deltaPct: number;
}

export interface RateDelta {
  value: number;
  deltaPct: number;
}

export interface ModerationQueueItem {
  id: string;
  title: string;
  type: 'question' | 'answer';
  author: string;
  createdAt: string;
}

export interface RecentActivityItem {
  id: string;
  type: 'faq' | 'answer' | 'flag' | 'user';
  message: string;
  actor?: string;
  createdAt: string;
}

export interface AdminDashboard {
  actionRequired: {
    pendingModeration: number;
    flaggedContent: number;
    unansweredQuestions: number;
    faqReviewsPending: number;
  };
  todayOverview: {
    questions: MetricDelta;
    answers: MetricDelta;
    newFaqs: MetricDelta;
    activeStudents: MetricDelta;
  };
  performance: {
    questionsTrend: TrendCard;
    answersTrend: TrendCard;
    faqsCreated: TrendCard;
    avgResponseTime: TrendCard;
  };
  moderationQueue: {
    count: number;
    items: ModerationQueueItem[];
  };
  platformHealth: {
    answerRate: RateDelta;
    resolutionRate: RateDelta;
    faqCoverage: RateDelta;
    flagRate: RateDelta;
  };
  topCategories: { id: string; name: string; count: number; deltaPct: number }[];
  recentActivity: RecentActivityItem[];
  generatedAt: string;
}

export interface ModeratorDashboardStats {
  personal: { total: number; unanswered: number; today: number };
  community: { total: number; answered: number; unanswered: number };
  communityToday: { total: number; answered: number; unanswered: number };
  faqs: { total: number; today: number; thisWeek: number };
  flaggedFaqs: { total: number; today: number; thisWeek: number };
  helpfulFaqs: { percentage: number; publishedTotal: number };
  unhelpfulFaqs: { percentage: number; publishedTotal: number };
}
