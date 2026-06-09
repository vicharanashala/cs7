// TanStack Query hooks for FAQs.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CategoryCreateInput,
  CategoryUpdateInput,
  FaqCreateInput,
  FaqListQuery,
  FaqUpdateInput,
  PublicFaq,
  TagCreateInput,
  TagUpdateInput,
} from '@samagama/shared';
import { faqApi } from './api';

export const faqKeys = {
  all: ['faqs'] as const,
  lists: () => [...faqKeys.all, 'list'] as const,
  list: (query: Partial<FaqListQuery>) => [...faqKeys.lists(), query] as const,
  detail: (id: string) => [...faqKeys.all, 'detail', id] as const,
  categories: ['categories'] as const,
  tags: ['tags'] as const,
};

export function useFaqList(
  query: Partial<FaqListQuery>,
  options: { refetchInterval?: number } = {},
) {
  return useQuery({
    queryKey: faqKeys.list(query),
    queryFn: () => faqApi.list(query),
    refetchInterval: options.refetchInterval,
  });
}

export function useFaqDetail(id: string | undefined) {
  return useQuery({
    queryKey: id ? faqKeys.detail(id) : ['faqs', 'detail', 'none'],
    queryFn: () => faqApi.getById(id!),
    enabled: Boolean(id),
  });
}

export function useCategories() {
  return useQuery({ queryKey: faqKeys.categories, queryFn: faqApi.listCategories });
}

export function useTags() {
  return useQuery({ queryKey: faqKeys.tags, queryFn: faqApi.listTags });
}

export function useRecordFaqView() {
  return useMutation({ mutationFn: (id: string) => faqApi.recordView(id) });
}

type ListCache = { items: PublicFaq[]; meta: Record<string, unknown> };

/** Compute the expected new state when a user votes on an FAQ. Mirrors server logic. */
function applyOptimisticVote(faq: PublicFaq, rating: 'helpful' | 'unhelpful'): PublicFaq {
  const prev = faq.userVote ?? null;
  let helpfulCount = faq.helpfulCount ?? 0;
  let unhelpfulCount = faq.unhelpfulCount ?? 0;
  let userVote: 'helpful' | 'unhelpful' | null;

  if (prev === rating) {
    // Toggle off
    userVote = null;
    if (rating === 'helpful') helpfulCount = Math.max(0, helpfulCount - 1);
    else unhelpfulCount = Math.max(0, unhelpfulCount - 1);
  } else if (rating === 'helpful') {
    helpfulCount += 1;
    if (prev === 'unhelpful') unhelpfulCount = Math.max(0, unhelpfulCount - 1);
    userVote = 'helpful';
  } else {
    unhelpfulCount += 1;
    if (prev === 'helpful') helpfulCount = Math.max(0, helpfulCount - 1);
    userVote = 'unhelpful';
  }

  return { ...faq, helpfulCount, unhelpfulCount, userVote };
}

export function useFaqFeedback(faqId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rating: 'helpful' | 'unhelpful') => faqApi.submitFeedback(faqId, rating),

    onMutate: async (rating) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update.
      await qc.cancelQueries({ queryKey: faqKeys.detail(faqId) });
      await qc.cancelQueries({ queryKey: faqKeys.lists() });

      // Snapshot current cache values for rollback.
      const prevDetail = qc.getQueryData<PublicFaq>(faqKeys.detail(faqId));
      const prevLists = qc.getQueriesData<ListCache>({ queryKey: faqKeys.lists() });

      // Apply optimistic update to the detail cache.
      if (prevDetail) {
        qc.setQueryData<PublicFaq>(faqKeys.detail(faqId), applyOptimisticVote(prevDetail, rating));
      }

      // Apply optimistic update to every list cache entry.
      for (const [key, data] of prevLists) {
        if (data) {
          qc.setQueryData<ListCache>(key, {
            ...data,
            items: data.items.map((f) => (f.id === faqId ? applyOptimisticVote(f, rating) : f)),
          });
        }
      }

      return { prevDetail, prevLists };
    },

    onError: (_err, _rating, context) => {
      // Roll back to the pre-mutation snapshots.
      if (context?.prevDetail !== undefined) {
        qc.setQueryData(faqKeys.detail(faqId), context.prevDetail);
      }
      for (const [key, data] of context?.prevLists ?? []) {
        qc.setQueryData(key, data);
      }
    },

    onSuccess: (serverData) => {
      // Overwrite optimistic counts with the authoritative values from the server.
      const patch = (faq: PublicFaq): PublicFaq => ({
        ...faq,
        helpfulCount: serverData.helpfulCount,
        unhelpfulCount: serverData.unhelpfulCount,
        userVote: serverData.userVote,
      });

      const detail = qc.getQueryData<PublicFaq>(faqKeys.detail(faqId));
      if (detail) qc.setQueryData<PublicFaq>(faqKeys.detail(faqId), patch(detail));

      for (const [key, data] of qc.getQueriesData<ListCache>({ queryKey: faqKeys.lists() })) {
        if (data) {
          qc.setQueryData<ListCache>(key, {
            ...data,
            items: data.items.map((f) => (f.id === faqId ? patch(f) : f)),
          });
        }
      }

      // Bust aggregated stat cards (Helpful % shown on admin/mod dashboards).
      void qc.invalidateQueries({ queryKey: ['stats', 'moderator'] });
      void qc.invalidateQueries({ queryKey: ['stats', 'faqs'] });
    },
  });
}

// --- Admin / Moderator FAQ management ---

export function useFaqStats() {
  return useQuery({
    queryKey: ['stats', 'faqs'],
    queryFn: faqApi.getFaqStats,
    refetchInterval: 30_000,
    // Dashboard counts (incl. Flagged FAQs) are driven mostly by actions in other sessions
    // (students raising flags). Refetch on focus so returning to the dashboard shows fresh numbers
    // rather than waiting up to 30s for the next poll.
    refetchOnWindowFocus: true,
  });
}

export function useModeratorStats() {
  return useQuery({
    queryKey: ['stats', 'moderator'],
    queryFn: faqApi.getModeratorStats,
    refetchInterval: 30_000,
    // See useFaqStats — refresh the moderator/admin dashboard cards on window focus.
    refetchOnWindowFocus: true,
  });
}

export function useVotesTrend() {
  return useQuery({
    queryKey: ['stats', 'votes-trend'],
    queryFn: faqApi.getVotesTrend,
    refetchInterval: 60_000,
  });
}

export function useCreateFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FaqCreateInput) => faqApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: faqKeys.lists() });
      void qc.invalidateQueries({ queryKey: ['stats', 'faqs'] });
    },
  });
}

export function useUpdateFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FaqUpdateInput }) => faqApi.update(id, input),
    onSuccess: (_data, { id }) => {
      void qc.invalidateQueries({ queryKey: faqKeys.lists() });
      void qc.invalidateQueries({ queryKey: faqKeys.detail(id) });
      void qc.invalidateQueries({ queryKey: ['stats', 'faqs'] });
      // An edit can resolve flags (answer change or explicit reset) — refresh the
      // flag inbox / moderation views so the FAQ drops out of flagged lists.
      void qc.invalidateQueries({ queryKey: ['flags'] });
      void qc.invalidateQueries({ queryKey: ['moderation'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useDeleteFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => faqApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: faqKeys.lists() });
      void qc.invalidateQueries({ queryKey: ['stats', 'faqs'] });
    },
  });
}

// --- Categories ---
export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryCreateInput) => faqApi.createCategory(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.categories }),
  });
}
export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CategoryUpdateInput }) =>
      faqApi.updateCategory(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.categories }),
  });
}
export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => faqApi.deleteCategory(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: faqKeys.categories });
      // Cascade pulls refs from FAQs — refresh list and detail views so stale category data disappears.
      void qc.invalidateQueries({ queryKey: faqKeys.all });
    },
  });
}

// --- Tags ---
export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TagCreateInput) => faqApi.createTag(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.tags }),
  });
}
export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TagUpdateInput }) =>
      faqApi.updateTag(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: faqKeys.tags }),
  });
}
export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => faqApi.deleteTag(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: faqKeys.tags });
      // Cascade pulls refs from FAQs — refresh list and detail views so stale tag data disappears.
      void qc.invalidateQueries({ queryKey: faqKeys.all });
    },
  });
}
