// User administration service — list, role change, suspend/activate, delete.
// Business rules:
//   - Only admins can call these.
//   - System admins (role='admin') are fully protected and cannot be modified.
//   - Role changes apply an automatic password reset for cross-boundary promotions.
//   - Suspension prevents new logins but preserves content.
//   - An admin cannot modify their own account.
//   - Only student accounts can be permanently deleted (with cascade).
import bcrypt from 'bcryptjs';
import type { UserListQuery, PublicUserAdmin, UserRole } from '@samagama/shared';
import { UserModel } from '../models/User.model.js';
import { AnswerModel } from '../models/Answer.model.js';
import { AnalyticsEventModel } from '../models/AnalyticsEvent.model.js';
import { AuditLogModel } from '../models/AuditLog.model.js';
import { ChatFeedbackModel } from '../models/ChatFeedback.model.js';
import { FeedbackEventModel } from '../models/FeedbackEvent.model.js';
import { FlagModel } from '../models/Flag.model.js';
import { NotificationModel } from '../models/Notification.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { ReviewItemModel } from '../models/ReviewItem.model.js';
import { SearchLogModel } from '../models/SearchLog.model.js';
import { ApiError } from '../utils/api-error.js';
import { auditService } from './audit.service.js';

type FilterQuery = Record<string, unknown>;

// Passwords automatically applied when a role boundary is crossed.
const ROLE_RESET_PASSWORDS: Partial<Record<UserRole, string>> = {
  student: 'Student@2026',
  't-moderator': 'Moderator@2026',
  moderator: 'Moderator@2026',
  't-admin': 'Admin@2026',
};

function toPublicUserAdmin(user: {
  _id: { toString(): string };
  name: string;
  email: string;
  role: string;
  status: string;
  spurtiPoints?: number;
  createdAt: Date;
  updatedAt: Date;
}): PublicUserAdmin {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role as PublicUserAdmin['role'],
    status: user.status as PublicUserAdmin['status'],
    ...(user.role === 'student' ? { spurtiPoints: user.spurtiPoints ?? 0 } : {}),
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export const userService = {
  // Paginated, filterable admin user list (by role/status + a name/email search).
  async list(query: UserListQuery): Promise<{ items: PublicUserAdmin[]; total: number }> {
    const filter: FilterQuery = {};
    if (query.role) filter.role = query.role;
    if (query.status) filter.status = query.status;
    if (query.q) {
      // Escape regex metacharacters so the search term is treated literally (case-insensitive).
      const re = new RegExp(query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }];
    }

    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      UserModel.find(filter)
        .select('name email role status spurtiPoints createdAt updatedAt')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.pageSize)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    return {
      items: items.map((u) => toPublicUserAdmin(u as Parameters<typeof toPublicUserAdmin>[0])),
      total,
    };
  },

  // Change a user's role. Guards self-edits and protected admin accounts, resets the
  // password on cross-boundary promotions, and records the change in the audit log.
  async changeRole(userId: string, newRole: UserRole, actorId: string): Promise<PublicUserAdmin> {
    if (userId === actorId) throw ApiError.badRequest('You cannot change your own role');

    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    if (user.role === 'admin') throw ApiError.forbidden('System admin accounts cannot be modified');

    const previousRole = user.role as UserRole;
    if (previousRole === newRole)
      return toPublicUserAdmin(user as Parameters<typeof toPublicUserAdmin>[0]);

    user.role = newRole;

    // Reset password whenever crossing a role boundary so credentials stay consistent.
    const resetPassword = ROLE_RESET_PASSWORDS[newRole];
    if (resetPassword) {
      user.passwordHash = await bcrypt.hash(resetPassword, 12);
      user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    }

    await user.save();

    await auditService.log({
      actorId,
      action: 'role_change',
      entityType: 'user',
      entityId: userId,
      before: { role: previousRole },
      after: { role: newRole },
    });

    return toPublicUserAdmin(user as Parameters<typeof toPublicUserAdmin>[0]);
  },

  // Suspend a user (blocks login, preserves their content). Idempotent if already suspended.
  async suspendUser(userId: string, actorId: string): Promise<PublicUserAdmin> {
    if (userId === actorId) throw ApiError.badRequest('You cannot suspend yourself');

    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.role === 'admin')
      throw ApiError.forbidden('System admin accounts cannot be suspended');
    if (user.status === 'suspended')
      return toPublicUserAdmin(user as Parameters<typeof toPublicUserAdmin>[0]);

    const previousStatus = user.status;
    user.status = 'suspended';
    await user.save();

    await auditService.log({
      actorId,
      action: 'user_suspend',
      entityType: 'user',
      entityId: userId,
      before: { status: previousStatus },
      after: { status: 'suspended' },
    });

    return toPublicUserAdmin(user as Parameters<typeof toPublicUserAdmin>[0]);
  },

  // Reactivate a suspended user. Idempotent if already active.
  async activateUser(userId: string, actorId: string): Promise<PublicUserAdmin> {
    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.status === 'active')
      return toPublicUserAdmin(user as Parameters<typeof toPublicUserAdmin>[0]);

    const previousStatus = user.status;
    user.status = 'active';
    await user.save();

    await auditService.log({
      actorId,
      action: 'user_activate',
      entityType: 'user',
      entityId: userId,
      before: { status: previousStatus },
      after: { status: 'active' },
    });

    return toPublicUserAdmin(user as Parameters<typeof toPublicUserAdmin>[0]);
  },

  // Permanently delete a STUDENT account and cascade-remove everything tied to it
  // (their questions/answers, plus flags, reviews, notifications, analytics, logs, and
  // feedback referencing the user or that content). Non-students/admins are protected.
  async deleteUser(userId: string, actorId: string): Promise<void> {
    if (userId === actorId) throw ApiError.badRequest('You cannot delete yourself');

    const user = await UserModel.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.role === 'admin') throw ApiError.forbidden('System admin accounts cannot be deleted');
    if (user.role !== 'student')
      throw ApiError.forbidden('Only student accounts can be permanently deleted');

    const userObjId = user._id;

    // Collect owned content IDs for cascade deletion.
    const ownedQuestions = await QuestionModel.find({ askedBy: userObjId }, '_id').lean<
      { _id: unknown }[]
    >();
    const questionIds = ownedQuestions.map((q) => q._id);

    const ownedAnswers = await AnswerModel.find(
      { $or: [{ answeredBy: userObjId }, { questionId: { $in: questionIds } }] },
      '_id',
    ).lean<{ _id: unknown }[]>();
    const answerIds = ownedAnswers.map((a) => a._id);

    const contentIds = [...questionIds, ...answerIds];

    await FlagModel.deleteMany({
      $or: [{ reportedBy: userObjId }, { entityId: { $in: contentIds } }],
    });
    await ReviewItemModel.deleteMany({
      $or: [
        { assignedTo: userObjId },
        { resolvedBy: userObjId },
        { entityId: { $in: contentIds } },
      ],
    });
    await NotificationModel.deleteMany({ userId: userObjId });
    await AnalyticsEventModel.deleteMany({
      $or: [{ userId: userObjId }, { entityId: { $in: contentIds } }],
    });
    await AuditLogModel.deleteMany({ actorId: userObjId });
    await SearchLogModel.deleteMany({ userId: userObjId });
    await FeedbackEventModel.deleteMany({ userId: userObjId });
    await ChatFeedbackModel.deleteMany({ userId: userObjId });
    await AnswerModel.deleteMany({ _id: { $in: answerIds } });
    await QuestionModel.deleteMany({ _id: { $in: questionIds } });
    await UserModel.deleteOne({ _id: userObjId });

    await auditService.log({
      actorId,
      action: 'user_delete',
      entityType: 'user',
      entityId: userId,
    });
  },
};
