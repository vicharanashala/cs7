// Per-user feedback event log. Mirrors remote FeedbackEvent model.
//
// Stores one document per (userId, entityType, entityId) combination.
// The unique compound index prevents double-voting — if a user changes their
// vote the document is upserted, not duplicated.
//
// Covered entity types: faq, answer (not questions — questions use the
// separate upvote/downvote arrays on the Answer model).
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const FEEDBACK_ENTITY_TYPES = ['faq', 'answer'] as const;
export const FEEDBACK_VALUES = ['helpful', 'unhelpful'] as const;

export type FeedbackEntityType = (typeof FEEDBACK_ENTITY_TYPES)[number];
export type FeedbackValue = (typeof FEEDBACK_VALUES)[number];

const feedbackEventSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    entityType: {
      type: String,
      enum: FEEDBACK_ENTITY_TYPES,
      required: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    value: {
      type: String,
      enum: FEEDBACK_VALUES,
      required: true,
    },
  },
  { timestamps: true, strict: true },
);

// One vote per user per entity — changing a vote upserts this document.
feedbackEventSchema.index({ userId: 1, entityType: 1, entityId: 1 }, { unique: true });
feedbackEventSchema.index({ entityType: 1, entityId: 1 });

export type FeedbackEventDocument = HydratedDocument<InferSchemaType<typeof feedbackEventSchema>>;
export const FeedbackEventModel = model('FeedbackEvent', feedbackEventSchema);
