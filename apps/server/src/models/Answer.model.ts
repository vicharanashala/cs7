// Community answer. PRD §12.6 + Change Spec §8.2 (upvotes/downvotes).
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ANSWER_STATUSES } from '@samagama/shared';

const answerSchema = new Schema(
  {
    questionId: { type: Schema.Types.ObjectId, ref: 'Question', required: true, index: true },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    answeredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: {
      type: String,
      enum: ANSWER_STATUSES,
      default: 'pending',
      required: true,
      index: true,
    },
    // Moderator who last actioned this answer, plus their note and approval timestamp.
    moderatorId: { type: Schema.Types.ObjectId, ref: 'User' },
    moderationNote: { type: String, trim: true, maxlength: 1000 },
    approvedAt: { type: Date },
    /** Reserved for Phase 6 vector search. */
    embedding: { type: [Number], default: undefined, select: false },
    // True once a moderator marks this answer as a candidate to be promoted into an FAQ.
    eligibleForFaqConversion: { type: Boolean, default: false },
    // Back-reference to the FAQ created from this answer, if it was converted.
    convertedFaqId: { type: Schema.Types.ObjectId, ref: 'Faq' },

    // Voter id arrays are the source of truth (and prevent double-voting); the *Count
    // fields are denormalized totals kept in sync for cheap reads. Arrays are `select: false`
    // so they aren't shipped to clients by default.
    upvotes: { type: [Schema.Types.ObjectId], default: [], select: false },
    downvotes: { type: [Schema.Types.ObjectId], default: [], select: false },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Answer feed for a question: approved first, then most-upvoted, then newest.
answerSchema.index({ questionId: 1, status: 1, upvoteCount: -1, createdAt: -1 });
// Enforces one answer per user per question at the database level.
answerSchema.index({ questionId: 1, answeredBy: 1 }, { unique: true });

export type AnswerDocument = HydratedDocument<InferSchemaType<typeof answerSchema>>;
export const AnswerModel = model('Answer', answerSchema);
