import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlagCreateInput, FlagListQuery, FlagUpdateStatusInput } from '@samagama/shared';
import { flagApi } from './api';

export const flagKeys = {
  all: ['flags'] as const,
  list: (q: FlagListQuery) => [...flagKeys.all, 'list', q] as const,
};

export function useFlagList(query: FlagListQuery = {}) {
  return useQuery({
    queryKey: flagKeys.list(query),
    queryFn: () => flagApi.list(query),
    refetchInterval: 30_000,
  });
}

export function useCreateFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: FlagCreateInput) => flagApi.create(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: flagKeys.all });
      // The FAQ list shows flagCount-derived filters and the stats card uses flag data.
      void qc.invalidateQueries({ queryKey: ['stats'] });
      void qc.invalidateQueries({ queryKey: ['faqs'] });
    },
  });
}

export function useUpdateFlagStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: FlagUpdateStatusInput }) =>
      flagApi.updateStatus(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: flagKeys.all });
      void qc.invalidateQueries({ queryKey: ['stats'] });
      void qc.invalidateQueries({ queryKey: ['faqs'] });
    },
  });
}
