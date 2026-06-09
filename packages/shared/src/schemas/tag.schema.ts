// Tag contracts.
import { z } from 'zod';

export const tagCreateSchema = z.object({
  name: z.string().trim().min(2).max(40),
  description: z.string().trim().max(280).optional(),
  keywords: z.array(z.string().trim().toLowerCase()).max(20).default([]),
});

export const tagUpdateSchema = tagCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type TagCreateInput = z.infer<typeof tagCreateSchema>;
export type TagUpdateInput = z.infer<typeof tagUpdateSchema>;
