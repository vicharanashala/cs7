// Category contracts. Shared across admin editor (client) and category service (server).
import { z } from 'zod';

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  keywords: z.array(z.string().trim().toLowerCase()).max(40).default([]),
});

export const categoryUpdateSchema = categoryCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
