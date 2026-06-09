// Category CRUD HTTP layer. Thin pass-through to categoryService.
import type { Request, Response } from 'express';
import type { CategoryCreateInput, CategoryUpdateInput } from '@samagama/shared';
import { hasAdminAccess } from '@samagama/shared';
import { categoryService } from '../services/category.service.js';
import { created, noContent, ok } from '../utils/api-response.js';

export const categoryController = {
  // List categories. Admins can opt into seeing inactive ones via `?all=true`.
  async list(req: Request, res: Response) {
    const includeInactive =
      !!req.user && hasAdminAccess(req.user.role) && req.query.all === 'true';
    return ok(res, await categoryService.list(includeInactive));
  },
  async create(req: Request, res: Response) {
    return created(res, await categoryService.create(req.body as CategoryCreateInput));
  },
  async update(req: Request, res: Response) {
    return ok(res, await categoryService.update(req.params.id!, req.body as CategoryUpdateInput));
  },
  async delete(req: Request, res: Response) {
    await categoryService.delete(req.params.id!);
    return noContent(res);
  },
};
