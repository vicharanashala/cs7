// String-literal enums consumed by both client and server.
// Each list is the single source of truth used by Mongoose schemas, Zod validators, and UI badges.

/**
 * Access tiers, ordered low→high privilege. The "t-" prefixed roles are temporary
 * trainee variants: while assigned, a t-moderator has the FULL access of a moderator and
 * a t-admin has the FULL access of an admin. The trainee role is a temporary identity that
 * fully shadows the user's original (e.g. student) account until it is reverted.
 */
export const USER_ROLES = ['student', 't-moderator', 'moderator', 't-admin', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Collapses a temporary trainee role to the role it impersonates, so all
 * routing/authorization/feature-gating treats a trainee exactly like the real thing:
 *   t-moderator → moderator, t-admin → admin. Every other role maps to itself.
 *
 * Use this for the CURRENT user's own capabilities — never to relabel other users in
 * admin views, where the real trainee role must remain visible.
 */
export function effectiveRole(role: UserRole): UserRole {
  if (role === 't-moderator') return 'moderator';
  if (role === 't-admin') return 'admin';
  return role;
}

/** True for any role with moderator-level access (moderator/t-moderator and admin/t-admin). */
export function hasModeratorAccess(role: UserRole): boolean {
  const r = effectiveRole(role);
  return r === 'moderator' || r === 'admin';
}

/** True for any role with admin-level access (admin and t-admin). */
export function hasAdminAccess(role: UserRole): boolean {
  return effectiveRole(role) === 'admin';
}

/** Account lifecycle states. Only `active` users can authenticate. */
export const USER_STATUSES = ['active', 'suspended', 'deleted'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Publication lifecycle for an FAQ entry. Only `published` entries are shown to students. */
export const FAQ_STATUSES = ['draft', 'published', 'outdated'] as const;
export type FaqStatus = (typeof FAQ_STATUSES)[number];

/** Lifecycle of a community/personal question. */
export const QUESTION_STATUSES = ['open', 'answered', 'resolved', 'duplicate', 'archived'] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

/** Personal questions go to moderators privately; community questions are public (Change Spec §5.2). */
export const QUESTION_TYPES = ['personal', 'community'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Moderation outcome for a student-submitted answer. `pending` answers are hidden from the public feed. */
export const ANSWER_STATUSES = ['pending', 'approved', 'rejected', 'needs_changes'] as const;
export type AnswerStatus = (typeof ANSWER_STATUSES)[number];

/** Why a user flagged a piece of content. */
export const FLAG_REASONS = ['incorrect', 'outdated', 'duplicate', 'unclear', 'other'] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

/** Review lifecycle of a raised flag. */
export const FLAG_STATUSES = ['open', 'under_review', 'resolved', 'dismissed'] as const;
export type FlagStatus = (typeof FLAG_STATUSES)[number];

/** Kinds of content that can be flagged. */
export const FLAG_ENTITY_TYPES = ['faq', 'question', 'answer', 'chatbot_response'] as const;
export type FlagEntityType = (typeof FLAG_ENTITY_TYPES)[number];

/** Thumbs-up / thumbs-down rating a user can give a chatbot answer. */
export const CHAT_FEEDBACK_RATINGS = ['helpful', 'incorrect'] as const;
export type ChatFeedbackRating = (typeof CHAT_FEEDBACK_RATINGS)[number];

/** Derived "WhatsApp-style" status states for personal questions in My Questions (Change Spec §5.3). */
export const PERSONAL_QUESTION_DISPLAY_STATES = ['posted', 'seen', 'responded'] as const;
export type PersonalQuestionDisplayState = (typeof PERSONAL_QUESTION_DISPLAY_STATES)[number];
