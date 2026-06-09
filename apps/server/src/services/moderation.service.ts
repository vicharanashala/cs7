// Moderator/admin actions on community answers and questions.
// Implements PRD §8.7 + Change Spec §5.5 (edit-and-approve).
import { Types } from 'mongoose';
import type { ModerateAnswerInput } from '@samagama/shared';
import { SPURTI_POINTS } from '@samagama/shared';
import { AnswerModel } from '../models/Answer.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { UserModel } from '../models/User.model.js';
import { ApiError } from '../utils/api-error.js';
import { generateEmbedding } from './embedding.service.js';
import { notificationService } from './notification.service.js';
export interface PendingAnswerRow {
  id: string;
  body: string;
  questionId: string;
  questionTitle: string;
  author: { id: string; name: string };
  taggedStudents: { id: string; name: string }[];
  upvoteCount: number;
  downvoteCount: number;
  createdAt: string;
}

interface PopulatedPending {
  _id: Types.ObjectId;
  body: string;
  questionId: {
    _id: Types.ObjectId;
    title: string;
    isTrashed: boolean;
    taggedStudents: { _id: Types.ObjectId; name: string }[];
  } | null;
  answeredBy: { _id: Types.ObjectId; name: string };
  upvoteCount: number;
  downvoteCount: number;
  createdAt: Date;
}

function projectPending(a: PopulatedPending): PendingAnswerRow {
  return {
    id: a._id.toString(),
    body: a.body,
    questionId: a.questionId?._id.toString() ?? '',
    questionTitle: a.questionId?.title ?? 'Deleted question',
    author: { id: a.answeredBy._id.toString(), name: a.answeredBy.name },
    taggedStudents: (a.questionId?.taggedStudents ?? []).map((s) => ({
      id: s._id.toString(),
      name: s.name,
    })),
    upvoteCount: a.upvoteCount ?? 0,
    downvoteCount: a.downvoteCount ?? 0,
    createdAt: a.createdAt.toISOString(),
  };
}

export const moderationService = {
  /**
   * Approve an answer. Optionally edit the body in the same call (Change Spec §5.5).
   * Side effect: when the FIRST answer on a question is approved, mark the question resolved.
   */
  async approveAnswer(
    answerId: string,
    moderatorId: string,
    input: ModerateAnswerInput = {},
  ): Promise<void> {
    const answer = await AnswerModel.findById(answerId);
    if (!answer) throw ApiError.notFound('Answer not found');
    if (answer.status === 'approved') return; // idempotent

    if (input.editedBody) answer.body = input.editedBody;
    answer.status = 'approved';
    answer.moderatorId = new Types.ObjectId(moderatorId);
    if (input.note) answer.moderationNote = input.note;
    answer.approvedAt = new Date();
    await answer.save();

    // Spurti Points: award the answer's author once on first approval.
    // Moderator chooses a value in [-1, 5]; falls back to the configured default.
    // Award is idempotent because we early-return above when already approved.
    const pts = input.spurtiPoints ?? SPURTI_POINTS.ANSWER_APPROVED_DEFAULT;
    await UserModel.updateOne({ _id: answer.answeredBy }, { $inc: { spurtiPoints: pts } });

    // Flip the question to resolved on the first approval and set visibility expiry.
    const question = await QuestionModel.findById(answer.questionId);
    if (question && question.status !== 'resolved') {
      question.status = 'resolved';
      question.resolvedAt = new Date();

      // visibilityDays: undefined → default 7 days; null → permanent (no expiry).
      const days = input.visibilityDays === undefined ? 7 : input.visibilityDays;
      if (days !== null) {
        question.visibilityExpiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      }
      await question.save();
    }

    // Notify the answer author (fire-and-forget — never block the approval response).
    const questionTitle = question?.title ?? 'a community question';
    const ptLabel = Math.abs(pts) === 1 ? 'Spurti Point' : 'Spurti Points';
    void notificationService.create({
      userId: answer.answeredBy.toString(),
      type: 'answer_approved',
      title: pts > 0 ? `Answer approved! +${pts} ${ptLabel}` : 'Your answer was approved!',
      body:
        pts > 0
          ? `Your answer to "${questionTitle}" was approved. You earned +${pts} ${ptLabel}!`
          : `Your answer to "${questionTitle}" has been approved by a moderator.`,
      relatedId: answer.questionId.toString(),
    });

    // Notify the question asker that their question has been resolved.
    // Skip if they are the same person as the answer author (no self-notification).
    if (question && question.askedBy.toString() !== answer.answeredBy.toString()) {
      void notificationService.create({
        userId: question.askedBy.toString(),
        type: 'question_answered',
        title: 'Your question has been resolved!',
        body: `A moderator approved an answer to your question: "${questionTitle}". View the resolved answer to see the full response.`,
        relatedId: answer.questionId.toString(),
      });
    }
  },

  async rejectAnswer(
    answerId: string,
    moderatorId: string,
    input: ModerateAnswerInput = {},
  ): Promise<void> {
    const answer = await AnswerModel.findById(answerId);
    if (!answer) throw ApiError.notFound('Answer not found');
    if (answer.status === 'rejected') return;

    answer.status = 'rejected';
    answer.moderatorId = new Types.ObjectId(moderatorId);
    if (input.note) answer.moderationNote = input.note;
    await answer.save();

    const question = await QuestionModel.findById(answer.questionId)
      .select('title')
      .lean<{ title: string }>();
    const questionTitle = question?.title ?? 'a community question';
    void notificationService.create({
      userId: answer.answeredBy.toString(),
      type: 'answer_rejected',
      title: 'Your answer was not approved',
      body: input.note
        ? `Your answer to "${questionTitle}" was not approved. Moderator note: ${input.note}`
        : `Your answer to "${questionTitle}" was not approved by the moderator.`,
      relatedId: answer.questionId.toString(),
    });
  },

  /** Cross-question pending queue (FIFO) used by the global Unresolved Questions screen. */
  async listPendingAnswers(): Promise<PendingAnswerRow[]> {
    const pending = await AnswerModel.find({ status: 'pending' })
      .sort({ createdAt: 1 })
      .populate('answeredBy', 'name')
      .populate({
        path: 'questionId',
        select: 'title taggedStudents isTrashed',
        populate: { path: 'taggedStudents', select: 'name' },
      })
      .lean<PopulatedPending[]>();
    return pending.filter((a) => a.questionId && !a.questionId.isTrashed).map(projectPending);
  },

  /**
   * Pending answers for a single question. Drives the per-card "Show More" cycle
   * (1 → +2 → all 10) on the moderator review surface.
   */
  async listPendingAnswersForQuestion(
    questionId: string,
    limit: number,
  ): Promise<PendingAnswerRow[]> {
    if (!Types.ObjectId.isValid(questionId)) throw ApiError.badRequest('Invalid question id');
    const safeLimit = Math.min(Math.max(limit, 1), 10);
    const pending = await AnswerModel.find({ questionId, status: 'pending' })
      .sort({ createdAt: 1 })
      .limit(safeLimit)
      .populate('answeredBy', 'name')
      .populate({
        path: 'questionId',
        select: 'title taggedStudents isTrashed',
        populate: { path: 'taggedStudents', select: 'name' },
      })
      .lean<PopulatedPending[]>();
    return pending.filter((a) => a.questionId && !a.questionId.isTrashed).map(projectPending);
  },

  /**
   * Moderator answers a personal question directly. Bypasses peer-answer moderation since
   * the moderator IS the authority. Stored as an Answer row with status='approved' so the
   * existing projection lights up `displayState: 'responded'` for the asker (Change Spec §5.3).
   */
  async respondToPersonalQuestion(
    questionId: string,
    moderatorId: string,
    body: string,
  ): Promise<void> {
    const question = await QuestionModel.findById(questionId);
    if (!question) throw ApiError.notFound('Question not found');

    const trimmed = body.trim();
    if (trimmed.length < 10) throw ApiError.badRequest('Response must be at least 10 characters');
    if (trimmed.length > 4000) throw ApiError.badRequest('Response is too long');

    await AnswerModel.create({
      questionId,
      body: trimmed,
      answeredBy: moderatorId,
      status: 'approved',
      moderatorId: new Types.ObjectId(moderatorId),
      approvedAt: new Date(),
    });

    question.answerCount += 1;
    // Personal questions are fully resolved by a moderator response.
    // Community questions stay 'answered' so peers can still contribute.
    question.status = question.type === 'personal' ? 'resolved' : 'answered';
    await question.save();

    // Notify the student that their question received a direct moderator response.
    void notificationService.create({
      userId: question.askedBy.toString(),
      type: 'question_answered',
      title:
        question.type === 'personal'
          ? 'A moderator answered your question!'
          : 'Your question received a new answer',
      body:
        question.type === 'personal'
          ? `A moderator replied to your personal question: "${question.title}". View the response in My Questions.`
          : `A moderator posted an answer to your community question: "${question.title}".`,
      relatedId: question._id.toString(),
    });
  },

  /** List approved answers eligible for FAQ conversion. */
  async listFaqCandidates(): Promise<FaqCandidateRow[]> {
    const candidates = await AnswerModel.find({
      status: 'approved',
      eligibleForFaqConversion: true,
      convertedFaqId: { $exists: false },
    })
      .sort({ approvedAt: -1 })
      .populate('answeredBy', 'name')
      .populate('moderatorId', 'name')
      .populate({
        path: 'questionId',
        select: 'title description category',
        populate: { path: 'category', select: 'name' },
      })
      .lean();

    return (candidates as unknown as PopulatedCandidate[]).map((c) => ({
      id: c._id.toString(),
      questionTitle: c.questionId?.title ?? 'Deleted question',
      questionDescription: c.questionId?.description ?? '',
      answerBody: c.body,
      category: c.questionId?.category?.name ?? '—',
      author: { id: c.answeredBy._id.toString(), name: c.answeredBy.name },
      moderator: c.moderatorId
        ? { id: c.moderatorId._id.toString(), name: c.moderatorId.name }
        : undefined,
      approvedAt: c.approvedAt?.toISOString() ?? c.createdAt.toISOString(),
    }));
  },

  /** Convert an approved answer to a new FAQ draft. Admin only. */
  async convertToFaq(answerId: string, actorId: string): Promise<{ faqId: string }> {
    const answer = await AnswerModel.findById(answerId).populate(
      'questionId',
      'title description category tags',
    );
    if (!answer) throw ApiError.notFound('Answer not found');
    if (answer.status !== 'approved')
      throw ApiError.badRequest('Only approved answers can be converted');
    if (answer.convertedFaqId)
      throw ApiError.conflict('This answer has already been converted to a FAQ');

    const question = answer.questionId as unknown as {
      _id: Types.ObjectId;
      title: string;
      description: string;
      category: Types.ObjectId;
      tags: Types.ObjectId[];
    };

    // Import dynamically to avoid circular deps
    const { FaqModel } = await import('../models/Faq.model.js');

    const faq = await FaqModel.create({
      title: question.title,
      answer: answer.body,
      summary: question.description.substring(0, 280),
      categories: question.category ? [question.category] : [],
      tags: question.tags ?? [],
      status: 'published',
      publishedAt: new Date(),
      sourceType: 'community_conversion',
      sourceQuestionId: question._id,
      createdBy: actorId,
      updatedBy: actorId,
    });

    // Generate and store RAG embedding so the FAQ is immediately searchable via semantic search
    void generateEmbedding(`${question.title} ${answer.body}`)
      .then((embedding) => faq.updateOne({ embedding }).exec())
      .catch(() => undefined);

    answer.convertedFaqId = faq._id as Types.ObjectId;
    await answer.save();

    return { faqId: faq._id.toString() };
  },

  /** Bulk approve multiple pending answers. */
  async bulkApprove(answerIds: string[], moderatorId: string): Promise<{ approved: number }> {
    let approved = 0;
    for (const id of answerIds) {
      try {
        await this.approveAnswer(id, moderatorId);
        approved++;
      } catch {
        // Skip invalid or already-processed answers
      }
    }
    return { approved };
  },

  /** Bulk reject multiple pending answers. */
  async bulkReject(
    answerIds: string[],
    moderatorId: string,
    note?: string,
  ): Promise<{ rejected: number }> {
    let rejected = 0;
    for (const id of answerIds) {
      try {
        await this.rejectAnswer(id, moderatorId, { note });
        rejected++;
      } catch {
        // Skip invalid or already-processed answers
      }
    }
    return { rejected };
  },

  /** Mark an approved answer as eligible for FAQ conversion. */
  async markForFaq(answerId: string): Promise<void> {
    const answer = await AnswerModel.findById(answerId);
    if (!answer) throw ApiError.notFound('Answer not found');
    if (answer.status !== 'approved')
      throw ApiError.badRequest('Only approved answers can be marked for FAQ');
    answer.eligibleForFaqConversion = true;
    await answer.save();
  },

  /** Return all trashed community questions with their approved answers. */
  async listTrashedQuestions(): Promise<TrashedQuestionRow[]> {
    const questions = await QuestionModel.find({ isTrashed: true, type: 'community' })
      .sort({ trashedAt: -1 })
      .populate('askedBy', 'name')
      .lean<
        Array<{
          _id: Types.ObjectId;
          title: string;
          description: string;
          askedBy: { _id: Types.ObjectId; name: string };
          answerCount: number;
          trashedAt?: Date;
          visibilityExpiresAt?: Date;
          createdAt: Date;
        }>
      >();

    if (questions.length === 0) return [];

    const questionIds = questions.map((q) => q._id);
    const answers = await AnswerModel.find({ questionId: { $in: questionIds }, status: 'approved' })
      .populate('answeredBy', 'name')
      .lean<
        Array<{
          _id: Types.ObjectId;
          questionId: Types.ObjectId;
          body: string;
          answeredBy: { _id: Types.ObjectId; name: string };
          upvoteCount: number;
          downvoteCount: number;
          createdAt: Date;
        }>
      >();

    const answersByQuestion = new Map<string, typeof answers>();
    for (const a of answers) {
      const key = a.questionId.toString();
      const list = answersByQuestion.get(key) ?? [];
      list.push(a);
      answersByQuestion.set(key, list);
    }

    return questions.map((q) => ({
      id: q._id.toString(),
      title: q.title,
      description: q.description,
      author: { id: q.askedBy._id.toString(), name: q.askedBy.name },
      answerCount: q.answerCount,
      trashedAt: q.trashedAt?.toISOString() ?? q.createdAt.toISOString(),
      visibilityExpiresAt: q.visibilityExpiresAt?.toISOString() ?? null,
      answers: (answersByQuestion.get(q._id.toString()) ?? []).map((a) => ({
        id: a._id.toString(),
        body: a.body,
        author: { id: a.answeredBy._id.toString(), name: a.answeredBy.name },
        upvoteCount: a.upvoteCount ?? 0,
        downvoteCount: a.downvoteCount ?? 0,
        createdAt: a.createdAt.toISOString(),
      })),
    }));
  },

  /** Restore a trashed question back to community visibility. */
  async restoreTrashedQuestion(questionId: string): Promise<void> {
    const question = await QuestionModel.findById(questionId);
    if (!question) throw ApiError.notFound('Question not found');
    if (!question.isTrashed) return; // idempotent
    question.isTrashed = false;
    question.trashedAt = undefined;
    // Keep visibilityExpiresAt so the original period is preserved but reset to now + 7d
    question.visibilityExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await question.save();
  },

  /**
   * Convert a community question directly to a FAQ draft.
   * The question is marked archived.
   * If removeAndConvert is true, the question is also archived before conversion.
   */
  async convertQuestionToFaq(
    questionId: string,
    actorId: string,
    opts: { removeAndConvert?: boolean; answerBody?: string } = {},
  ): Promise<{ faqId: string }> {
    const question = await QuestionModel.findById(questionId);
    if (!question) throw ApiError.notFound('Question not found');
    if (question.type !== 'community')
      throw ApiError.badRequest('Only community questions can be converted to FAQ');
    if (question.status === 'archived') throw ApiError.conflict('Question is already archived');

    const { FaqModel } = await import('../models/Faq.model.js');

    const faqAnswerBody = opts.answerBody ?? question.description;

    const faq = await FaqModel.create({
      title: question.title,
      answer: faqAnswerBody,
      summary: question.description.substring(0, 280),
      categories: question.category ? [question.category] : [],
      tags: question.tags ?? [],
      status: 'draft',
      sourceType: 'community_conversion',
      sourceQuestionId: question._id,
      createdBy: actorId,
      updatedBy: actorId,
    });

    if (opts.removeAndConvert) {
      question.status = 'archived';
      await question.save();
    }

    return { faqId: faq._id.toString() };
  },
};

// Internal types for populated candidates
interface PopulatedCandidate {
  _id: Types.ObjectId;
  body: string;
  questionId: {
    _id: Types.ObjectId;
    title: string;
    description: string;
    category?: { name: string };
  } | null;
  answeredBy: { _id: Types.ObjectId; name: string };
  moderatorId?: { _id: Types.ObjectId; name: string };
  approvedAt?: Date;
  createdAt: Date;
}

export interface FaqCandidateRow {
  id: string;
  questionTitle: string;
  questionDescription: string;
  answerBody: string;
  category: string;
  author: { id: string; name: string };
  moderator?: { id: string; name: string };
  approvedAt: string;
}

export interface TrashedQuestionRow {
  id: string;
  title: string;
  description: string;
  author: { id: string; name: string };
  answerCount: number;
  trashedAt: string;
  visibilityExpiresAt: string | null;
  answers: Array<{
    id: string;
    body: string;
    author: { id: string; name: string };
    upvoteCount: number;
    downvoteCount: number;
    createdAt: string;
  }>;
}
