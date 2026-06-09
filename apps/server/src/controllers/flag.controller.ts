// Content-flagging HTTP layer. Students raise flags; moderators triage them.
import type { Request, Response } from 'express';
import type { FlagCreateInput, FlagListQuery, FlagUpdateStatusInput } from '@samagama/shared';
import { flagService } from '../services/flag.service.js';
import { created, ok } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';

export const flagController = {
  // Raise a flag, or amend the caller's existing open flag on the same entity (upsert).
  async create(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const flag = await flagService.createOrUpdate(req.body as FlagCreateInput, req.user.id);
    return created(res, flag);
  },

  // Moderator: list/triage flags, filtered by the query params.
  async list(req: Request, res: Response) {
    return ok(res, await flagService.list(req.query as unknown as FlagListQuery));
  },

  // Moderator: advance a flag's review status (under_review/resolved/dismissed).
  async updateStatus(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const flag = await flagService.updateStatus(
      req.params.id!,
      req.user.id,
      req.body as FlagUpdateStatusInput,
    );
    return ok(res, flag);
  },
};
