// /api/notifications — the authenticated user's in-app notification feed. Auth required for all routes.
import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller.js';
import { requireAuth } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.use(requireAuth);

router.get('/', asyncHandler(notificationController.list));
router.get('/unread-count', asyncHandler(notificationController.unreadCount));
// read-all is declared before /:id/read so the literal path isn't captured by the :id param.
router.patch('/read-all', asyncHandler(notificationController.markAllRead));
router.patch('/:id/read', asyncHandler(notificationController.markRead));

export const notificationRouter = router;
