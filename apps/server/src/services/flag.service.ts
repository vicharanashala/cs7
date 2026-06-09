// Flag/report domain service.
//
// Behavior:
//  - createOrUpdate: idempotent per (user, entity). If the user already has an open or
//    under_review flag on this entity, we update the reason/details on it instead of inserting.
//    Resolved/dismissed flags don't block a fresh report.
//  - When a *new* open flag is created on an FAQ, we increment that FAQ's denormalized
//    `flagCount`. Updating an existing flag does NOT bump the counter.
//  - When a moderator resolves/dismisses an open flag on an FAQ, we DECREMENT `flagCount`
//    so the counter tracks live (open + under_review) flags only.
import { Types } from 'mongoose';
import type {
  FlagCreateInput,
  FlagListQuery,
  FlagUpdateStatusInput,
  PublicFlag,
} from '@samagama/shared';
import { FlagModel, type FlagDocument } from '../models/Flag.model.js';
import { FaqModel } from '../models/Faq.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { notificationService } from './notification.service.js';
import { UserModel } from '../models/User.model.js';
import { ApiError } from '../utils/api-error.js';

interface PopulatedFlag extends Omit<FlagDocument, 'reportedBy' | 'reviewedBy'> {
  reportedBy: { _id: Types.ObjectId; name: string };
  reviewedBy?: { _id: Types.ObjectId; name: string };
}

function isLive(status: string): boolean {
  return status === 'open' || status === 'under_review';
}

function projectFlag(flag: PopulatedFlag, entityTitle?: string): PublicFlag {
  return {
    id: flag._id.toString(),
    entityType: flag.entityType,
    entityId: flag.entityId.toString(),
    entityTitle,
    reason: flag.reason,
    details: flag.details ?? undefined,
    status: flag.status,
    reportedBy: { id: flag.reportedBy._id.toString(), name: flag.reportedBy.name },
    reviewedBy: flag.reviewedBy
      ? { id: flag.reviewedBy._id.toString(), name: flag.reviewedBy.name }
      : undefined,
    resolutionNote: flag.resolutionNote ?? undefined,
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
  };
}

/** Look up display titles for a batch of (entityType, entityId) pairs. */
async function fetchEntityTitles(flags: PopulatedFlag[]): Promise<Map<string, string>> {
  const faqIds: Types.ObjectId[] = [];
  const questionIds: Types.ObjectId[] = [];
  for (const f of flags) {
    if (f.entityType === 'faq') faqIds.push(f.entityId);
    else if (f.entityType === 'question') questionIds.push(f.entityId);
  }

  const [faqs, questions] = await Promise.all([
    faqIds.length
      ? FaqModel.find({ _id: { $in: faqIds } })
          .select('title')
          .lean()
      : Promise.resolve([]),
    questionIds.length
      ? QuestionModel.find({ _id: { $in: questionIds } })
          .select('title')
          .lean()
      : Promise.resolve([]),
  ]);

  const map = new Map<string, string>();
  for (const f of faqs) map.set(`faq:${f._id.toString()}`, f.title);
  for (const q of questions) map.set(`question:${q._id.toString()}`, q.title);
  return map;
}

export const flagService = {
  /**
   * Create or update the current user's flag on an entity. Returns the resulting flag.
   * Increments `flagCount` on the FAQ only when a NEW open/under_review row is inserted.
   */
  async createOrUpdate(input: FlagCreateInput, userId: string): Promise<PublicFlag> {
    const entityObjectId = new Types.ObjectId(input.entityId);
    const userObjectId = new Types.ObjectId(userId);

    // Validate the target exists. Avoids dangling flag rows.
    if (input.entityType === 'faq') {
      const exists = await FaqModel.exists({ _id: entityObjectId });
      if (!exists) throw ApiError.notFound('FAQ not found');
    } else if (input.entityType === 'question') {
      const exists = await QuestionModel.exists({ _id: entityObjectId });
      if (!exists) throw ApiError.notFound('Question not found');
    }

    // Look for an existing live flag from this user.
    const existing = await FlagModel.findOne({
      reportedBy: userObjectId,
      entityType: input.entityType,
      entityId: entityObjectId,
      status: { $in: ['open', 'under_review'] },
    });

    let flag: FlagDocument;
    if (existing) {
      existing.reason = input.reason;
      existing.details = input.details;
      await existing.save();
      flag = existing;
    } else {
      flag = await FlagModel.create({
        ...input,
        entityId: entityObjectId,
        reportedBy: userObjectId,
        status: 'open',
      });
      // New live flag — bump the denormalized counter.
      if (input.entityType === 'faq') {
        await FaqModel.updateOne({ _id: entityObjectId }, { $inc: { flagCount: 1 } });
      }
    }

    const populated = await FlagModel.findById(flag._id)
      .populate('reportedBy', 'name')
      .populate('reviewedBy', 'name')
      .lean<PopulatedFlag>();
    return projectFlag(populated!);
  },

  async list(query: FlagListQuery): Promise<PublicFlag[]> {
    const filter: Record<string, unknown> = {};
    if (query.entityType) filter.entityType = query.entityType;
    if (query.status) filter.status = query.status;

    const flags = await FlagModel.find(filter)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('reportedBy', 'name')
      .populate('reviewedBy', 'name')
      .lean<PopulatedFlag[]>();

    const titles = await fetchEntityTitles(flags);
    return flags.map((f) => projectFlag(f, titles.get(`${f.entityType}:${f.entityId.toString()}`)));
  },

  async updateStatus(
    flagId: string,
    moderatorId: string,
    input: FlagUpdateStatusInput,
  ): Promise<PublicFlag> {
    const flag = await FlagModel.findById(flagId);
    if (!flag) throw ApiError.notFound('Flag not found');

    const wasLive = isLive(flag.status);
    flag.status = input.status;
    flag.reviewedBy = new Types.ObjectId(moderatorId);
    if (input.resolutionNote) flag.resolutionNote = input.resolutionNote;
    await flag.save();

    // If we transitioned out of a live state on an FAQ, decrement the counter.
    if (wasLive && !isLive(input.status) && flag.entityType === 'faq') {
      await FaqModel.updateOne(
        { _id: flag.entityId, flagCount: { $gt: 0 } },
        { $inc: { flagCount: -1 } },
      );
    }

    // Award/deduct Spurti points to the reporter if the moderator specified a reward.
    const hasPointChange =
      typeof input.spurtiPoints === 'number' && input.spurtiPoints !== 0;
    if (hasPointChange) {
      await UserModel.updateOne(
        { _id: flag.reportedBy },
        { $inc: { spurtiPoints: input.spurtiPoints } },
      );
    }

    // Notify the reporter when the flag reaches a terminal state or points are awarded/deducted.
    const isTerminal = input.status === 'resolved' || input.status === 'dismissed';
    if (isTerminal || hasPointChange) {
      // Resolve entity title for the notification body.
      let entityTitle = 'the reported content';
      if (flag.entityType === 'faq') {
        const faq = await FaqModel.findById(flag.entityId)
          .select('title')
          .lean<{ title: string }>();
        if (faq?.title) entityTitle = faq.title;
      } else if (flag.entityType === 'question') {
        const question = await QuestionModel.findById(flag.entityId)
          .select('title')
          .lean<{ title: string }>();
        if (question?.title) entityTitle = question.title;
      }

      const contentLabel =
        flag.entityType === 'faq'
          ? 'FAQ'
          : flag.entityType === 'question'
            ? 'question'
            : 'content';

      let notifTitle: string;
      let notifBody: string;

      if (hasPointChange) {
        const pts = input.spurtiPoints!;
        const abs = Math.abs(pts);
        const ptLabel = abs === 1 ? 'Spurti Point' : 'Spurti Points';
        if (pts > 0) {
          notifTitle = `Your report earned you +${pts} ${ptLabel}!`;
          notifBody = `Your report on the ${contentLabel} "${entityTitle}" was reviewed. You earned +${pts} ${ptLabel}.`;
        } else {
          notifTitle = `${abs} ${ptLabel} deducted`;
          notifBody = `Your report on the ${contentLabel} "${entityTitle}" was reviewed. ${abs} ${ptLabel} were deducted.`;
        }
      } else if (input.status === 'resolved') {
        notifTitle = 'Your report was resolved';
        notifBody = `Your report on the ${contentLabel} "${entityTitle}" was reviewed and resolved.`;
      } else {
        notifTitle = 'Your report was dismissed';
        notifBody = `Your report on the ${contentLabel} "${entityTitle}" was reviewed and dismissed.`;
      }

      if (input.resolutionNote) {
        notifBody += ` Moderator note: "${input.resolutionNote}"`;
      }

      void notificationService.create({
        userId: flag.reportedBy.toString(),
        type: 'flag_reviewed',
        title: notifTitle,
        body: notifBody,
        relatedId:
          flag.entityType === 'question' ? flag.entityId.toString() : undefined,
      });
    }

    const populated = await FlagModel.findById(flag._id)
      .populate('reportedBy', 'name')
      .populate('reviewedBy', 'name')
      .lean<PopulatedFlag>();
    return projectFlag(populated!);
  },
};
