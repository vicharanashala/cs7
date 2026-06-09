// In-app notification service. CRUD for the per-user notification feed.
// Other services call `create()` to emit a notification (e.g. when an answer is approved);
// the rest are read/mark operations backing the notification bell UI.
import { Types } from 'mongoose';
import type { PublicNotification, NotificationType } from '@samagama/shared';
import { NotificationModel } from '../models/Notification.model.js';

export const notificationService = {
  // Emit a new notification for a user. Called by other services when something
  // noteworthy happens to the user's content (answer approved/rejected, etc.).
  async create(opts: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    relatedId?: string;
  }): Promise<void> {
    await NotificationModel.create({
      userId: new Types.ObjectId(opts.userId),
      type: opts.type,
      title: opts.title,
      body: opts.body,
      relatedId: opts.relatedId,
    });
  },

  // Newest-first feed for a user, capped at `limit`, mapped to the public DTO shape.
  async listForUser(userId: string, limit = 30): Promise<PublicNotification[]> {
    const docs = await NotificationModel.find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean<
        Array<{
          _id: Types.ObjectId;
          type: NotificationType;
          title: string;
          body: string;
          read: boolean;
          relatedId?: string;
          createdAt: Date;
        }>
      >();

    return docs.map((d) => ({
      id: d._id.toString(),
      type: d.type,
      title: d.title,
      body: d.body,
      read: d.read,
      relatedId: d.relatedId ?? undefined,
      createdAt: d.createdAt.toISOString(),
    }));
  },

  // Count of unread notifications — drives the bell badge.
  async getUnreadCount(userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      read: false,
    });
  },

  // Mark one notification read. The userId in the filter ensures a user can only mark their own.
  async markRead(notificationId: string, userId: string): Promise<void> {
    await NotificationModel.updateOne(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
      { $set: { read: true } },
    );
  },

  // Mark every unread notification for a user as read ("mark all read" button).
  async markAllRead(userId: string): Promise<void> {
    await NotificationModel.updateMany(
      { userId: new Types.ObjectId(userId), read: false },
      { $set: { read: true } },
    );
  },
};
