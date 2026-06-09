// Tag CRUD HTTP layer. Thin pass-through to tagService.
import type { Request, Response } from 'express';
import type { TagCreateInput, TagUpdateInput } from '@samagama/shared';
import { hasAdminAccess } from '@samagama/shared';
import { tagService } from '../services/tag.service.js';
import { created, noContent, ok } from '../utils/api-response.js';

export const tagController = {
  // List tags. Admins can opt into seeing inactive ones via `?all=true`.
  async list(req: Request, res: Response) {
    const includeInactive =
      !!req.user && hasAdminAccess(req.user.role) && req.query.all === 'true';
    return ok(res, await tagService.list(includeInactive));
  },
  async create(req: Request, res: Response) {
    return created(res, await tagService.create(req.body as TagCreateInput));
  },
  async update(req: Request, res: Response) {
    return ok(res, await tagService.update(req.params.id!, req.body as TagUpdateInput));
  },
  async delete(req: Request, res: Response) {
    await tagService.delete(req.params.id!);
    return noContent(res);
  },
};
