// Yaksha chatbot service — RAG orchestration (Phase 6).
//
// Flow for a normal message:
//   1. Generate 384-dim query embedding.
//   2. Cosine-similarity search against published FAQs (chatbotConfidenceThreshold).
//   3. Assemble RAG payload: system prompt + FAQ context + conversation history.
//   4. Call LLM provider (mock | local-llama via rag/llm-server).
//   5. Persist response in TTL session cache (30 min idle timeout).
//   6. Return answer + source FAQ titles + fallback_triggered flag.
//
// #escalate / #forceescalate:
//   Intercept the command before the search step, call /internal/llm/summarize,
//   and record a ticket-style summary in ChatFeedback for moderator review.
//
// Conversation history is stored in the in-process TTL cache — no Redis required
// for testing. Each session lives for 30 minutes after the last message.
import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import type { ChatbotFeedbackStats, PublicChatFeedback } from '@samagama/shared';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { ApiError } from '../utils/api-error.js';
import { createTtlCache } from '../utils/ttl-cache.js';
import { generateEmbedding, cosineSimilarity } from './embedding.service.js';
import { FaqModel } from '../models/Faq.model.js';
import { SystemSettingsModel } from '../models/SystemSettings.model.js';
import { ChatFeedbackModel, type ChatFeedbackDocument } from '../models/ChatFeedback.model.js';
import { ChatSessionModel, type ChatSessionDocument } from '../models/ChatSession.model.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** ISO timestamp; present on messages loaded from Mongo, omitted for freshly-pushed ones. */
  createdAt?: string;
}

export interface ChatSource {
  id: string;
  title: string;
  similarity: number;
}

export interface ChatQueryResult {
  sessionId: string;
  answer: string;
  sources: ChatSource[];
  fallback_triggered: boolean;
  escalated?: boolean;
  messageIndex: number;
}

export interface SummaryChunk {
  summary: string;
  messageCount: number;
}

interface SessionData {
  /** Mongo _id of the backing ChatSession — used to stamp ChatFeedback.chatSessionId. */
  _id: Types.ObjectId;
  /** Stable UUID surfaced to the client. */
  sessionId: string;
  userId: string;
  messages: ChatMessage[];
  summaryChunks: SummaryChunk[];
  metaSummary: string;
  summarizedMessageCount: number;
  fallbackUnlocked: boolean;
}

// Thrown by callOllamaLlm when the Ollama process is not reachable.
// Surfaces as a 503 OLLAMA_NOT_CONNECTED to the client instead of a silent fallback.
class OllamaConnectionError extends Error {
  constructor(cause?: unknown) {
    super('Ollama service is not running or unreachable');
    this.name = 'OllamaConnectionError';
    if (cause instanceof Error) this.cause = cause;
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

// MongoDB (ChatSession collection) is the source of truth for conversation history.
// This in-process cache is a read-through hot-path tier in front of it — losing the cache
// (restart, eviction, TTL) never loses history, it just re-reads from Mongo. The cache
// only ever holds *active* threads; startNewSession evicts on close.
const SESSION_TTL_MS = 30 * 60 * 1000;
const sessionCache = createTtlCache<SessionData>({ ttlMs: SESSION_TTL_MS, maxEntries: 500 });

/** Map a persisted ChatSession document into the in-memory working shape. */
function docToSession(doc: ChatSessionDocument): SessionData {
  return {
    _id: doc._id,
    sessionId: doc.sessionId,
    userId: doc.userId.toString(),
    messages: doc.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
      createdAt: m.createdAt?.toISOString(),
    })),
    summaryChunks: [],
    metaSummary: '',
    summarizedMessageCount: 0,
    fallbackUnlocked: doc.fallbackUnlocked,
  };
}

/** Read a session by id (cache → Mongo), without creating one. Warms the cache on hit. */
async function loadSession(sessionId: string): Promise<SessionData | null> {
  const cached = sessionCache.get(sessionId);
  if (cached) return cached;
  const doc = await ChatSessionModel.findOne({ sessionId });
  if (!doc) return null;
  const session = docToSession(doc);
  sessionCache.set(sessionId, session);
  return session;
}

/**
 * Resolve the working session for a message: an explicit (own, active) session if given,
 * else the user's current active thread, else a freshly created one. Always returns a
 * session backed by a Mongo document.
 */
async function resolveSession(userId: string, sessionId?: string): Promise<SessionData> {
  if (sessionId) {
    const cached = sessionCache.get(sessionId);
    if (cached && cached.userId === userId) return cached;
    const doc = await ChatSessionModel.findOne({ sessionId, userId, status: 'active' });
    if (doc) {
      const session = docToSession(doc);
      sessionCache.set(sessionId, session);
      return session;
    }
    // Unknown/foreign/closed id → fall through to the user's active thread or a new one.
  }

  const active = await ChatSessionModel.findOne({ userId, status: 'active' }).sort({
    updatedAt: -1,
  });
  if (active) {
    const session = docToSession(active);
    sessionCache.set(session.sessionId, session);
    return session;
  }

  const doc = await ChatSessionModel.create({
    sessionId: randomUUID(),
    userId: new Types.ObjectId(userId),
    messages: [],
    fallbackUnlocked: false,
    status: 'active',
  });
  const session = docToSession(doc);
  sessionCache.set(session.sessionId, session);
  return session;
}

/**
 * Durably append turns to a session: mirror into the cache and $push to Mongo (atomic).
 * `appended` are the messages just pushed onto `session.messages`; we stamp createdAt at
 * write time since raw $push bypasses Mongoose subdocument defaults.
 */
async function persistTurn(session: SessionData, appended: ChatMessage[]): Promise<void> {
  sessionCache.set(session.sessionId, session);
  const now = new Date();
  await ChatSessionModel.updateOne(
    { sessionId: session.sessionId },
    {
      $push: { messages: { $each: appended.map((m) => ({ role: m.role, content: m.content, createdAt: now })) } },
      $set: { fallbackUnlocked: session.fallbackUnlocked, lastMessageAt: now },
    },
  );
}

const KEEP_RECENT_COUNT = 10;
const SUMMARIZE_THRESHOLD = 20;
const MAX_CHUNKS = 10;

// ─── Yaksha system prompt ─────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Yaksha, the official Samagama Internship Portal assistant. \
Your role is to answer student questions about the internship programme based ONLY on the verified FAQ context provided below.

Rules:
- Answer concisely and clearly in 2-4 sentences.
- Use ONLY information from the provided context. Never invent deadlines, stipends, or policies.
- If the answer is not in the context, reply EXACTLY with: "I don't have an answer for you at the moment. You can raise a query for it."
- Be friendly and professional. Address the student directly.
- Do NOT repeat the question back.`;

const FALLBACK_STRING =
  "I don't have an answer for you at the moment. You can raise a query for it.";

const pendingSummarizations = new Map<string, Promise<void>>();

// ─── Helper: Build context for LLM (includes hierarchical summary) ───────────

function buildLlmContext(session: SessionData): {
  conversation_history: ChatMessage[];
  metaContext: string;
} {
  const conversation_history = session.messages.slice(-KEEP_RECENT_COUNT);
  const metaContext = session.metaSummary
    ? `Previous conversation summary:\n${session.metaSummary}`
    : '';
  return { conversation_history, metaContext };
}

// ─── Helper: Trigger rolling window summarization ──────────────────────────────

async function triggerSummarization(sid: string, session: SessionData): Promise<void> {
  if (session.messages.length < SUMMARIZE_THRESHOLD) return;
  if (env.LLM_PROVIDER !== 'local-llama' && env.LLM_PROVIDER !== 'ollama') return;
  if (!env.LLM_BASE_URL && env.LLM_PROVIDER !== 'ollama') return;

  const existing = pendingSummarizations.get(sid);
  if (existing) return;

  const toSummarize = session.messages.slice(
    session.summarizedMessageCount,
    -KEEP_RECENT_COUNT,
  );
  if (toSummarize.length === 0) return;

  const promise = doSummarize(sid, session, toSummarize);
  pendingSummarizations.set(sid, promise);

  try {
    await promise;
  } finally {
    pendingSummarizations.delete(sid);
  }
}

async function doSummarize(sid: string, session: SessionData, toSummarize: ChatMessage[]): Promise<void> {
  try {
    if (env.LLM_PROVIDER === 'local-llama' && env.LLM_BASE_URL && env.LLM_INTERNAL_SECRET) {
      const res = await fetch(`${env.LLM_BASE_URL}/internal/llm/summarize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.LLM_INTERNAL_SECRET}`,
        },
        body: JSON.stringify({
          conversation_history: toSummarize,
          keepRecentCount: KEEP_RECENT_COUNT,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { status: string; data: { summary: string; summarizedCount: number } };
        if (json.status === 'success') {
          session.summaryChunks.push({
            summary: json.data.summary,
            messageCount: json.data.summarizedCount,
          });
        }
      }
    } else if (env.LLM_PROVIDER === 'ollama' && env.OLLAMA_BASE_URL) {
      const res = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a conversation summarizer. Summarize the following conversation into a concise summary that captures the key points, topics discussed, and any important context. Keep the summary brief but informative. Do not include any preamble, just output the summary text.',
            },
            {
              role: 'user',
              content: `Summarize this conversation:\n${toSummarize.map((m) => `${m.role}: ${m.content}`).join('\n')}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 300,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { choices: { message: { content: string } }[] };
        const summary = json.choices?.[0]?.message?.content?.trim() || '';
        if (summary) {
          session.summaryChunks.push({
            summary,
            messageCount: toSummarize.length,
          });
        }
      }
    }

    if (session.summaryChunks.length > MAX_CHUNKS) {
      session.summaryChunks = session.summaryChunks.slice(-MAX_CHUNKS);
    }

    if (session.summaryChunks.length > 0) {
      await regenerateMetaSummary(session);
    }

    session.summarizedMessageCount += toSummarize.length;
    sessionCache.set(sid, session);
  } catch (err) {
    logger.warn({ err }, 'Summarization failed — continuing without summarization');
  }
}

async function regenerateMetaSummary(session: SessionData): Promise<void> {
  if (session.summaryChunks.length === 0) return;

  if (env.LLM_PROVIDER === 'local-llama' && env.LLM_BASE_URL && env.LLM_INTERNAL_SECRET) {
    try {
      const res = await fetch(`${env.LLM_BASE_URL}/internal/llm/summarize-chunks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.LLM_INTERNAL_SECRET}`,
        },
        body: JSON.stringify({ chunks: session.summaryChunks }),
      });

      if (res.ok) {
        const json = (await res.json()) as { status: string; data: { metaSummary: string } };
        if (json.status === 'success') {
          session.metaSummary = json.data.metaSummary;
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Meta-summary generation failed');
    }
  } else if (env.LLM_PROVIDER === 'ollama' && env.OLLAMA_BASE_URL) {
    try {
      const chunksText = session.summaryChunks
        .map((c, i) => `Chunk ${i + 1}:\n${c.summary}`)
        .join('\n\n');

      const res = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: env.OLLAMA_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a conversation archivist. Given a series of conversation summaries (chunks), create a coherent meta-summary that captures the overall topics, themes, and important context across all chunks. Keep it concise but comprehensive. Do not include any preamble, just output the meta-summary.',
            },
            {
              role: 'user',
              content: `Chunks:\n${chunksText}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 400,
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { choices: { message: { content: string } }[] };
        const metaSummary = json.choices?.[0]?.message?.content?.trim() || '';
        if (metaSummary) {
          session.metaSummary = metaSummary;
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Meta-summary generation failed');
    }
  }
}

// ─── Main chat query ──────────────────────────────────────────────────────────

export const chatbotService = {
  /** Process a student message and return Yaksha's response. */
  async processQuery(
    userId: string,
    sessionId: string | undefined,
    message: string,
  ): Promise<ChatQueryResult> {
    const session = await resolveSession(userId, sessionId);
    const sid = session.sessionId;

    const trimmed = message.trim();

    // ── Escalation commands ────────────────────────────────────────────────────
    const isForceEscalate = /^#forceescalate/i.test(trimmed);
    const isEscalate = /^#escalate/i.test(trimmed) && !isForceEscalate;

    if (isForceEscalate || (isEscalate && session.fallbackUnlocked)) {
      return this.handleEscalation(userId, sid, session, trimmed, isForceEscalate ? 'force' : 'standard');
    }

    if (isEscalate && !session.fallbackUnlocked) {
      const answer =
        'Escalation is only available after Yaksha cannot answer your question. Please ask your question first.';
      const userMsg: ChatMessage = { role: 'user', content: trimmed };
      const botMsg: ChatMessage = { role: 'assistant', content: answer };
      session.messages.push(userMsg, botMsg);
      await persistTurn(session, [userMsg, botMsg]);
      return {
        sessionId: sid,
        answer,
        sources: [],
        fallback_triggered: false,
        messageIndex: session.messages.length - 1,
      };
    }

    // ── Retrieve FAQ context via embedding + cosine similarity ─────────────────
    const settings = await SystemSettingsModel.findById('global').lean();
    const threshold = settings?.chatbotConfidenceThreshold ?? 0.7;
    const maxSources = settings?.chatbotMaxSources ?? 6;

    const sources = await retrieveFaqSources(trimmed, { threshold, maxSources });

    // ── Call LLM ───────────────────────────────────────────────────────────────
    const { conversation_history, metaContext } = buildLlmContext(session);
    const ragContext = sources.map((s) => `FAQ: ${s.title}\nAnswer: ${s.answer}`);

    let answer: string;
    let fallback_triggered: boolean;
    try {
      ({ answer, fallback_triggered } = await callLlm({
        system_instruction: SYSTEM_PROMPT,
        meta_context: metaContext,
        rag_context: ragContext,
        conversation_history,
        current_message: trimmed,
        sources,
      }));
    } catch (err) {
      if (err instanceof OllamaConnectionError) {
        throw new ApiError(503, 'OLLAMA_NOT_CONNECTED', 'Ollama service is not running.');
      }
      throw err;
    }

    // ── Persist the turn (Mongo source of truth + cache mirror) ────────────────
    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const botMsg: ChatMessage = { role: 'assistant', content: answer };
    session.messages.push(userMsg, botMsg);
    if (fallback_triggered) session.fallbackUnlocked = true;
    await persistTurn(session, [userMsg, botMsg]);

    // ── Trigger rolling window summarization if needed ─────────────────────────
    if (session.messages.length >= SUMMARIZE_THRESHOLD) {
      triggerSummarization(sid, session);
    }

    return {
      sessionId: sid,
      answer,
      sources: sources.map((s) => ({ id: s.id, title: s.title, similarity: s.similarity })),
      fallback_triggered,
      messageIndex: session.messages.length - 1,
    };
  },

  /** Handle streaming SSE for long-running LLM calls (local-llama and ollama only). */
  async *streamQuery(
    userId: string,
    sessionId: string | undefined,
    message: string,
  ): AsyncGenerator<{ type: 'ping' | 'response' | 'error' | 'timeout'; data?: unknown }> {
    const session = await resolveSession(userId, sessionId);
    const sid = session.sessionId;

    const trimmed = message.trim();

    const isForceEscalate = /^#forceescalate/i.test(trimmed);
    const isEscalate = /^#escalate/i.test(trimmed) && !isForceEscalate;

    if (isForceEscalate || (isEscalate && session.fallbackUnlocked)) {
      const result = await this.handleEscalation(
        userId,
        sid,
        session,
        trimmed,
        isForceEscalate ? 'force' : 'standard',
      );
      yield { type: 'response', data: result };
      return;
    }

    if (isEscalate && !session.fallbackUnlocked) {
      const answer =
        'Escalation is only available after Yaksha cannot answer your question. Please ask your question first.';
      const userMsg: ChatMessage = { role: 'user', content: trimmed };
      const botMsg: ChatMessage = { role: 'assistant', content: answer };
      session.messages.push(userMsg, botMsg);
      await persistTurn(session, [userMsg, botMsg]);
      yield {
        type: 'response',
        data: {
          answer,
          sources: [],
          fallback_triggered: false,
          sessionId: sid,
          messageIndex: session.messages.length - 1,
        },
      };
      return;
    }

    const settings = await SystemSettingsModel.findById('global').lean();
    const threshold = settings?.chatbotConfidenceThreshold ?? 0.7;
    const maxSources = settings?.chatbotMaxSources ?? 6;

    const sources = await retrieveFaqSources(trimmed, { threshold, maxSources });
    const { conversation_history, metaContext } = buildLlmContext(session);
    const ragContext = sources.map((s) => `FAQ: ${s.title}\nAnswer: ${s.answer}`);

    const supportsStreaming = env.LLM_PROVIDER === 'local-llama' || env.LLM_PROVIDER === 'ollama';

    if (!supportsStreaming) {
      yield { type: 'ping', data: { timestamp: Date.now() } };
      const { answer, fallback_triggered } = await callLlm({
        system_instruction: SYSTEM_PROMPT,
        meta_context: metaContext,
        rag_context: ragContext,
        conversation_history,
        current_message: trimmed,
        sources,
      });

      const userMsg: ChatMessage = { role: 'user', content: trimmed };
      const botMsg: ChatMessage = { role: 'assistant', content: answer };
      session.messages.push(userMsg, botMsg);
      if (fallback_triggered) session.fallbackUnlocked = true;
      await persistTurn(session, [userMsg, botMsg]);

      if (session.messages.length >= SUMMARIZE_THRESHOLD) {
        triggerSummarization(sid, session);
      }

      yield {
        type: 'response',
        data: {
          answer,
          sources: sources.map((s) => ({ id: s.id, title: s.title, similarity: s.similarity })),
          fallback_triggered,
          sessionId: sid,
          messageIndex: session.messages.length - 1,
        },
      };
      return;
    }

    const stream = callLlmStream({
      system_instruction: SYSTEM_PROMPT,
      meta_context: metaContext,
      rag_context: ragContext,
      conversation_history,
      current_message: trimmed,
      sources,
    });

    let fullContent = '';
    let fallback_triggered = false;

    for await (const event of stream) {
      if (event.type === 'ping') {
        yield { type: 'ping', data: event.timestamp };
      } else if (event.type === 'response') {
        fullContent = event.content ?? '';
        fallback_triggered = fullContent.includes(FALLBACK_STRING);
      } else if (event.type === 'error') {
        yield { type: 'error', data: { message: event.message } };
        return;
      } else if (event.type === 'timeout') {
        yield { type: 'timeout' };
        return;
      }
    }

    const userMsg: ChatMessage = { role: 'user', content: trimmed };
    const botMsg: ChatMessage = { role: 'assistant', content: fullContent };
    session.messages.push(userMsg, botMsg);
    if (fallback_triggered) session.fallbackUnlocked = true;
    await persistTurn(session, [userMsg, botMsg]);

    if (session.messages.length >= SUMMARIZE_THRESHOLD) {
      triggerSummarization(sid, session);
    }

    yield {
      type: 'response',
      data: {
        answer: fullContent,
        sources: sources.map((s) => ({ id: s.id, title: s.title, similarity: s.similarity })),
        fallback_triggered,
        sessionId: sid,
        messageIndex: session.messages.length - 1,
      },
    };
  },

  /** Handle #escalate or #forceescalate commands. */
  async handleEscalation(
    userId: string,
    sessionId: string,
    session: SessionData,
    message: string,
    type: 'standard' | 'force',
  ): Promise<ChatQueryResult> {
    const forceReason =
      type === 'force'
        ? message.replace(/^#forceescalate\s*/i, '').trim() || 'User requested escalation'
        : 'Chatbot could not answer — student escalating';

    let summary = `Issue escalated by student. Reason: ${forceReason}`;

    if (env.LLM_PROVIDER === 'local-llama' && env.LLM_BASE_URL && env.LLM_INTERNAL_SECRET) {
      try {
        const res = await fetch(`${env.LLM_BASE_URL}/internal/llm/summarize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.LLM_INTERNAL_SECRET}`,
          },
          body: JSON.stringify({
            escalation_type: type === 'force' ? 'force_escalate' : 'escalate',
            force_reason: forceReason,
            conversation_history: session.messages.slice(-10),
          }),
        });
        if (res.ok) {
          const json = (await res.json()) as { status: string; data: { summary: string } };
          if (json.status === 'success') summary = json.data.summary;
        }
      } catch (err) {
        logger.warn({ err }, 'LLM summarise call failed — using fallback summary');
      }
    }

    const lastUserMsg =
      session.messages.filter((m) => m.role === 'user').at(-1)?.content ?? message;
    await ChatFeedbackModel.create({
      chatSessionId: session._id,
      messageIndex: session.messages.length,
      query: lastUserMsg,
      answer: summary,
      rating: 'incorrect',
      comment: `Escalation (${type}): ${forceReason}`,
      userId: new Types.ObjectId(userId),
      status: 'open',
    });

    const answer = `✅ Your issue has been escalated to the moderation team. They'll review it shortly.\n\n**Summary:** ${summary}`;
    const userMsg: ChatMessage = { role: 'user', content: message };
    const botMsg: ChatMessage = { role: 'assistant', content: answer };
    session.messages.push(userMsg, botMsg);
    session.fallbackUnlocked = false;
    await persistTurn(session, [userMsg, botMsg]);

    return {
      sessionId,
      answer,
      sources: [],
      fallback_triggered: false,
      escalated: true,
      messageIndex: session.messages.length - 1,
    };
  },

  /** Get all messages in a specific session (cache → Mongo) for the frontend to restore. */
  async getSession(sessionId: string): Promise<{ messages: ChatMessage[]; metaSummary: string }> {
    const session = await loadSession(sessionId);
    return { messages: session?.messages ?? [], metaSummary: session?.metaSummary ?? '' };
  },

  /**
   * The caller's current thread, resolved by userId — the basis for auto-restore. Reads
   * straight from Mongo (authoritative, includes timestamps). Returns a null sessionId when
   * the user has no active thread yet.
   */
  async getActiveSession(
    userId: string,
  ): Promise<{ sessionId: string | null; messages: ChatMessage[] }> {
    const active = await ChatSessionModel.findOne({ userId, status: 'active' }).sort({
      updatedAt: -1,
    });
    if (!active) return { sessionId: null, messages: [] };
    sessionCache.set(active.sessionId, docToSession(active));
    return { sessionId: active.sessionId, messages: docToSession(active).messages };
  },

  /**
   * "Clear / Start new": close the user's active thread(s) so the next message opens a fresh
   * one. Closed threads are retained permanently in Mongo. Evicts them from the cache.
   */
  async startNewSession(userId: string): Promise<void> {
    const active = await ChatSessionModel.find({ userId, status: 'active' }).select('sessionId');
    for (const doc of active) sessionCache.delete(doc.sessionId);
    await ChatSessionModel.updateMany({ userId, status: 'active' }, { $set: { status: 'closed' } });
  },

  /** Student rates a bot response (helpful / incorrect). */
  async submitFeedback(opts: {
    userId: string;
    sessionId: string;
    messageIndex: number;
    rating: 'helpful' | 'incorrect';
    comment?: string;
  }): Promise<void> {
    // Read-only load (cache → Mongo) — never create a session as a side effect of feedback.
    const session = await loadSession(opts.sessionId);
    const botMsg = session?.messages[opts.messageIndex];
    const userMsg = session?.messages[opts.messageIndex - 1];

    const query = userMsg?.content ?? '';
    const answer = botMsg?.content ?? '';
    const messages = session?.messages ?? [];

    await ChatFeedbackModel.findOneAndUpdate(
      { userId: new Types.ObjectId(opts.userId), messageIndex: opts.messageIndex },
      {
        $set: {
          rating: opts.rating,
          comment: opts.comment,
          status: 'open',
          query,
          answer,
          messages,
          chatSessionId: session?._id,
        },
      },
      { upsert: true, new: true },
    );
  },

  // Remove a student's own rating for a message (undo an accidental thumbs-up/down).
  async retractFeedback(opts: {
    userId: string;
    messageIndex: number;
  }): Promise<void> {
    await ChatFeedbackModel.deleteOne({
      userId: new Types.ObjectId(opts.userId),
      messageIndex: opts.messageIndex,
    });
  },

  // ── Admin/mod read paths (unchanged) ──────────────────────────────────────

  async listFeedback(
    filter: 'all' | 'helpful' | 'unhelpful' | 'archived',
  ): Promise<PublicChatFeedback[]> {
    const q: Record<string, unknown> = {};
    if (filter === 'archived') {
      q.status = 'archived';
    } else {
      q.status = { $ne: 'archived' };
      if (filter === 'helpful') q.rating = 'helpful';
      if (filter === 'unhelpful') q.rating = 'incorrect';
    }

    interface PopulatedFeedback extends Omit<ChatFeedbackDocument, 'userId' | 'messages'> {
      userId: { _id: Types.ObjectId; name: string };
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }

    const rows = await ChatFeedbackModel.find(q)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('userId', 'name')
      .lean<PopulatedFeedback[]>();

    return rows.map((f) => ({
      id: f._id.toString(),
      query: f.query,
      answer: f.answer,
      rating: f.rating,
      comment: f.comment ?? undefined,
      user: { id: f.userId._id.toString(), name: f.userId.name },
      status: f.status as 'open' | 'reviewed' | 'actioned' | 'archived',
      messages: f.messages && f.messages.length > 0 ? f.messages : undefined,
      createdAt: f.createdAt.toISOString(),
    }));
  },

  async getStats(): Promise<ChatbotFeedbackStats> {
    const activeFilter = { status: { $ne: 'archived' } };
    const [total, helpful, unhelpful] = await Promise.all([
      ChatFeedbackModel.countDocuments(activeFilter),
      ChatFeedbackModel.countDocuments({ ...activeFilter, rating: 'helpful' }),
      ChatFeedbackModel.countDocuments({ ...activeFilter, rating: 'incorrect' }),
    ]);
    return { total, helpful, unhelpful };
  },

  async updateFeedbackStatus(
    id: string,
    status: 'reviewed' | 'actioned' | 'archived',
  ): Promise<void> {
    await ChatFeedbackModel.findByIdAndUpdate(id, { $set: { status } });
  },

  async deleteFeedback(id: string): Promise<void> {
    await ChatFeedbackModel.findByIdAndDelete(id);
  },
};

// ─── FAQ retrieval via embedding similarity ───────────────────────────────────

interface FaqSource {
  id: string;
  title: string;
  answer: string;
  similarity: number;
}

async function retrieveFaqSources(
  query: string,
  opts: { threshold: number; maxSources: number },
): Promise<FaqSource[]> {
  const queryEmbedding = await generateEmbedding(query);

  const faqs = await FaqModel.find({ status: 'published' })
    .select('title answer embedding')
    .lean<{ _id: unknown; title: string; answer: string; embedding?: number[] }[]>();

  const scored = faqs
    .filter((f) => f.embedding && f.embedding.length === 384)
    .map((f) => ({
      id: (f._id as { toString(): string }).toString(),
      title: f.title,
      answer: f.answer,
      similarity: cosineSimilarity(queryEmbedding, f.embedding!),
    }))
    .filter((r) => r.similarity >= opts.threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, opts.maxSources);

  if (scored.length === 0 && query.trim()) {
    const textResults = await FaqModel.find(
      { status: 'published', $text: { $search: query } },
      { score: { $meta: 'textScore' } },
    )
      .sort({ score: { $meta: 'textScore' } })
      .limit(opts.maxSources)
      .lean<{ _id: unknown; title: string; answer: string }[]>();

    return textResults.map((f) => ({
      id: (f._id as { toString(): string }).toString(),
      title: f.title,
      answer: f.answer,
      similarity: 0.5,
    }));
  }

  return scored;
}

// ─── LLM provider dispatch ────────────────────────────────────────────────────

async function callLlm(opts: {
  system_instruction: string;
  meta_context: string;
  rag_context: string[];
  conversation_history: ChatMessage[];
  current_message: string;
  sources: FaqSource[];
}): Promise<{ answer: string; fallback_triggered: boolean }> {
  if (env.LLM_PROVIDER === 'local-llama' && env.LLM_BASE_URL && env.LLM_INTERNAL_SECRET) {
    return callLlmServer(opts);
  }

  if (env.LLM_PROVIDER === 'gemini' && env.GEMINI_API_KEY) {
    return callGeminiLlm(opts);
  }

  if (env.LLM_PROVIDER === 'groq' && env.GROQ_API_KEY) {
    return callGroqLlm(opts);
  }

  if (env.LLM_PROVIDER === 'ollama') {
    return callOllamaLlm(opts);
  }

  return mockLlm(opts);
}

async function callLlmServer(opts: {
  system_instruction: string;
  meta_context: string;
  rag_context: string[];
  conversation_history: ChatMessage[];
  current_message: string;
}): Promise<{ answer: string; fallback_triggered: boolean }> {
  try {
    const res = await fetch(`${env.LLM_BASE_URL}/internal/llm/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LLM_INTERNAL_SECRET}`,
      },
      body: JSON.stringify({
        system_instruction: opts.system_instruction + (opts.meta_context ? '\n\n' + opts.meta_context : ''),
        rag_context: opts.rag_context,
        conversation_history: opts.conversation_history,
        current_message: opts.current_message,
      }),
    });

    if (!res.ok) throw new Error(`LLM server returned ${res.status}`);

    const json = (await res.json()) as {
      status: string;
      data: { response_text: string; fallback_triggered: boolean };
    };
    return { answer: json.data.response_text, fallback_triggered: json.data.fallback_triggered };
  } catch (err) {
    logger.warn({ err }, 'LLM server call failed — falling back to mock');
    return mockLlm({
      rag_context: opts.rag_context,
      current_message: opts.current_message,
      sources: [],
    });
  }
}

async function* callLlmServerStream(opts: {
  system_instruction: string;
  meta_context: string;
  rag_context: string[];
  conversation_history: ChatMessage[];
  current_message: string;
}): AsyncGenerator<{ type: 'ping' | 'response' | 'error' | 'timeout'; content?: string; timestamp?: number; message?: string }> {
  try {
    const response = await fetch(`${env.LLM_BASE_URL}/internal/llm/generate-stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.LLM_INTERNAL_SECRET}`,
      },
      body: JSON.stringify({
        system_instruction: opts.system_instruction + (opts.meta_context ? '\n\n' + opts.meta_context : ''),
        rag_context: opts.rag_context,
        conversation_history: opts.conversation_history,
        current_message: opts.current_message,
      }),
    });

    if (!response.ok) throw new Error(`LLM server returned ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'ping') {
              yield { type: 'ping', timestamp: data.timestamp };
            } else if (data.type === 'response') {
              yield { type: 'response', content: data.content };
            } else if (data.type === 'error') {
              yield { type: 'error', message: data.message };
            } else if (data.type === 'timeout') {
              yield { type: 'timeout' };
            }
          } catch {
            // Ignore malformed stream events and continue reading.
          }
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, 'LLM server stream failed');
    yield { type: 'error', message: err instanceof Error ? err.message : 'Stream failed' };
  }
}

async function callGeminiLlm(opts: {
  system_instruction: string;
  meta_context: string;
  rag_context: string[];
  conversation_history: ChatMessage[];
  current_message: string;
  sources: FaqSource[];
}): Promise<{ answer: string; fallback_triggered: boolean }> {
  try {
    const contextBlock =
      opts.rag_context.length > 0
        ? `\n\nAPPROVED FAQ CONTEXT:\n${opts.rag_context.join('\n\n')}`
        : '';

    const metaBlock = opts.meta_context ? `\n\n${opts.meta_context}` : '';

    const historyContents = opts.conversation_history.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      system_instruction: { parts: [{ text: opts.system_instruction + contextBlock + metaBlock }] },
      contents: [...historyContents, { role: 'user', parts: [{ text: opts.current_message }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 500 },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) throw new Error(`Gemini LLM error: ${res.status}`);

    const json = (await res.json()) as {
      candidates: { content: { parts: { text: string }[] } }[];
    };
    const answer = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? FALLBACK_STRING;
    const fallback_triggered =
      answer === FALLBACK_STRING || answer.includes("I don't have an answer");
    return { answer, fallback_triggered };
  } catch (err) {
    logger.warn({ err }, 'Gemini LLM call failed — falling back to mock');
    return mockLlm(opts);
  }
}

async function callOllamaLlm(opts: {
  system_instruction: string;
  meta_context: string;
  rag_context: string[];
  conversation_history: ChatMessage[];
  current_message: string;
  sources: FaqSource[];
}): Promise<{ answer: string; fallback_triggered: boolean }> {
  try {
    const contextBlock =
      opts.rag_context.length > 0
        ? `\n\nAPPROVED FAQ CONTEXT:\n${opts.rag_context.join('\n\n')}`
        : '';

    const metaBlock = opts.meta_context ? `\n\n${opts.meta_context}` : '';

    const messages = [
      { role: 'system', content: opts.system_instruction + contextBlock + metaBlock },
      ...opts.conversation_history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: opts.current_message },
    ];

    const res = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 500,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Ollama returned ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const answer = json.choices?.[0]?.message?.content?.trim() ?? FALLBACK_STRING;
    const fallback_triggered =
      answer === FALLBACK_STRING || answer.includes("I don't have an answer");
    return { answer, fallback_triggered };
  } catch (err) {
    logger.error({ err }, 'Ollama connection failed — service may not be running');
    throw new OllamaConnectionError(err);
  }
}

async function* callOllamaStream(opts: {
  system_instruction: string;
  meta_context: string;
  rag_context: string[];
  conversation_history: ChatMessage[];
  current_message: string;
}): AsyncGenerator<{ type: 'ping' | 'response' | 'error' | 'timeout'; content?: string; timestamp?: number; message?: string }> {
  try {
    const contextBlock =
      opts.rag_context.length > 0
        ? `\n\nAPPROVED FAQ CONTEXT:\n${opts.rag_context.join('\n\n')}`
        : '';

    const metaBlock = opts.meta_context ? `\n\n${opts.meta_context}` : '';

    const messages = [
      { role: 'system', content: opts.system_instruction + contextBlock + metaBlock },
      ...opts.conversation_history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: opts.current_message },
    ];

    const response = await fetch(`${env.OLLAMA_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 500,
        stream: true,
      }),
    });

    if (!response.ok) throw new Error(`Ollama returned ${response.status}`);
    if (!response.body) throw new Error('No response body');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              fullContent += parsed.choices[0].delta.content;
            }
          } catch {
            // Ignore malformed stream events and continue reading.
          }
        }
      }
    }

    yield { type: 'response', content: fullContent.trim() };
  } catch (err) {
    logger.warn({ err }, 'Ollama stream failed');
    yield { type: 'error', message: err instanceof Error ? err.message : 'Stream failed' };
  }
}

function callLlmStream(opts: {
  system_instruction: string;
  meta_context: string;
  rag_context: string[];
  conversation_history: ChatMessage[];
  current_message: string;
  sources: FaqSource[];
}): AsyncGenerator<{ type: 'ping' | 'response' | 'error' | 'timeout'; content?: string; timestamp?: number; message?: string }> {
  if (env.LLM_PROVIDER === 'local-llama' && env.LLM_BASE_URL && env.LLM_INTERNAL_SECRET) {
    return callLlmServerStream(opts);
  }

  if (env.LLM_PROVIDER === 'ollama') {
    return callOllamaStream(opts);
  }

  return (async function* () {
    yield { type: 'error', message: 'Streaming not supported for this provider' };
  })();
}

async function callGroqLlm(opts: {
  system_instruction: string;
  meta_context: string;
  rag_context: string[];
  conversation_history: ChatMessage[];
  current_message: string;
  sources: FaqSource[];
}): Promise<{ answer: string; fallback_triggered: boolean }> {
  try {
    const contextBlock =
      opts.rag_context.length > 0
        ? `\n\nAPPROVED FAQ CONTEXT:\n${opts.rag_context.join('\n\n')}`
        : '';

    const metaBlock = opts.meta_context ? `\n\n${opts.meta_context}` : '';

    const messages = [
      { role: 'system', content: opts.system_instruction + contextBlock + metaBlock },
      ...opts.conversation_history.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      { role: 'user', content: opts.current_message },
    ];

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL,
        messages,
        temperature: 0.2,
        max_tokens: 500,
        stream: false,
      }),
    });

    if (!res.ok) throw new Error(`Groq returned ${res.status}: ${await res.text()}`);

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const answer = json.choices?.[0]?.message?.content?.trim() ?? FALLBACK_STRING;
    const fallback_triggered =
      answer === FALLBACK_STRING || answer.includes("I don't have an answer");
    return { answer, fallback_triggered };
  } catch (err) {
    logger.warn({ err }, 'Groq call failed — falling back to mock');
    return mockLlm(opts);
  }
}

function mockLlm(opts: { rag_context: string[]; current_message: string; sources: FaqSource[] }): {
  answer: string;
  fallback_triggered: boolean;
} {
  if (opts.sources.length === 0 || opts.rag_context.length === 0) {
    return { answer: FALLBACK_STRING, fallback_triggered: true };
  }

  const top = opts.sources[0];
  const excerpt = top.answer.length > 400 ? top.answer.slice(0, 400) + '…' : top.answer;
  return {
    answer: `Based on the Samagama FAQ, here's what I found:\n\n${excerpt}\n\n*Source: ${top.title}*`,
    fallback_triggered: false,
  };
}
