// Validation contract for PATCH /api/settings. The route relies on this schema to
// reject values that would otherwise bypass Mongoose's update validators.
import { describe, it, expect } from 'vitest';
import { settingsUpdateSchema } from '@samagama/shared';

describe('settingsUpdateSchema', () => {
  it('accepts a valid partial update', () => {
    const res = settingsUpdateSchema.safeParse({ communityAnswerCap: 15 });
    expect(res.success).toBe(true);
  });

  it('accepts all fields at their boundary values', () => {
    const res = settingsUpdateSchema.safeParse({
      chatbotConfidenceThreshold: 1,
      chatbotMaxSources: 20,
      communityAnswerCap: 50,
      urgentIdleDays: 1,
    });
    expect(res.success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(settingsUpdateSchema.safeParse({}).success).toBe(false);
  });

  it('rejects out-of-range values', () => {
    expect(settingsUpdateSchema.safeParse({ chatbotConfidenceThreshold: 5 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ communityAnswerCap: -1 }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ urgentIdleDays: 31 }).success).toBe(false);
  });

  it('rejects non-integer values for integer fields', () => {
    expect(settingsUpdateSchema.safeParse({ chatbotMaxSources: 6.5 }).success).toBe(false);
  });

  it('rejects unknown keys', () => {
    expect(settingsUpdateSchema.safeParse({ bogusSetting: 1 }).success).toBe(false);
  });
});
