// Community Q&A HTTP layer. Thin controllers: authenticate, unpack the request,
// delegate all business rules to qnaService, then shape the HTTP response.
// Request bodies are already validated/typed by the `validate` middleware on the routes.
import type { Request, Response } from 'express';
import type {
  AnswerCreateInput,
  CheckExistingInput,
  QuestionCreateInput,
  TagMeInput,
} from '@samagama/shared';
import { qnaService } from '../services/qna.service.js';
import { created, noContent, ok } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';

export const qnaController = {
  // Step 1 of the Ask flow: scan FAQs + existing questions for matches and return a
  // signed token proving the check ran (createQuestion requires it).
  async checkExisting(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const result = await qnaService.checkExisting(req.body as CheckExistingInput, req.user.id);
    return ok(res, result);
  },

  // Step 2 of the Ask flow: persist the new question (requires the check token from step 1).
  async createQuestion(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const question = await qnaService.createQuestion(req.body as QuestionCreateInput, req.user.id);
    return created(res, question);
  },

  // Register the current student's interest in an existing community question ("tag me").
  async tagMe(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const { existingAnswerCheckToken } = req.body as TagMeInput;
    await qnaService.tagMe(req.params.id!, req.user.id, existingAnswerCheckToken);
    return noContent(res);
  },

  // List questions, filtered by feed type, status, ownership, and idle-age buckets.
  async listQuestions(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const type = req.query.type as 'personal' | 'community' | undefined;
    const status = req.query.status as string | undefined;
    const mineOnly = req.query.mine === 'true';
    // Only accept the known idle-bucket values; anything else means "no idle filter".
    const idleParam = req.query.idle as string | undefined;
    const idle =
      idleParam === 'last24h' || idleParam === 'over3days' || idleParam === 'over1week'
        ? idleParam
        : undefined;
    const items = await qnaService.listQuestions({
      role: req.user.role,
      userId: req.user.id,
      type,
      status,
      mineOnly,
      idle,
    });
    return ok(res, items);
  },

  // Fetch a single question (access controlled by role/ownership in the service).
  async getQuestion(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const question = await qnaService.getQuestionById(req.params.id!, req.user.id, req.user.role);
    return ok(res, question);
  },

  // List the answers on a question (the service filters out pending answers for non-moderators).
  async listAnswers(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const items = await qnaService.listAnswers(req.params.id!, req.user.id, req.user.role);
    return ok(res, items);
  },

  // Submit a new answer to a question (enters the moderation queue as `pending`).
  async submitAnswer(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const answer = await qnaService.submitAnswer(
      req.params.id!,
      req.body as AnswerCreateInput,
      req.user.id,
    );
    return created(res, answer);
  },

  // Toggle an up/down vote on an answer. `allowPending` lets moderators vote on not-yet-approved answers.
  async voteAnswer(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    // Anything other than 'up' is treated as a downvote.
    const direction = req.params.direction === 'up' ? 'up' : 'down';
    const allowPending = req.query.allowPending === 'true';
    const result = await qnaService.voteAnswer(
      req.params.id!,
      req.user.id,
      direction,
      allowPending,
    );
    return ok(res, result);
  },
};
