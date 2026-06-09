// Analytics event log. Mirrors remote analyticsEvents architecture.
// Each user action (FAQ view, question asked, search run, answer submitted)
// is appended here. TTL index auto-purges after 730 days (2 years).
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ANALYTICS_EVENT_TYPES = [
  'faq_viewed',
  'faq_helpful',
  'faq_unhelpful',
  'faq_flagged',
  'question_asked',
  'question_answered',
  'question_resolved',
  'answer_submitted',
  'answer_approved',
  'answer_rejected',
  'search_performed',
  'search_clicked',
  'user_registered',
  'user_login',
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

const analyticsEventSchema = new Schema(
  {
    eventType: {
      type: String,
      enum: ANALYTICS_EVENT_TYPES,
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    entityType: {
      type: String,
      enum: ['faq', 'question', 'answer', 'search', 'user'],
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, index: true },
    /** Extra context — search query, category filter, etc. */
    metadata: { type: Schema.Types.Mixed },
    /** ISO timestamp for TTL and bucketing. */
    occurredAt: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

// Auto-purge events older than 2 years.
analyticsEventSchema.index({ occurredAt: 1 }, { expireAfterSeconds: 730 * 24 * 60 * 60 });

export type AnalyticsEventDocument = HydratedDocument<InferSchemaType<typeof analyticsEventSchema>>;
export const AnalyticsEventModel = model('AnalyticsEvent', analyticsEventSchema);
