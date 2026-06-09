// Dashboard statistics HTTP layer. Surfaces the numbers shown on the student, moderator,
// and admin dashboards. Each endpoint is a thin wrapper over statsService/analyticsService.
import type { Request, Response } from 'express';
import { statsService } from '../services/stats.service.js';
import { analyticsService } from '../services/analytics.service.js';
import { ok } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';

export const statsController = {
  // Aggregate FAQ counts/health for the FAQ management summary cards.
  async getFaqStats(_req: Request, res: Response) {
    return ok(res, await statsService.getFaqStats());
  },

  /** Counts that drive the moderator dashboard cards. */
  async getModeratorStats(_req: Request, res: Response) {
    return ok(res, await statsService.getModeratorDashboardStats());
  },

  /** Stats for the student home page (4 cards). */
  async getStudentStats(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    return ok(res, await statsService.getStudentHomeStats(req.user.id));
  },

  /** Full payload for the redesigned student dashboard (stat cards + community + snapshot). */
  async getStudentDashboard(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    return ok(res, await statsService.getStudentDashboardStats(req.user.id));
  },

  /** Kaggle-style Spurti Points leaderboard for the student home dashboard. */
  async getLeaderboard(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    return ok(res, await statsService.getLeaderboard(req.user.id, search));
  },

  /** Rows for one expanded collapsed-gap range on the leaderboard. */
  async getLeaderboardRange(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const from = Number.parseInt(String(req.query.from), 10);
    const to = Number.parseInt(String(req.query.to), 10);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1) {
      throw ApiError.badRequest('from and to must be positive integers');
    }
    return ok(res, await statsService.getLeaderboardRange(req.user.id, from, to));
  },

  /**
   * Idle-bucket counts for open community questions. Used by all roles — students see them
   * on the home page, moderators on Unresolved Questions, admins on Admin Overview, and the
   * Community page filter chips read the same numbers so dashboard and filter never drift.
   */
  async getCommunityIdle(_req: Request, res: Response) {
    return ok(res, await statsService.getCommunityIdleBuckets());
  },

  /** Admin intelligence — system-wide health overview for the admin dashboard. */
  async getAdminIntelligence(_req: Request, res: Response) {
    return ok(res, await statsService.getAdminIntelligenceStats());
  },

  /** Consolidated Admin Dashboard payload — every section in one snapshot. */
  async getAdminDashboard(_req: Request, res: Response) {
    return ok(res, await statsService.getAdminDashboard());
  },

  /** Per-moderator performance metrics for the admin moderation-load page. */
  async getModerationLoad(_req: Request, res: Response) {
    return ok(res, await statsService.getModerationLoadStats());
  },

  /** Personal performance stats for the logged-in moderator. */
  async getModeratorPersonal(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    return ok(res, await statsService.getModeratorPersonalStats(req.user.id));
  },

  /** FAQ quality scores for the admin FAQ Quality page. */
  async getFaqQuality(req: Request, res: Response) {
    const filter = (req.query.filter as 'all' | 'rewrite' | 'archive') ?? 'all';
    return ok(res, await statsService.listFaqsForQuality(filter));
  },

  /** Daily helpful / unhelpful / flagged vote counts for the last 7 days.
   *  Drives the real sparklines in the FAQ Management summary cards. */
  async getVotesTrend(_req: Request, res: Response) {
    return ok(res, await analyticsService.getVotesTrend());
  },
};
