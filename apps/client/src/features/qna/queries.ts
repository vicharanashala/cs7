import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AnswerCreateInput } from '@samagama/shared';
import { moderationApi, qnaApi } from './api';

export const qnaKeys = {
  all: ['qna'] as const,
  questions: (params: object) => [...qnaKeys.all, 'questions', params] as const,
  question: (id: string) => [...qnaKeys.all, 'question', id] as const,
  answers: (questionId: string) => [...qnaKeys.all, 'answers', questionId] as const,
  pendingAnswers: ['moderation', 'pending-answers'] as const,
  trash: ['moderation', 'trash'] as const,
};

export function useQuestions(params: {
  type?: 'personal' | 'community';
  status?: string;
  mine?: boolean;
  idle?: 'last24h' | 'over3days' | 'over1week';
}) {
  return useQuery({
    queryKey: qnaKeys.questions(params),
    queryFn: () => qnaApi.listQuestions(params),
  });
}

export function useQuestion(id: string | undefined) {
  return useQuery({
    queryKey: id ? qnaKeys.question(id) : ['qna', 'question', 'none'],
    queryFn: () => qnaApi.getQuestion(id!),
    enabled: Boolean(id),
  });
}

export function useAnswers(questionId: string | undefined) {
  return useQuery({
    queryKey: questionId ? qnaKeys.answers(questionId) : ['qna', 'answers', 'none'],
    queryFn: () => qnaApi.listAnswers(questionId!),
    enabled: Boolean(questionId),
  });
}

export function useSubmitAnswer(questionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AnswerCreateInput) => qnaApi.submitAnswer(questionId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qnaKeys.answers(questionId) });
      void qc.invalidateQueries({ queryKey: qnaKeys.question(questionId) });
      // Bump "Answers given" on the asker's/answerer's dashboard snapshot.
      void qc.invalidateQueries({ queryKey: ['stats', 'student-dashboard'] });
    },
  });
}

export function useVoteAnswer(questionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ answerId, direction }: { answerId: string; direction: 'up' | 'down' }) =>
      qnaApi.voteAnswer(answerId, direction),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qnaKeys.answers(questionId) });
      void qc.invalidateQueries({ queryKey: ['stats', 'leaderboard'] });
      // "Upvotes received" on the dashboard depends on vote totals.
      void qc.invalidateQueries({ queryKey: ['stats', 'student-dashboard'] });
    },
  });
}

export function useApproveAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      editedBody,
      note,
      spurtiPoints,
      visibilityDays,
    }: {
      id: string;
      editedBody?: string;
      note?: string;
      spurtiPoints?: number;
      visibilityDays?: 2 | 3 | 7 | null;
    }) => moderationApi.approveAnswer(id, { editedBody, note, spurtiPoints, visibilityDays }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qnaKeys.pendingAnswers });
      void qc.invalidateQueries({ queryKey: qnaKeys.all });
      void qc.invalidateQueries({ queryKey: ['stats', 'leaderboard'] });
    },
  });
}

// --- Moderation ---
export function usePendingAnswers() {
  return useQuery({
    queryKey: qnaKeys.pendingAnswers,
    queryFn: moderationApi.listPendingAnswers,
  });
}

export function usePendingAnswersForQuestion(questionId: string, limit: number, enabled: boolean) {
  return useQuery({
    queryKey: ['moderation', 'pending-for-question', questionId, limit],
    queryFn: () => moderationApi.listPendingForQuestion(questionId, limit),
    enabled,
  });
}

export function useRejectAnswer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      moderationApi.rejectAnswer(id, { note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qnaKeys.pendingAnswers });
    },
  });
}

export function useRespondToPersonal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ questionId, body }: { questionId: string; body: string }) =>
      moderationApi.respondToPersonal(questionId, body),
    onSuccess: (_data, { questionId }) => {
      // Explicitly refetch the answers for this question so the response
      // appears immediately without waiting for the questions-list refetch to race.
      void qc.invalidateQueries({ queryKey: qnaKeys.answers(questionId) });
      void qc.invalidateQueries({ queryKey: qnaKeys.all });
    },
  });
}

export function useConvertQuestionToFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      questionId,
      removeAndConvert,
      answerBody,
    }: {
      questionId: string;
      removeAndConvert?: boolean;
      answerBody?: string;
    }) => moderationApi.convertQuestionToFaq(questionId, { removeAndConvert, answerBody }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qnaKeys.all });
      void qc.invalidateQueries({ queryKey: qnaKeys.pendingAnswers });
    },
  });
}

export function useConvertAnswerToFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answerId: string) => moderationApi.convertAnswerToFaq(answerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qnaKeys.all });
      void qc.invalidateQueries({ queryKey: qnaKeys.pendingAnswers });
    },
  });
}

export function useTrash() {
  return useQuery({
    queryKey: qnaKeys.trash,
    queryFn: moderationApi.listTrash,
  });
}

export function useRestoreQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => moderationApi.restoreQuestion(questionId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qnaKeys.trash });
      void qc.invalidateQueries({ queryKey: qnaKeys.all });
    },
  });
}
