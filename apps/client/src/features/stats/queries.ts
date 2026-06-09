// React Query hooks for dashboard stats (student home cards, leaderboard, community idle buckets).
// All cached for 60s since these aggregates change slowly.
import { useQuery } from '@tanstack/react-query';
import { statsApi } from './api';

// Centralized query keys (leaderboard is parameterized by search term — '' is the default view).
export const statsKeys = {
  studentDashboard: ['stats', 'student-dashboard'] as const,
  leaderboard: (search: string) => ['stats', 'leaderboard', search] as const,
  leaderboardRange: (from: number, to: number) =>
    ['stats', 'leaderboard-range', from, to] as const,
  communityIdle: ['stats', 'community-idle'] as const,
  adminDashboard: ['stats', 'admin-dashboard'] as const,
};

// Consolidated Admin Dashboard payload. Polls every 30s and refetches on focus so every
// section (counters, trends, queue, activity) stays near-real-time from one cached snapshot.
export function useAdminDashboard() {
  return useQuery({
    queryKey: statsKeys.adminDashboard,
    queryFn: statsApi.getAdminDashboard,
    staleTime: 20_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

// Full student-dashboard payload. Polls every 30s and refetches on focus so the cards
// stay near-real-time as the student asks questions, earns points, receives answers, etc.
export function useStudentDashboard() {
  return useQuery({
    queryKey: statsKeys.studentDashboard,
    queryFn: statsApi.getStudentDashboard,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}

// Home-dashboard leaderboard. `search` switches the payload into search mode. Polls every 30s
// and refetches on focus so rankings update automatically as Spurti Points change. Search
// queries keep the previous result on screen while the next one loads (no flicker per keystroke).
export function useLeaderboard(search = '') {
  return useQuery({
    queryKey: statsKeys.leaderboard(search),
    queryFn: () => statsApi.getLeaderboard(search || undefined),
    staleTime: 30_000,
    refetchInterval: search ? false : 30_000,
    refetchOnWindowFocus: !search,
    placeholderData: (prev) => prev,
  });
}

// Fetches the rows for one expanded collapsed-gap range. Disabled until the user expands the gap.
export function useLeaderboardRange(from: number, to: number, enabled: boolean) {
  return useQuery({
    queryKey: statsKeys.leaderboardRange(from, to),
    queryFn: () => statsApi.getLeaderboardRange(from, to),
    enabled: enabled && from <= to,
    staleTime: 30_000,
  });
}

export function useCommunityIdleBuckets() {
  return useQuery({
    queryKey: statsKeys.communityIdle,
    queryFn: statsApi.getCommunityIdleBuckets,
    staleTime: 60_000,
  });
}
