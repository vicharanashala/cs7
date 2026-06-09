// Settings service — get/update system-wide thresholds.
import type { PublicSettings, SettingsUpdateInput } from '@samagama/shared';
import { SystemSettingsModel } from '../models/SystemSettings.model.js';

export type { PublicSettings };

export const settingsService = {
  // Read the singleton 'global' settings document, lazily creating it (with schema
  // defaults) on first access. The `??` fallbacks guard against partially-populated docs.
  async get(): Promise<PublicSettings> {
    let doc = await SystemSettingsModel.findById('global').lean();
    if (!doc) {
      doc = await SystemSettingsModel.create({ _id: 'global' });
    }
    return {
      chatbotConfidenceThreshold: doc.chatbotConfidenceThreshold ?? 0.7,
      chatbotMaxSources: doc.chatbotMaxSources ?? 6,
      communityAnswerCap: doc.communityAnswerCap ?? 10,
      urgentIdleDays: doc.urgentIdleDays ?? 7,
    };
  },

  // Patch one or more settings on the singleton doc (upsert so it's created if missing),
  // returning the full updated settings. runValidators enforces the model's min/max as a
  // second line of defense behind the route's schema validation.
  async update(input: SettingsUpdateInput): Promise<PublicSettings> {
    const doc = await SystemSettingsModel.findByIdAndUpdate(
      'global',
      { $set: input },
      { new: true, upsert: true, runValidators: true },
    );
    return {
      chatbotConfidenceThreshold: doc!.chatbotConfidenceThreshold ?? 0.7,
      chatbotMaxSources: doc!.chatbotMaxSources ?? 6,
      communityAnswerCap: doc!.communityAnswerCap ?? 10,
      urgentIdleDays: doc!.urgentIdleDays ?? 7,
    };
  },
};
