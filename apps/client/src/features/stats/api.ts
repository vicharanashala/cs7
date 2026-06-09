// Stats / leaderboard API client.
import type { ApiSuccess } from '@samagama/shared';
import { apiClient } from '../../lib/api-client';

export interface StudentDashboardStats {
  questionsAsked: { total: number; thisWeek: number };
  pending: number;
  answered: { total: number; thisWeek: number };
  spurtiPoints: number;
  community: {
    totalOpen: number;
    activeLastHour: number;
    idleOver3Days: number;
    idleOver1Week: number;
  };
  contribution: {
    acceptedAnswers: number;
    answersGiven: number;
    upvotesReceived: number;
    responseRate: number;
  };
}

export interface IdleBuckets {
  last24h: number;
  over3days: number;
  over1week: number;
  totalOpen: number;
}

export type IdleBucket = 'last24h' | 'over3days' | 'over1week';

export interface LeaderboardRow {
  rank: number;
  userId: string;
  studentId: string;
  name: string;
  spurtiPoints: number;
  approvedAnswers: number;
  isMe: boolean;
}

export interface LeaderboardGap {
  fromRank: number;
  toRank: number;
  count: number;
}

export interface LeaderboardResponse {
  totalStudents: number;
  /** Whole list — populated only for small cohorts (< 10); render plainly when set. */
  full: LeaderboardRow[] | null;
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
  bottom: LeaderboardRow[];
  gapTop: LeaderboardGap | null;
  gapBottom: LeaderboardGap | null;
  search: { query: string; results: LeaderboardRow[] } | null;
}

export interface LeaderboardRangeResponse {
  fromRank: number;
  toRank: number;
  rows: LeaderboardRow[];
}

// ─── Admin Dashboard ───────────────────────────────────────────────────────────

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

export interface TopCategory {
  id: string;
  name: string;
  count: number;
  deltaPct: number;
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
  topCategories: TopCategory[];
  recentActivity: RecentActivityItem[];
  generatedAt: string;
}

export const statsApi = {
  async getAdminDashboard(): Promise<AdminDashboard> {
    const res = await apiClient.get<ApiSuccess<AdminDashboard>>('/api/stats/admin-dashboard');
    return res.data.data;
  },

  async getStudentDashboard(): Promise<StudentDashboardStats> {
    const res = await apiClient.get<ApiSuccess<StudentDashboardStats>>(
      '/api/stats/student-dashboard',
    );
    return res.data.data;
  },

  async getLeaderboard(search?: string): Promise<LeaderboardResponse> {
    const res = await apiClient.get<ApiSuccess<LeaderboardResponse>>('/api/stats/leaderboard', {
      params: search ? { search } : undefined,
    });
    return res.data.data;
  },

  async getLeaderboardRange(from: number, to: number): Promise<LeaderboardRangeResponse> {
    const res = await apiClient.get<ApiSuccess<LeaderboardRangeResponse>>(
      '/api/stats/leaderboard/range',
      { params: { from, to } },
    );
    return res.data.data;
  },

  async getCommunityIdleBuckets(): Promise<IdleBuckets> {
    const res = await apiClient.get<ApiSuccess<IdleBuckets>>('/api/stats/community-idle');
    return res.data.data;
  },
};
