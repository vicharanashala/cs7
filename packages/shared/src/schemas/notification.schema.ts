// Notification contracts shared between client and server.
// Drives the in-app notification bell/feed.

/** Categories of in-app notification. Determines the icon and click-through target on the client. */
export type NotificationType =
  | 'answer_approved' // a moderator approved the user's answer
  | 'answer_rejected' // a moderator rejected the user's answer
  | 'question_answered' // someone answered a question the user asked or follows
  | 'flag_reviewed' // a flag the user raised was actioned
  | 'general'; // catch-all / system message

/** Notification as returned to the client for rendering in the notification feed. */
export interface PublicNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  /** Community question ID — used to navigate to the relevant page. */
  relatedId?: string;
  createdAt: string;
}
