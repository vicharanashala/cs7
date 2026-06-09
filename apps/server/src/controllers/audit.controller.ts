// Audit log controller — admin only.
import type { Request, Response } from 'express';
import { auditService, type AuditListQuery } from '../services/audit.service.js';
import { ok } from '../utils/api-response.js';

export const auditController = {
  // Paginated audit-log listing. Parses page/filter query params and returns
  // the page items alongside pagination meta (total + total pages).
  async list(req: Request, res: Response) {
    const query: AuditListQuery = {
      page: Number(req.query.page ?? 1),
      pageSize: Number(req.query.pageSize ?? 20),
      action: req.query.action as string | undefined,
      entityType: req.query.entityType as string | undefined,
      actorId: req.query.actorId as string | undefined,
    };
    const result = await auditService.list(query);
    return ok(res, result.items, {
      page: query.page,
      pageSize: query.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / query.pageSize),
    });
  },
};
