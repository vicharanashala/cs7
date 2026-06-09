// System settings — configurable thresholds that control portal behavior.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

const systemSettingsSchema = new Schema(
  {
    /** Singleton key — only one settings document exists. */
    _id: { type: String, default: 'global' },
    // Minimum retrieval confidence below which the chatbot declines to answer.
    chatbotConfidenceThreshold: { type: Number, default: 0.7, min: 0, max: 1 },
    // Max number of source documents fed into the chatbot's RAG context.
    chatbotMaxSources: { type: Number, default: 6, min: 1, max: 20 },
    // Hard cap on student answers allowed per community question.
    communityAnswerCap: { type: Number, default: 10, min: 1, max: 50 },
    /** Days a question must be idle before it enters the urgent moderation bucket. */
    urgentIdleDays: { type: Number, default: 7, min: 1, max: 30 },
  },
  {
    timestamps: true,
  },
);

export type SystemSettingsDocument = HydratedDocument<InferSchemaType<typeof systemSettingsSchema>>;
export const SystemSettingsModel = model('SystemSettings', systemSettingsSchema);
