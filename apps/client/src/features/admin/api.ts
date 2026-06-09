// Admin API client — user management, audit logs, admin intelligence stats.
import type { ApiMeta, ApiSuccess, PublicUserAdmin } from '@samagama/shared';
import { apiClient } from '../../lib/api-client';

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

export interface AuditLogEntry {
  id: string;
  actor: { id: string; name: string; email: string };
  action: string;
  entityType: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  reason?: string;
  createdAt: string;
}

export interface FaqCandidateRow {
  id: string;
  questionTitle: string;
  questionDescription: string;
  answerBody: string;
  category: string;
  author: { id: string; name: string };
  moderator?: { id: string; name: string };
  approvedAt: string;
}

// ─── API functions ───────────────────────────────────────────────────────────

export const adminApi = {
  // Users
  async listUsers(params: {
    page?: number;
    pageSize?: number;
    role?: string;
    status?: string;
    q?: string;
  }): Promise<{ items: PublicUserAdmin[]; meta: ApiMeta }> {
    const res = await apiClient.get<ApiSuccess<PublicUserAdmin[]>>('/api/users', { params });
    return { items: res.data.data, meta: res.data.meta ?? {} };
  },
  async changeRole(userId: string, role: string): Promise<PublicUserAdmin> {
    const res = await apiClient.patch<ApiSuccess<PublicUserAdmin>>(`/api/users/${userId}/role`, {
      role,
    });
    return res.data.data;
  },
  async suspendUser(userId: string): Promise<PublicUserAdmin> {
    const res = await apiClient.patch<ApiSuccess<PublicUserAdmin>>(`/api/users/${userId}/suspend`);
    return res.data.data;
  },
  async activateUser(userId: string): Promise<PublicUserAdmin> {
    const res = await apiClient.patch<ApiSuccess<PublicUserAdmin>>(`/api/users/${userId}/activate`);
    return res.data.data;
  },
  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete(`/api/users/${userId}`);
  },

  // Audit logs
  async listAuditLogs(params: {
    page?: number;
    pageSize?: number;
    action?: string;
    entityType?: string;
    actorId?: string;
  }): Promise<{ items: AuditLogEntry[]; meta: ApiMeta }> {
    const res = await apiClient.get<ApiSuccess<AuditLogEntry[]>>('/api/audit-logs', { params });
    return { items: res.data.data, meta: res.data.meta ?? {} };
  },

  // Admin intelligence
  async getIntelligenceStats(): Promise<AdminIntelligenceStats> {
    const res = await apiClient.get<ApiSuccess<AdminIntelligenceStats>>(
      '/api/stats/admin-intelligence',
    );
    return res.data.data;
  },

  // Moderation load
  async getModerationLoad(): Promise<ModerationLoadStats> {
    const res = await apiClient.get<ApiSuccess<ModerationLoadStats>>('/api/stats/moderation-load');
    return res.data.data;
  },

  // Moderator personal stats
  async getModeratorPersonalStats(): Promise<ModeratorPersonalStats> {
    const res = await apiClient.get<ApiSuccess<ModeratorPersonalStats>>(
      '/api/stats/moderator-personal',
    );
    return res.data.data;
  },

  // FAQ quality
  async getFaqQuality(filter?: string): Promise<FaqQualityRow[]> {
    const res = await apiClient.get<ApiSuccess<FaqQualityRow[]>>('/api/stats/faq-quality', {
      params: filter && filter !== 'all' ? { filter } : {},
    });
    return res.data.data;
  },

  // FAQ candidates
  async listFaqCandidates(): Promise<FaqCandidateRow[]> {
    const res = await apiClient.get<ApiSuccess<FaqCandidateRow[]>>(
      '/api/moderation/faq-candidates',
    );
    return res.data.data;
  },
  async convertToFaq(answerId: string): Promise<{ faqId: string }> {
    const res = await apiClient.post<ApiSuccess<{ faqId: string }>>(
      `/api/moderation/faq-candidates/${answerId}/convert`,
    );
    return res.data.data;
  },

  // Bulk moderation
  async bulkApprove(ids: string[]): Promise<{ approved: number }> {
    const res = await apiClient.post<ApiSuccess<{ approved: number }>>(
      '/api/moderation/bulk-approve',
      { ids },
    );
    return res.data.data;
  },
  async bulkReject(ids: string[], note?: string): Promise<{ rejected: number }> {
    const res = await apiClient.post<ApiSuccess<{ rejected: number }>>(
      '/api/moderation/bulk-reject',
      { ids, note },
    );
    return res.data.data;
  },

  // Mark for FAQ
  async markForFaq(answerId: string): Promise<void> {
    await apiClient.patch(`/api/moderation/answers/${answerId}/mark-for-faq`);
  },
};
