// React Query hook for the global system settings. Several UI surfaces read these
// admin-configurable values (e.g. communityAnswerCap to cap the answer form).
import { useQuery } from '@tanstack/react-query';
import type { ApiSuccess } from '@samagama/shared';
import { apiClient } from '../lib/api-client';

export interface PublicSettings {
  chatbotConfidenceThreshold: number;
  chatbotMaxSources: number;
  communityAnswerCap: number;
  urgentIdleDays: number;
}

export function useSettings() {
  return useQuery<PublicSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const res = await apiClient.get<ApiSuccess<PublicSettings>>('/api/settings');
      return res.data.data;
    },
    staleTime: 5 * 60 * 1000, // settings change rarely — cache for 5 min
  });
}
