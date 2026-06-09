// Chatbot feedback row. PRD §12.9.
//
// In Phase 6 each row is created when a student rates a chat message. Until then this
// collection can be seeded with demo data so the moderator dashboard has something to render.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CHAT_FEEDBACK_RATINGS } from '@samagama/shared';

const chatFeedbackSchema = new Schema(
  {
    /** ChatSession id; nullable until Phase 6 wires real sessions. */
    chatSessionId: { type: Schema.Types.ObjectId, ref: 'ChatSession' },
    /** Index into the session's messages array. */
    messageIndex: { type: Number, default: 0 },

    /** Snapshot of the user query and bot answer. Useful for the moderator inbox. */
    query: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },

    /** Full conversation snapshot captured at the time of rating. */
    messages: {
      type: [{ role: { type: String, enum: ['user', 'assistant'] }, content: String }],
      default: undefined,
    },

    rating: {
      type: String,
      enum: CHAT_FEEDBACK_RATINGS,
      required: true,
      index: true,
    },
    comment: { type: String, trim: true, maxlength: 1000 },

    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /** PRD §13.6: incorrect feedback creates a review item; track its lifecycle here. */
    status: {
      type: String,
      enum: ['open', 'reviewed', 'actioned', 'archived'],
      default: 'open',
      index: true,
    },
  },
  { timestamps: true },
);

chatFeedbackSchema.index({ rating: 1, createdAt: -1 });

export type ChatFeedbackDocument = HydratedDocument<InferSchemaType<typeof chatFeedbackSchema>>;
export const ChatFeedbackModel = model('ChatFeedback', chatFeedbackSchema);
