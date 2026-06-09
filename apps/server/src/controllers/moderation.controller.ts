// Moderation HTTP layer. Endpoints for the moderator/admin dashboards: triaging the
// pending-answer queue, responding to personal questions, FAQ promotion, and the trash bin.
// Authorization (moderator/admin) is enforced at the route level.
import type { Request, Response } from 'express';
import type { ModerateAnswerInput } from '@samagama/shared';
import { moderationService } from '../services/moderation.service.js';
import { noContent, ok } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';

export const moderationController = {
  // Full queue of answers awaiting moderation, across all questions.
  async listPending(_req: Request, res: Response) {
    return ok(res, await moderationService.listPendingAnswers());
  },

  /** Pending answers scoped to one question — drives the Show More cycle. */
  async listPendingForQuestion(req: Request, res: Response) {
    const limit = Number(req.query.limit ?? 10);
    return ok(res, await moderationService.listPendingAnswersForQuestion(req.params.id!, limit));
  },

  /** Moderator posts a direct response to a personal question. */
  async respondToPersonal(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const body = (req.body as { body?: string }).body ?? '';
    await moderationService.respondToPersonalQuestion(req.params.id!, req.user.id, body);
    return noContent(res);
  },

  // Approve a pending answer (optionally edit body, award points, set visibility window).
  async approveAnswer(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    await moderationService.approveAnswer(
      req.params.id!,
      req.user.id,
      req.body as ModerateAnswerInput,
    );
    return noContent(res);
  },

  // Reject a pending answer (optionally with a moderator note explaining why).
  async rejectAnswer(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    await moderationService.rejectAnswer(
      req.params.id!,
      req.user.id,
      req.body as ModerateAnswerInput,
    );
    return noContent(res);
  },

  /** List approved answers eligible for FAQ conversion. */
  async listFaqCandidates(_req: Request, res: Response) {
    return ok(res, await moderationService.listFaqCandidates());
  },

  /** Convert an approved answer to a new FAQ draft. Admin only. */
  async convertToFaq(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const result = await moderationService.convertToFaq(req.params.id!, req.user.id);
    return ok(res, result);
  },

  /** Bulk approve multiple pending answers. */
  async bulkApprove(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const { ids } = req.body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      throw ApiError.badRequest('ids must be a non-empty array');
    }
    const result = await moderationService.bulkApprove(ids, req.user.id);
    return ok(res, result);
  },

  /** Bulk reject multiple pending answers. */
  async bulkReject(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const { ids, note } = req.body as { ids: string[]; note?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
      throw ApiError.badRequest('ids must be a non-empty array');
    }
    const result = await moderationService.bulkReject(ids, req.user.id, note);
    return ok(res, result);
  },

  /** Mark an approved answer as eligible for FAQ conversion. */
  async markForFaq(req: Request, res: Response) {
    await moderationService.markForFaq(req.params.id!);
    return noContent(res);
  },

  /** List all trashed community questions. */
  async listTrash(_req: Request, res: Response) {
    return ok(res, await moderationService.listTrashedQuestions());
  },

  /** Restore a trashed question back to community visibility. */
  async restoreFromTrash(req: Request, res: Response) {
    await moderationService.restoreTrashedQuestion(req.params.id!);
    return noContent(res);
  },

  /** Convert a community question to a FAQ draft. */
  async convertQuestionToFaq(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const { removeAndConvert, answerBody } = (req.body ?? {}) as {
      removeAndConvert?: boolean;
      answerBody?: string;
    };
    const result = await moderationService.convertQuestionToFaq(req.params.id!, req.user.id, {
      removeAndConvert,
      answerBody,
    });
    return ok(res, result);
  },
};
