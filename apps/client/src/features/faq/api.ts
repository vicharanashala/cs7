// FAQ API client. One module per feature so import paths stay shallow.
import type {
  ApiMeta,
  ApiSuccess,
  CategoryCreateInput,
  CategoryUpdateInput,
  FaqCreateInput,
  FaqListQuery,
  FaqUpdateInput,
  PublicFaq,
  TagCreateInput,
  TagUpdateInput,
} from '@samagama/shared';
import { apiClient } from '../../lib/api-client';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export interface Tag {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export interface FaqStatsResponse {
  totalFaqs: number;
  publishedFaqs: number;
  helpfulPercentage: number;
  flaggedPercentage: number;
  flaggedCount: number;
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

export const faqApi = {
  async list(query: Partial<FaqListQuery> = {}): Promise<{ items: PublicFaq[]; meta: ApiMeta }> {
    const res = await apiClient.get<ApiSuccess<PublicFaq[]>>('/api/faqs', { params: query });
    return { items: res.data.data, meta: res.data.meta ?? {} };
  },
  async getById(id: string): Promise<PublicFaq> {
    const res = await apiClient.get<ApiSuccess<PublicFaq>>(`/api/faqs/${id}`);
    return res.data.data;
  },
  async create(input: FaqCreateInput): Promise<{ id: string }> {
    const res = await apiClient.post<ApiSuccess<{ id: string }>>('/api/faqs', input);
    return res.data.data;
  },
  async update(id: string, input: FaqUpdateInput): Promise<{ id: string; statsReset: boolean }> {
    const res = await apiClient.patch<ApiSuccess<{ id: string; statsReset: boolean }>>(
      `/api/faqs/${id}`,
      input,
    );
    return res.data.data;
  },
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/api/faqs/${id}`);
  },
  async recordView(id: string): Promise<void> {
    await apiClient.post(`/api/faqs/${id}/view`);
  },
  async submitFeedback(
    id: string,
    rating: 'helpful' | 'unhelpful',
  ): Promise<{
    helpfulCount: number;
    unhelpfulCount: number;
    userVote: 'helpful' | 'unhelpful' | null;
  }> {
    const res = await apiClient.post<
      ApiSuccess<{
        helpfulCount: number;
        unhelpfulCount: number;
        userVote: 'helpful' | 'unhelpful' | null;
      }>
    >(`/api/faqs/${id}/feedback`, { rating });
    return res.data.data;
  },

  async listCategories(): Promise<Category[]> {
    const res = await apiClient.get<ApiSuccess<Category[]>>('/api/categories');
    return res.data.data;
  },
  async createCategory(input: CategoryCreateInput): Promise<Category> {
    const res = await apiClient.post<ApiSuccess<Category>>('/api/categories', input);
    return res.data.data;
  },
  async updateCategory(id: string, input: CategoryUpdateInput): Promise<Category> {
    const res = await apiClient.patch<ApiSuccess<Category>>(`/api/categories/${id}`, input);
    return res.data.data;
  },
  async deleteCategory(id: string): Promise<void> {
    await apiClient.delete(`/api/categories/${id}`);
  },

  async listTags(): Promise<Tag[]> {
    const res = await apiClient.get<ApiSuccess<Tag[]>>('/api/tags');
    return res.data.data;
  },
  async createTag(input: TagCreateInput): Promise<Tag> {
    const res = await apiClient.post<ApiSuccess<Tag>>('/api/tags', input);
    return res.data.data;
  },
  async updateTag(id: string, input: TagUpdateInput): Promise<Tag> {
    const res = await apiClient.patch<ApiSuccess<Tag>>(`/api/tags/${id}`, input);
    return res.data.data;
  },
  async deleteTag(id: string): Promise<void> {
    await apiClient.delete(`/api/tags/${id}`);
  },

  async getFaqStats(): Promise<FaqStatsResponse> {
    const res = await apiClient.get<ApiSuccess<FaqStatsResponse>>('/api/stats/faqs');
    return res.data.data;
  },
  async getModeratorStats(): Promise<ModeratorDashboardStats> {
    const res = await apiClient.get<ApiSuccess<ModeratorDashboardStats>>('/api/stats/moderator');
    return res.data.data;
  },
  async getVotesTrend(): Promise<
    { date: string; helpful: number; unhelpful: number; flagged: number }[]
  > {
    const res =
      await apiClient.get<
        ApiSuccess<{ date: string; helpful: number; unhelpful: number; flagged: number }[]>
      >('/api/stats/votes-trend');
    return res.data.data;
  },
};
