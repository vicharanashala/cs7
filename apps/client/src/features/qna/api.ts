// HTTP calls for Community Q&A. Two groups:
//  - qnaApi: student-facing (ask flow, question/answer reads, voting).
//  - moderationApi: moderator/admin actions (approve/reject, respond, FAQ conversion, trash).
import type {
  AnswerCreateInput,
  ApiSuccess,
  CheckExistingInput,
  ExistingAnswerCheckResult,
  PublicAnswer,
  PublicQuestion,
  QuestionCreateInput,
} from '@samagama/shared';
import { apiClient } from '../../lib/api-client';

export const qnaApi = {
  async checkExisting(input: CheckExistingInput): Promise<ExistingAnswerCheckResult> {
    const res = await apiClient.post<ApiSuccess<ExistingAnswerCheckResult>>(
      '/api/qna/check-existing',
      input,
    );
    return res.data.data;
  },

  async createQuestion(input: QuestionCreateInput): Promise<PublicQuestion> {
    const res = await apiClient.post<ApiSuccess<PublicQuestion>>('/api/qna/questions', input);
    return res.data.data;
  },

  async tagMe(questionId: string, existingAnswerCheckToken: string): Promise<void> {
    await apiClient.post(`/api/qna/questions/${questionId}/tag-me`, { existingAnswerCheckToken });
  },

  async listQuestions(params: {
    type?: 'personal' | 'community';
    status?: string;
    mine?: boolean;
    idle?: 'last24h' | 'over3days' | 'over1week';
  }): Promise<PublicQuestion[]> {
    const res = await apiClient.get<ApiSuccess<PublicQuestion[]>>('/api/qna/questions', {
      params,
    });
    return res.data.data;
  },

  async getQuestion(id: string): Promise<PublicQuestion> {
    const res = await apiClient.get<ApiSuccess<PublicQuestion>>(`/api/qna/questions/${id}`);
    return res.data.data;
  },

  async listAnswers(questionId: string): Promise<PublicAnswer[]> {
    const res = await apiClient.get<ApiSuccess<PublicAnswer[]>>(
      `/api/qna/questions/${questionId}/answers`,
    );
    return res.data.data;
  },

  async submitAnswer(questionId: string, input: AnswerCreateInput): Promise<PublicAnswer> {
    const res = await apiClient.post<ApiSuccess<PublicAnswer>>(
      `/api/qna/questions/${questionId}/answers`,
      input,
    );
    return res.data.data;
  },

  // Toggle a vote on an answer. allowPending=true so moderators can vote while previewing
  // not-yet-approved answers. Returns the updated counts + the caller's current vote.
  async voteAnswer(
    answerId: string,
    direction: 'up' | 'down',
  ): Promise<{ upvoteCount: number; downvoteCount: number; myVote: 'up' | 'down' | null }> {
    const res = await apiClient.post<
      ApiSuccess<{ upvoteCount: number; downvoteCount: number; myVote: 'up' | 'down' | null }>
    >(`/api/qna/answers/${answerId}/vote/${direction}?allowPending=true`);
    return res.data.data;
  },
};

// --- Moderation ---
interface PendingAnswerSummary {
  id: string;
  body: string;
  questionId: string;
  questionTitle: string;
  author: { id: string; name: string; role?: string };
  /** Other students who tagged themselves on the same question (Dashboard Spec). */
  taggedStudents: { id: string; name: string }[];
  upvoteCount: number;
  downvoteCount: number;
  createdAt: string;
}

// Moderator/admin Q&A actions: the pending-answer queue, personal-question responses,
// FAQ promotion, and the trash bin for expired community posts.
export const moderationApi = {
  async listPendingAnswers(): Promise<PendingAnswerSummary[]> {
    const res = await apiClient.get<ApiSuccess<PendingAnswerSummary[]>>(
      '/api/moderation/pending-answers',
    );
    return res.data.data;
  },
  async listPendingForQuestion(questionId: string, limit: number): Promise<PendingAnswerSummary[]> {
    const res = await apiClient.get<ApiSuccess<PendingAnswerSummary[]>>(
      `/api/moderation/questions/${questionId}/pending-answers`,
      { params: { limit } },
    );
    return res.data.data;
  },
  async approveAnswer(
    id: string,
    input: {
      editedBody?: string;
      note?: string;
      spurtiPoints?: number;
      visibilityDays?: 2 | 3 | 7 | null;
    } = {},
  ): Promise<void> {
    await apiClient.patch(`/api/moderation/answers/${id}/approve`, input);
  },
  async rejectAnswer(id: string, input: { note?: string } = {}): Promise<void> {
    await apiClient.patch(`/api/moderation/answers/${id}/reject`, input);
  },
  async respondToPersonal(questionId: string, body: string): Promise<void> {
    await apiClient.post(`/api/moderation/questions/${questionId}/respond`, { body });
  },
  async convertQuestionToFaq(
    questionId: string,
    opts: { removeAndConvert?: boolean; answerBody?: string } = {},
  ): Promise<{ faqId: string }> {
    const res = await apiClient.post<ApiSuccess<{ faqId: string }>>(
      `/api/moderation/questions/${questionId}/convert-to-faq`,
      opts,
    );
    return res.data.data;
  },

  async convertAnswerToFaq(answerId: string): Promise<{ faqId: string }> {
    const res = await apiClient.post<ApiSuccess<{ faqId: string }>>(
      `/api/moderation/faq-candidates/${answerId}/convert`,
    );
    return res.data.data;
  },

  async listTrash(): Promise<TrashedQuestionRow[]> {
    const res = await apiClient.get<ApiSuccess<TrashedQuestionRow[]>>('/api/moderation/trash');
    return res.data.data;
  },

  async restoreQuestion(questionId: string): Promise<void> {
    await apiClient.patch(`/api/moderation/trash/${questionId}/restore`);
  },
};

export interface TrashedQuestionRow {
  id: string;
  title: string;
  description: string;
  author: { id: string; name: string };
  answerCount: number;
  trashedAt: string;
  visibilityExpiresAt: string | null;
  answers: Array<{
    id: string;
    body: string;
    author: { id: string; name: string };
    upvoteCount: number;
    downvoteCount: number;
    createdAt: string;
  }>;
}

export type { PendingAnswerSummary };
