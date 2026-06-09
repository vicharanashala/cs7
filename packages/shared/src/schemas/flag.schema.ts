// Flag/report contracts shared between client and server.
import { z } from 'zod';
import { FLAG_ENTITY_TYPES, FLAG_REASONS, FLAG_STATUSES } from '../enums.js';
import { objectIdSchema } from './common.schema.js';

export const flagCreateSchema = z.object({
  entityType: z.enum(FLAG_ENTITY_TYPES),
  entityId: objectIdSchema,
  reason: z.enum(FLAG_REASONS),
  details: z.string().trim().max(1000).optional(),
});

export const flagUpdateStatusSchema = z.object({
  status: z.enum(FLAG_STATUSES),
  resolutionNote: z.string().trim().max(1000).optional(),
  /** Spurti points to award/deduct to the reporter for the quality of the flag (-1 to +2). */
  spurtiPoints: z.number().int().min(-1).max(2).optional(),
});

export const flagListQuerySchema = z.object({
  entityType: z.enum(FLAG_ENTITY_TYPES).optional(),
  status: z.enum(FLAG_STATUSES).optional(),
});

export type FlagCreateInput = z.infer<typeof flagCreateSchema>;
export type FlagUpdateStatusInput = z.infer<typeof flagUpdateStatusSchema>;
export type FlagListQuery = z.infer<typeof flagListQuerySchema>;

export interface PublicFlag {
  id: string;
  entityType: (typeof FLAG_ENTITY_TYPES)[number];
  entityId: string;
  /** Joined entity title for display in the moderator queue. */
  entityTitle?: string;
  reason: (typeof FLAG_REASONS)[number];
  details?: string;
  status: (typeof FLAG_STATUSES)[number];
  reportedBy: { id: string; name: string };
  reviewedBy?: { id: string; name: string };
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}
