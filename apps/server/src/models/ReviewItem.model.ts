// Moderation review queue item. Mirrors remote ReviewItem model.
// Created when a FAQ or answer needs human review (flagged, poor quality,
// request-changes). Consumed by the moderation dashboard.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

export const REVIEW_ITEM_STATUSES = ['pending', 'in_review', 'resolved', 'dismissed'] as const;
export const REVIEW_ITEM_TYPES = [
  'flag_review',
  'quality_review',
  'request_changes',
  'duplicate_check',
] as const;

const reviewItemSchema = new Schema(
  {
    entityType: {
      type: String,
      enum: ['faq', 'question', 'answer'],
      required: true,
      index: true,
    },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    reviewType: {
      type: String,
      enum: REVIEW_ITEM_TYPES,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: REVIEW_ITEM_STATUSES,
      default: 'pending',
      index: true,
    },
    /** Moderator this item is assigned to, if any. */
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    /** Moderator who closed the item. */
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: { type: Date },
    /** Free-text notes added by the moderator. */
    notes: { type: String, trim: true, maxlength: 2000 },
    /** Why the review was created (flag reason, quality signal, etc.). */
    reason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true },
);

reviewItemSchema.index({ entityType: 1, entityId: 1 });
reviewItemSchema.index({ status: 1, reviewType: 1, createdAt: -1 });

export type ReviewItemDocument = HydratedDocument<InferSchemaType<typeof reviewItemSchema>>;
export const ReviewItemModel = model('ReviewItem', reviewItemSchema);
