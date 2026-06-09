// Flag/Report on an FAQ, question, answer, or chatbot response. PRD §12.7 / §8.8.
//
// Constraint: one active flag per (user, entityType, entityId). The service updates the existing
// flag row instead of creating duplicates so a user can amend the reason without spamming.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { FLAG_ENTITY_TYPES, FLAG_REASONS, FLAG_STATUSES } from '@samagama/shared';

const flagSchema = new Schema(
  {
    entityType: { type: String, enum: FLAG_ENTITY_TYPES, required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    reason: { type: String, enum: FLAG_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 1000 },

    status: { type: String, enum: FLAG_STATUSES, default: 'open', index: true },
    reportedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resolutionNote: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);

// One active flag per user per entity. Resolved/dismissed flags don't block new ones.
flagSchema.index(
  { reportedBy: 1, entityType: 1, entityId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['open', 'under_review'] } } },
);

export type FlagDocument = HydratedDocument<InferSchemaType<typeof flagSchema>>;
export const FlagModel = model('Flag', flagSchema);
