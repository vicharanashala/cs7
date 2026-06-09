// Removes all data owned by or linked to @samagama.test accounts — the accounts
// created by seed-real-accounts.ts and seed-student-accounts.ts, plus every
// downstream record those users generated through other seed/simulate scripts.
//
// Deletion order respects references so the database stays consistent:
//   Flags → ReviewItems → Notifications → AnalyticsEvents → AuditLogs →
//   SearchLogs → FeedbackEvents → ChatFeedback → Answers → Questions → Users
//
// Safe to re-run: all deletes are idempotent.
// Refuses to run when NODE_ENV=production.
//
// Run via: npm run seed:cleanup  (from apps/server)
//       or: npm --workspace @samagama/server run seed:cleanup  (from repo root)

import type { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AnalyticsEventModel } from '../models/AnalyticsEvent.model.js';
import { AnswerModel } from '../models/Answer.model.js';
import { AuditLogModel } from '../models/AuditLog.model.js';
import { ChatFeedbackModel } from '../models/ChatFeedback.model.js';
import { FeedbackEventModel } from '../models/FeedbackEvent.model.js';
import { FlagModel } from '../models/Flag.model.js';
import { NotificationModel } from '../models/Notification.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { ReviewItemModel } from '../models/ReviewItem.model.js';
import { SearchLogModel } from '../models/SearchLog.model.js';
import { UserModel } from '../models/User.model.js';

async function cleanup(): Promise<void> {
  if (env.isProduction) {
    logger.error('Refusing to run seed cleanup in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  // ── Phase 1: Identify seeded users ──────────────────────────────────────────
  // All accounts seeded by seed-real-accounts.ts and seed-student-accounts.ts
  // use @samagama.test addresses, a domain that cannot belong to real users.
  const seededUsers = await UserModel.find({ email: /@samagama\.test$/ }, '_id email').lean<
    { _id: Types.ObjectId; email: string }[]
  >();

  if (seededUsers.length === 0) {
    logger.info('No @samagama.test accounts found — nothing to clean up.');
    await disconnectDatabase();
    return;
  }

  const seededIds = seededUsers.map((u) => u._id);
  logger.info({ count: seededIds.length }, 'Seeded accounts located');

  // ── Phase 2: Collect content IDs owned by seeded users ──────────────────────
  const seededQuestions = await QuestionModel.find({ askedBy: { $in: seededIds } }, '_id').lean<
    { _id: Types.ObjectId }[]
  >();
  const seededQuestionIds = seededQuestions.map((q) => q._id);

  // Answers submitted by seeded users OR answers on their questions
  const seededAnswers = await AnswerModel.find(
    {
      $or: [{ answeredBy: { $in: seededIds } }, { questionId: { $in: seededQuestionIds } }],
    },
    '_id',
  ).lean<{ _id: Types.ObjectId }[]>();
  const seededAnswerIds = seededAnswers.map((a) => a._id);

  logger.info(
    { questions: seededQuestionIds.length, answers: seededAnswerIds.length },
    'Downstream content IDs collected',
  );

  // ── Phase 3: Delete referencing documents (most-dependent first) ─────────────

  // Flags: reported by seeded users, or placed on their questions/answers
  const { deletedCount: flags } = await FlagModel.deleteMany({
    $or: [
      { reportedBy: { $in: seededIds } },
      { entityId: { $in: [...seededQuestionIds, ...seededAnswerIds] } },
    ],
  });
  logger.info({ deleted: flags }, 'Flags');

  // ReviewItems: assigned/resolved by seeded users, or on their content
  const { deletedCount: reviews } = await ReviewItemModel.deleteMany({
    $or: [
      { assignedTo: { $in: seededIds } },
      { resolvedBy: { $in: seededIds } },
      { entityId: { $in: [...seededQuestionIds, ...seededAnswerIds] } },
    ],
  });
  logger.info({ deleted: reviews }, 'Review items');

  // Notifications: delivered to seeded users
  const { deletedCount: notifs } = await NotificationModel.deleteMany({
    userId: { $in: seededIds },
  });
  logger.info({ deleted: notifs }, 'Notifications');

  // AnalyticsEvents: fired by seeded users or referencing their content
  const { deletedCount: analytics } = await AnalyticsEventModel.deleteMany({
    $or: [
      { userId: { $in: seededIds } },
      { entityId: { $in: [...seededQuestionIds, ...seededAnswerIds] } },
    ],
  });
  logger.info({ deleted: analytics }, 'Analytics events');

  // AuditLogs: actions performed by seeded users
  const { deletedCount: audits } = await AuditLogModel.deleteMany({
    actorId: { $in: seededIds },
  });
  logger.info({ deleted: audits }, 'Audit logs');

  // SearchLogs: searches run by seeded users
  const { deletedCount: searches } = await SearchLogModel.deleteMany({
    userId: { $in: seededIds },
  });
  logger.info({ deleted: searches }, 'Search logs');

  // FeedbackEvents: helpful/unhelpful votes cast by seeded users
  const { deletedCount: feedbackEvents } = await FeedbackEventModel.deleteMany({
    userId: { $in: seededIds },
  });
  logger.info({ deleted: feedbackEvents }, 'Feedback events');

  // ChatFeedback: Yaksha chatbot ratings by seeded users
  const { deletedCount: chatFeedback } = await ChatFeedbackModel.deleteMany({
    userId: { $in: seededIds },
  });
  logger.info({ deleted: chatFeedback }, 'Chat feedback');

  // ── Phase 4: Delete owned content ───────────────────────────────────────────

  const { deletedCount: answers } = await AnswerModel.deleteMany({
    _id: { $in: seededAnswerIds },
  });
  logger.info({ deleted: answers }, 'Answers');

  const { deletedCount: questions } = await QuestionModel.deleteMany({
    _id: { $in: seededQuestionIds },
  });
  logger.info({ deleted: questions }, 'Questions');

  // ── Phase 5: Delete the users themselves ────────────────────────────────────
  const { deletedCount: users } = await UserModel.deleteMany({
    email: /@samagama\.test$/,
  });
  logger.info({ deleted: users }, 'Users');

  logger.info(
    {
      summary: {
        users,
        questions,
        answers,
        flags,
        reviews,
        notifs,
        analytics,
        audits,
        searches,
        feedbackEvents,
        chatFeedback,
      },
    },
    '✅ Seed cleanup complete',
  );

  await disconnectDatabase();
}

cleanup().catch(async (err) => {
  logger.error({ err }, 'Seed cleanup failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
