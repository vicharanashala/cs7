// Community Q&A question. Mirrors PRD §12.5 plus Change Spec §8.1 additions:
//   - `type`: 'personal' | 'community'  → personal questions go to moderators only.
//   - `screenshotUrl`                  → optional image attached at Ask time.
//   - `taggedStudents[]`               → other students who tagged themselves to this question.
//   - `moderatorViewedAt`              → timestamp set the first time a mod opens it (for "Seen" tick).
//
// Aligned with remote repo:
//   - `priorityScore`  → computed priority for moderation queue ordering.
//   - `resolvedAt`     → timestamp when the question was resolved.
//   - `embedding`      → 384-dim vector for semantic duplicate detection (populated async).
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { QUESTION_STATUSES, QUESTION_TYPES } from '@samagama/shared';

const existingAnswerCheckSchema = new Schema(
  {
    checkedAt: { type: Date, default: Date.now },
    matchedFaqs: [{ type: Schema.Types.ObjectId, ref: 'Faq' }],
    matchedQuestions: [{ type: Schema.Types.ObjectId, ref: 'Question' }],
  },
  { _id: false },
);

const questionSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 280 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },

    category: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    tags: [{ type: Schema.Types.ObjectId, ref: 'Tag' }],

    type: {
      type: String,
      enum: QUESTION_TYPES,
      required: true,
      default: 'community',
      index: true,
    },

    status: {
      type: String,
      enum: QUESTION_STATUSES,
      required: true,
      default: 'open',
      index: true,
    },
    duplicateOf: { type: Schema.Types.ObjectId, ref: 'Question' },

    askedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    screenshotUrl: { type: String, trim: true },
    taggedStudents: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    moderatorViewedAt: { type: Date },

    existingAnswerCheck: { type: existingAnswerCheckSchema, default: undefined },

    viewCount: { type: Number, default: 0 },
    answerCount: { type: Number, default: 0 },

    /** Priority score for moderation queue ordering — mirrors remote priorityScore. */
    priorityScore: { type: Number, default: 0, index: true },

    /** Set when the question status transitions to 'resolved'. */
    resolvedAt: { type: Date },

    /**
     * When the approved post's community visibility expires.
     * null / missing = permanent.
     * Set at first-approval time based on the moderator's chosen period (2 | 3 | 7 days).
     */
    visibilityExpiresAt: { type: Date, default: undefined },

    /** True once the trash-expiry job (or a manual action) moves this question to trash. */
    isTrashed: { type: Boolean, default: false, index: true },

    /** Timestamp when the question was trashed. */
    trashedAt: { type: Date, default: undefined },

    /**
     * 384-dim embedding of the question (title + description) for semantic
     * duplicate detection. Built via composeQuestionEmbeddingText so it matches
     * the query side of checkExisting. Populated asynchronously after creation.
     */
    embedding: {
      type: [Number],
      default: undefined,
      select: false,
      validate: {
        validator: (v: number[]) => !v || v.length === 0 || v.length === 384,
        message: 'embedding must be exactly 384 dimensions',
      },
    },
  },
  { timestamps: true },
);

// Text index for similarity search in checkExisting() (Change Spec §6.4).
questionSchema.index(
  { title: 'text', description: 'text' },
  { weights: { title: 10, description: 1 }, name: 'question_text_index' },
);
questionSchema.index({ status: 1, type: 1, updatedAt: -1 });
questionSchema.index({ status: 1, priorityScore: -1, createdAt: -1 });

export type QuestionDocument = HydratedDocument<InferSchemaType<typeof questionSchema>>;
export const QuestionModel = model('Question', questionSchema);
