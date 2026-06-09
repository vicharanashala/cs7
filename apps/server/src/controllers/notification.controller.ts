// In-app notification HTTP layer. Every action is scoped to the authenticated user.
import type { Request, Response } from 'express';
import { notificationService } from '../services/notification.service.js';
import { ok, noContent } from '../utils/api-response.js';
import { ApiError } from '../utils/api-error.js';

export const notificationController = {
  // Newest-first notification feed for the current user.
  async list(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    return ok(res, await notificationService.listForUser(req.user.id));
  },

  // Unread badge count for the current user.
  async unreadCount(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    const count = await notificationService.getUnreadCount(req.user.id);
    return ok(res, { count });
  },

  // Mark a single notification read (no-op if it isn't the caller's).
  async markRead(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    await notificationService.markRead(req.params.id!, req.user.id);
    return noContent(res);
  },

  // Mark every notification for the current user read.
  async markAllRead(req: Request, res: Response) {
    if (!req.user) throw ApiError.unauthorized();
    await notificationService.markAllRead(req.user.id);
    return noContent(res);
  },
};
