// FAQ contracts. Used by both the admin editor (client) and the FAQ service (server).
import { z } from 'zod';
import { FAQ_STATUSES } from '../enums.js';
import { objectIdSchema } from './common.schema.js';

export const faqCreateSchema = z.object({
  title: z.string().trim().min(8).max(280),
  answer: z.string().trim().min(10).max(8000),
  summary: z.string().trim().max(280).optional(),
  categories: z.array(objectIdSchema).min(1, 'At least one category is required'),
  tags: z.array(objectIdSchema).default([]),
  status: z.enum(FAQ_STATUSES).default('draft'),
});

export const faqUpdateSchema = faqCreateSchema.partial().extend({
  /** Moderator-only: manually reset individual stat counters without changing the answer. */
  resetHelpful: z.boolean().optional(),
  resetUnhelpful: z.boolean().optional(),
  resetFlags: z.boolean().optional(),
});

export const faqListQuerySchema = z.object({
  q: z.string().trim().optional(),
  category: z.string().optional(),
  tag: z.string().optional(),
  status: z.enum(FAQ_STATUSES).optional(),
  /** Dashboard Spec: 'helpful' = FAQs with helpfulCount > 0; 'flagged' = FAQs with flagCount > 0. */
  filter: z.enum(['helpful', 'flagged']).optional(),
  sort: z.enum(['relevance', 'recent', 'added', 'popular', 'helpful']).default('recent'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const faqFeedbackSchema = z.object({
  rating: z.enum(['helpful', 'unhelpful']),
});

export type FaqCreateInput = z.infer<typeof faqCreateSchema>;
export type FaqUpdateInput = z.infer<typeof faqUpdateSchema>;
export type FaqListQuery = z.infer<typeof faqListQuerySchema>;
export type FaqFeedbackInput = z.infer<typeof faqFeedbackSchema>;

/** Public FAQ shape returned to all roles. Counts are stripped/conditionally included
 *  per role inside the service so the wire format never leaks privileged data. */
export interface PublicFaq {
  id: string;
  title: string;
  answer: string;
  summary?: string;
  categories: { id: string; name: string; slug: string }[];
  tags: { id: string; name: string; slug: string }[];
  status: (typeof FAQ_STATUSES)[number];
  /** Present for moderator/admin only (Dashboard Spec §35). */
  viewCount?: number;
  /** Visible to all roles so students can see vote totals when browsing. */
  helpfulCount?: number;
  /** Visible to all roles. */
  unhelpfulCount?: number;
  /**
   * The current user's active vote. null = authenticated but no vote yet.
   * undefined = not provided (moderator/admin context where voting is not applicable).
   */
  userVote?: 'helpful' | 'unhelpful' | null;
  /** Present for moderator/admin only — live open flag count. */
  flagCount?: number;
  updatedAt: string;
  createdAt: string;
}
