// Yaksha RAG chatbot HTTP layer (Phase 6). Handles the chat exchange plus the
// feedback management surfaces used by admins. All RAG logic lives in chatbotService.
import type { Request, Response } from 'express';
import { chatbotService } from '../services/chatbot.service.js';
import { logger } from '../config/logger.js';
import { ok } from '../utils/api-response.js';

export const chatbotController = {
  // Send a user message and get the chatbot's RAG-grounded reply (creates a session if none given).
  async sendMessage(req: Request, res: Response) {
    const { message, sessionId } = req.body as { message: string; sessionId?: string };
    const userId = (req as Request & { user: { id: string } }).user.id;
    return ok(res, await chatbotService.processQuery(userId, sessionId, message));
  },

  // Fetch the message history for an existing chat session.
  async getSession(req: Request, res: Response) {
    const { sessionId } = req.params;
    return ok(res, await chatbotService.getSession(sessionId));
  },

  // Auto-restore: the caller's current conversation thread (resolved by userId).
  async getActiveSession(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    return ok(res, await chatbotService.getActiveSession(userId));
  },

  // "Clear / Start new": close the caller's active thread so the next message starts fresh.
  async startNewSession(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    await chatbotService.startNewSession(userId);
    return ok(res, { success: true });
  },

  // Record a student's thumbs-up/down rating on a specific chatbot answer.
  async submitFeedback(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const { sessionId, messageIndex, rating, comment } = req.body as {
      sessionId: string;
      messageIndex: number;
      rating: 'helpful' | 'incorrect';
      comment?: string;
    };
    await chatbotService.submitFeedback({ userId, sessionId, messageIndex, rating, comment });
    return ok(res, { success: true });
  },

  // Remove the student's own rating on an answer (undo an accidental click).
  async retractFeedback(req: Request, res: Response) {
    const userId = (req as Request & { user: { id: string } }).user.id;
    const { messageIndex } = req.body as { sessionId: string; messageIndex: number };
    await chatbotService.retractFeedback({ userId, messageIndex });
    return ok(res, { success: true });
  },

  // Admin: list collected feedback, optionally filtered by rating/status bucket.
  async listFeedback(req: Request, res: Response) {
    const filter =
      (req.query.filter as 'all' | 'helpful' | 'unhelpful' | 'archived' | undefined) ?? 'all';
    return ok(res, await chatbotService.listFeedback(filter));
  },

  // Admin: aggregate chatbot usage/quality stats for the dashboard.
  async getStats(_req: Request, res: Response) {
    return ok(res, await chatbotService.getStats());
  },

  // Admin: move a feedback item through its review workflow.
  async updateFeedbackStatus(req: Request, res: Response) {
    const { id } = req.params;
    const { status } = req.body as { status: 'reviewed' | 'actioned' | 'archived' };
    await chatbotService.updateFeedbackStatus(id, status);
    return ok(res, { success: true });
  },

  // Admin: permanently remove a feedback item.
  async deleteFeedback(req: Request, res: Response) {
    const { id } = req.params;
    await chatbotService.deleteFeedback(id);
    return ok(res, { success: true });
  },

  async streamMessage(req: Request, res: Response) {
    const { sessionId } = req.params;
    const { message } = req.body as { message: string };
    const userId = (req as Request & { user: { id: string } }).user.id;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (type: string, data: unknown) => {
      res.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    };

    try {
      for await (const event of chatbotService.streamQuery(userId, sessionId, message)) {
        sendEvent(event.type, event.data);
      }
    } catch (err) {
      logger.error({ err }, 'Stream processing error');
      sendEvent('error', { message: err instanceof Error ? err.message : 'Unknown error' });
    }

    res.end();
  },
};
