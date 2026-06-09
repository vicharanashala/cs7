// TanStack Query hooks for admin features.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from './api';

// ─── Query keys ──────────────────────────────────────────────────────────────
export const adminKeys = {
  users: (params?: Record<string, unknown>) => ['admin', 'users', params ?? {}] as const,
  auditLogs: (params?: Record<string, unknown>) => ['admin', 'audit-logs', params ?? {}] as const,
  intelligence: ['admin', 'intelligence'] as const,
  moderationLoad: ['admin', 'moderation-load'] as const,
  moderatorPersonal: ['admin', 'moderator-personal'] as const,
  faqQuality: (filter?: string) => ['admin', 'faq-quality', filter ?? 'all'] as const,
  faqCandidates: ['admin', 'faq-candidates'] as const,
};

// ─── User Management ─────────────────────────────────────────────────────────

export function useUsers(
  params: {
    page?: number;
    pageSize?: number;
    role?: string;
    status?: string;
    q?: string;
  } = {},
) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: () => adminApi.listUsers(params),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      adminApi.changeRole(userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useSuspendUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.suspendUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useActivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.activateUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export function useAuditLogs(
  params: {
    page?: number;
    pageSize?: number;
    action?: string;
    entityType?: string;
  } = {},
) {
  return useQuery({
    queryKey: adminKeys.auditLogs(params),
    queryFn: () => adminApi.listAuditLogs(params),
  });
}

// ─── Admin Intelligence ──────────────────────────────────────────────────────

export function useAdminIntelligence() {
  return useQuery({
    queryKey: adminKeys.intelligence,
    queryFn: adminApi.getIntelligenceStats,
    refetchInterval: 60_000, // Auto-refresh every minute
  });
}

// ─── Moderation Load ─────────────────────────────────────────────────────────

export function useModerationLoad() {
  return useQuery({
    queryKey: adminKeys.moderationLoad,
    queryFn: adminApi.getModerationLoad,
  });
}

// ─── Moderator Personal ──────────────────────────────────────────────────────

export function useModeratorPersonalStats() {
  return useQuery({
    queryKey: adminKeys.moderatorPersonal,
    queryFn: adminApi.getModeratorPersonalStats,
  });
}

// ─── FAQ Quality ─────────────────────────────────────────────────────────────

export function useFaqQuality(filter: string = 'all') {
  return useQuery({
    queryKey: adminKeys.faqQuality(filter),
    queryFn: () => adminApi.getFaqQuality(filter),
  });
}

// ─── FAQ Candidates ──────────────────────────────────────────────────────────

export function useFaqCandidates() {
  return useQuery({
    queryKey: adminKeys.faqCandidates,
    queryFn: adminApi.listFaqCandidates,
  });
}

export function useConvertToFaq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (answerId: string) => adminApi.convertToFaq(answerId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: adminKeys.faqCandidates });
      void qc.invalidateQueries({ queryKey: ['faqs'] });
    },
  });
}

// ─── Bulk Operations ─────────────────────────────────────────────────────────

export function useBulkApprove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => adminApi.bulkApprove(ids),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['moderation'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}

export function useBulkReject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, note }: { ids: string[]; note?: string }) => adminApi.bulkReject(ids, note),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['moderation'] });
      void qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
