// Top-level API router. Mounts every feature sub-router under its resource path
// (e.g. /auth, /faqs, /qna). New feature routes mount here. Also exposes /health.
import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { categoryRouter } from './category.routes.js';
import { tagRouter } from './tag.routes.js';
import { faqRouter } from './faq.routes.js';
import { qnaRouter } from './qna.routes.js';
import { moderationRouter } from './moderation.routes.js';
import { statsRouter } from './stats.routes.js';
import { flagRouter } from './flag.routes.js';
import { chatbotRouter } from './chatbot.routes.js';
import { userRouter } from './user.routes.js';
import { auditRouter } from './audit.routes.js';
import { settingsRouter } from './settings.routes.js';
import { adminRouter } from './admin.routes.js';
import { helpRouter } from './help.routes.js';
import { notificationRouter } from './notification.routes.js';

const router = Router();

// Liveness probe — unauthenticated; used by load balancers / uptime checks.
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

router.use('/auth', authRouter);
router.use('/categories', categoryRouter);
router.use('/tags', tagRouter);
router.use('/faqs', faqRouter);
router.use('/qna', qnaRouter);
router.use('/moderation', moderationRouter);
router.use('/stats', statsRouter);
router.use('/flags', flagRouter);
router.use('/chat', chatbotRouter);
router.use('/users', userRouter);
router.use('/audit-logs', auditRouter);
router.use('/settings', settingsRouter);
router.use('/admin', adminRouter);
router.use('/help-data', helpRouter);
router.use('/notifications', notificationRouter);

export const apiRouter = router;
