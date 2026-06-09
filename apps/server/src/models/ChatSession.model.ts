// Persistent chatbot conversation thread (Phase 6 — durable history).
//
// MongoDB is the source of truth for Yaksha chat history. Each document is one
// conversation thread for a user. The in-process TTL cache in chatbot.service.ts is a
// read-through performance tier in front of this collection — not a datastore.
//
// Model: one *active* thread per user (status='active'). "Clear / Start new" closes the
// current thread (status='closed') so the next message opens a fresh one; closed threads
// are retained permanently. Messages are embedded and appended via $push, mirroring the
// embedded `messages` snapshot already used in ChatFeedback.model.ts.
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

// A single turn in the conversation. `_id: false` keeps the array lean — turns are
// addressed positionally (messageIndex), never referenced individually.
const chatMessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const chatSessionSchema = new Schema(
  {
    /** Stable UUID surfaced to the client and referenced by ChatFeedback.chatSessionId. */
    sessionId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messages: { type: [chatMessageSchema], default: [] },
    /** True after a fallback response — unlocks the #escalate command for this thread. */
    fallbackUnlocked: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
      required: true,
    },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Fast lookup of a user's current thread (resolveSession's hot path).
chatSessionSchema.index({ userId: 1, status: 1 });

export type ChatSessionDocument = HydratedDocument<InferSchemaType<typeof chatSessionSchema>>;
export const ChatSessionModel = model('ChatSession', chatSessionSchema);
