// HTTP calls for content flagging: raise a flag, list flags (moderator), update flag status.
import type {
  ApiSuccess,
  FlagCreateInput,
  FlagListQuery,
  FlagUpdateStatusInput,
  PublicFlag,
} from '@samagama/shared';
import { apiClient } from '../../lib/api-client';

export const flagApi = {
  async create(input: FlagCreateInput): Promise<PublicFlag> {
    const res = await apiClient.post<ApiSuccess<PublicFlag>>('/api/flags', input);
    return res.data.data;
  },
  async list(query: FlagListQuery = {}): Promise<PublicFlag[]> {
    const res = await apiClient.get<ApiSuccess<PublicFlag[]>>('/api/flags', { params: query });
    return res.data.data;
  },
  async updateStatus(id: string, input: FlagUpdateStatusInput): Promise<PublicFlag> {
    const res = await apiClient.patch<ApiSuccess<PublicFlag>>(`/api/flags/${id}/status`, input);
    return res.data.data;
  },
};
