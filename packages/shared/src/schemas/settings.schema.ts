// System settings contracts — admin-configurable portal thresholds.
// Ranges mirror the SystemSettings Mongoose model so the API rejects out-of-range
// values that would otherwise slip past Mongoose (update validators are off by default).
import { z } from 'zod';

// PATCH /api/settings — every field optional (partial update), unknown keys rejected,
// and at least one field required so an empty patch is a 400 rather than a no-op.
export const settingsUpdateSchema = z
  .object({
    chatbotConfidenceThreshold: z.number().min(0).max(1),
    chatbotMaxSources: z.number().int().min(1).max(20),
    communityAnswerCap: z.number().int().min(1).max(50),
    urgentIdleDays: z.number().int().min(1).max(30),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, {
    message: 'At least one setting must be provided',
  });

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;

// Response shape returned by GET/PATCH /api/settings.
export interface PublicSettings {
  chatbotConfidenceThreshold: number;
  chatbotMaxSources: number;
  communityAnswerCap: number;
  urgentIdleDays: number;
}
