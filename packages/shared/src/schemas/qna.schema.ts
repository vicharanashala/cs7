// Community Q&A contracts. Reflects Change Spec §6 (multi-step Ask flow + personal/community type).
import { z } from 'zod';
import {
  ANSWER_STATUSES,
  PERSONAL_QUESTION_DISPLAY_STATES,
  QUESTION_STATUSES,
  QUESTION_TYPES,
} from '../enums.js';
import { objectIdSchema } from './common.schema.js';

export const checkExistingSchema = z.object({
  title: z.string().trim().min(8).max(280),
  description: z.string().trim().min(1).max(4000).optional().default(''),
  category: objectIdSchema.optional(),
});

export const questionCreateSchema = z.object({
  title: z.string().trim().min(8).max(280),
  description: z.string().trim().min(1).max(4000),
  category: objectIdSchema,
  tags: z.array(objectIdSchema).default([]),
  type: z.enum(QUESTION_TYPES).default('community'),
  /** URL or base64 data-URL of an attached screenshot. Accepts both https:// and data: schemes. */
  screenshotUrl: z.string().min(1).optional(),
  /** Token returned by checkExisting; required so server can confirm duplicate-check ran. */
  existingAnswerCheckToken: z.string().optional(),
});

export const answerCreateSchema = z.object({
  body: z.string().trim().min(10).max(4000),
});

export const tagMeSchema = z.object({
  existingAnswerCheckToken: z.string().min(1),
});

export const moderateAnswerSchema = z.object({
  /** Optional moderator note (used for rejections, audit log). */
  note: z.string().trim().max(1000).optional(),
  /** If provided, replaces answer body before approving (Change Spec §5.5 edit-and-approve). */
  editedBody: z.string().trim().min(10).max(4000).optional(),
  /** Spurti Points to award on approval. Range -1 to 5; defaults to 5. */
  spurtiPoints: z.number().int().min(-1).max(5).optional(),
  /**
   * How many days the resolved community post remains visible before being trashed.
   * null = permanent. Omit to use the server default (7 days).
   * Valid explicit values: 2 | 3 | 7.
   */
  visibilityDays: z.union([z.literal(2), z.literal(3), z.literal(7), z.null()]).optional(),
});

export type CheckExistingInput = z.infer<typeof checkExistingSchema>;
export type QuestionCreateInput = z.infer<typeof questionCreateSchema>;
export type AnswerCreateInput = z.infer<typeof answerCreateSchema>;
export type TagMeInput = z.infer<typeof tagMeSchema>;
export type ModerateAnswerInput = z.infer<typeof moderateAnswerSchema>;

// ----------------------------------------------------------------------------
// Public response shapes — what the API returns to clients.
// ----------------------------------------------------------------------------

export interface PublicAuthor {
  id: string;
  name: string;
  /** Present on answers; absent on questions (asker is always a student). */
  role?: string;
}

export interface PublicAnswer {
  id: string;
  body: string;
  status: (typeof ANSWER_STATUSES)[number];
  author: PublicAuthor;
  upvoteCount: number;
  downvoteCount: number;
  /** Set on the requester only — has the requesting student already voted on this answer? */
  myVote?: 'up' | 'down' | null;
  moderationNote?: string;
  approvedAt?: string;
  /** True when this approved answer has already been promoted to an FAQ entry. */
  isFaqConverted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicQuestion {
  id: string;
  title: string;
  description: string;
  type: (typeof QUESTION_TYPES)[number];
  status: (typeof QUESTION_STATUSES)[number];
  category: { id: string; name: string; slug: string } | null;
  tags: { id: string; name: string; slug: string }[];
  author: PublicAuthor;
  screenshotUrl?: string;
  answerCount: number;
  viewCount: number;
  /** Only populated by the personal-question feed for the asker. Derived from `moderatorViewedAt` + answerCount. */
  displayState?: (typeof PERSONAL_QUESTION_DISPLAY_STATES)[number];
  /** ISO timestamp when the community post expires from public view. null = permanent. */
  visibilityExpiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExistingAnswerCheckResult {
  /** Signed token proving the check was performed. Required by POST /questions. */
  token: string;
  matchedFaqs: PublicFaqMatch[];
  matchedQuestions: PublicQuestionMatch[];
}

export interface PublicFaqMatch {
  id: string;
  title: string;
  summary?: string;
  answer: string;
  score: number;
}

export interface PublicQuestionMatch {
  id: string;
  title: string;
  description: string;
  answerCount: number;
  score: number;
}
