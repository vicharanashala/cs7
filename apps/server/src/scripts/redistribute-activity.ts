// Redistributes content-creation dates and engagement across a believable timeline so
// dashboards, analytics, trends, leaderboards and voting metrics reflect activity that
// accrued over weeks rather than everything landing in a single import second.
//
// ── What this script does ─────────────────────────────────────────────────────
//
// FAQs (122) — "25-per-week" cohorts, oldest → newest by current createdAt:
//   First 25 → 1st week of May  (May  1– 7, 2026)
//   Next  25 → 2nd week of May  (May  8–14)
//   Next  25 → 3rd week of May  (May 15–21)
//   Next  25 → 4th week of May  (May 22–28)
//   Remainder→ 1st week of June (Jun  1– 7)
//   • Each FAQ's helpful/unhelpful votes are rebuilt with a natural long-tail of
//     engagement (a few popular FAQs, many modest, a controversial minority), voted
//     by random distinct students on dates strictly AFTER the FAQ was created.
//   • faq_helpful / faq_unhelpful AnalyticsEvents are rebuilt to match (powers the
//     votes-trend chart); faq_viewed events are re-dated to fall after each FAQ.
//   • qualityScore is recomputed from the rebuilt votes.
//
// Community questions (34) + Personal questions (18) — spread randomly across the
//   period from the 1st week of June until "now", and re-attributed to random student
//   accounts (askedBy).
//
// Answers (323) — creation dates DERIVED from their parent question (shortly after,
//   capped at now) so an answer never predates its question; orphan answers (whose
//   question was deleted) get a random June date. Community answers are re-attributed
//   to random distinct students per question (≠ the asker, satisfying the one-answer-
//   per-user-per-question rule). Mod/admin-authored personal answers keep their author.
//   • Only APPROVED answers carry up/down votes (the live flow forbids voting on
//     unapproved answers); voters are random distinct students ≠ the author, on dates
//     after the answer. Non-approved answers have their vote state reset to zero.
//
// Spurti Points are recomputed for every student from the rebuilt data using the
//   documented reward rules (100 initial + 5 per approved answer + 5 per upvote
//   received) so the leaderboard reflects the new engagement.
//
// NOTE: The Question schema has no vote fields — only Answers are votable — so
//   "question upvotes/downvotes" are represented through their answers' engagement.
//
// Idempotent-ish: re-running re-randomises everything cleanly (FAQ-vote analytics are
//   deleted and re-inserted; vote arrays/counts are overwritten, not accumulated).
//
// Run: npm --workspace @samagama/server run seed:redistribute
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { FaqModel } from '../models/Faq.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { AnswerModel } from '../models/Answer.model.js';
import { UserModel } from '../models/User.model.js';
import { AnalyticsEventModel } from '../models/AnalyticsEvent.model.js';
import { SPURTI_POINTS } from '@samagama/shared';

// ── Time windows (IST, +05:30) ────────────────────────────────────────────────
const NOW = new Date();

interface Window {
  start: Date;
  end: Date;
}

// FAQ weekly cohorts.
const FAQ_WINDOWS: Window[] = [
  { start: new Date('2026-05-01T08:00:00+05:30'), end: new Date('2026-05-07T20:00:00+05:30') },
  { start: new Date('2026-05-08T08:00:00+05:30'), end: new Date('2026-05-14T20:00:00+05:30') },
  { start: new Date('2026-05-15T08:00:00+05:30'), end: new Date('2026-05-21T20:00:00+05:30') },
  { start: new Date('2026-05-22T08:00:00+05:30'), end: new Date('2026-05-28T20:00:00+05:30') },
  { start: new Date('2026-06-01T08:00:00+05:30'), end: NOW },
];
const FAQ_BATCH_SIZES = [25, 25, 25, 25]; // last window takes the remainder

// Community / personal questions + answers: 1st week of June until now.
const JUNE_START = new Date('2026-06-01T08:00:00+05:30');

// ── Vote engagement tunables ──────────────────────────────────────────────────
const FAQ_CONTROVERSIAL_SHARE = 0.15; // FAQs where downvotes outnumber upvotes
const FAQ_POSITIVE_RATIO = { min: 0.7, max: 0.97 };
const FAQ_CONTROVERSIAL_RATIO = { min: 0.2, max: 0.48 };
const ANSWER_CONTROVERSIAL_SHARE = 0.2;
const ANSWER_POSITIVE_RATIO = { min: 0.65, max: 0.95 };
const ANSWER_CONTROVERSIAL_RATIO = { min: 0.15, max: 0.45 };
const RECENT_BIAS = 0.4; // fraction of votes forced into the last 7 days (trend chart)
const RECENT_DAYS = 7;

// ── Small helpers ─────────────────────────────────────────────────────────────
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Random timestamp within a window: a random day, biased to daytime hours, unique to 1s. */
function randContentDate(win: Window, used: Set<number>): Date {
  const lo = win.start.getTime();
  const hi = win.end.getTime();
  for (let attempt = 0; attempt < 800; attempt++) {
    const daySpan = Math.max(0, Math.floor((hi - lo) / 86_400_000));
    const dayOffset = randInt(0, daySpan);
    const day = new Date(lo + dayOffset * 86_400_000);
    // Daytime hour 08:00–20:00 with random minute/second.
    day.setHours(randInt(8, 20), randInt(0, 59), randInt(0, 59), 0);
    let ms = day.getTime();
    if (ms < lo) ms = lo + randInt(0, 3_600_000);
    if (ms > hi) ms = hi - randInt(0, 3_600_000); // clamp same-day picks past "now"
    ms = Math.floor(ms / 1000) * 1000;
    if (!used.has(ms) && ms >= lo && ms <= hi) {
      used.add(ms);
      return new Date(ms);
    }
  }
  const fallback = (used.size ? Math.max(...used) : lo) + 1000;
  used.add(fallback);
  return new Date(Math.min(fallback, hi));
}

/** A vote/engagement date after `from`, up to NOW, biased toward the last 7 days. */
function pickEngagementDate(from: Date): Date {
  const recentStart = NOW.getTime() - RECENT_DAYS * 86_400_000;
  const hi = NOW.getTime();
  const floor = Math.min(from.getTime(), hi); // never before the content existed
  let lo = floor;
  if (Math.random() < RECENT_BIAS) lo = Math.max(lo, recentStart);
  if (lo >= hi) lo = Math.max(floor, hi - 3_600_000); // guarantee a little range
  const d = new Date(randInt(lo, hi));
  d.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);
  // setHours can shuffle the time earlier than the floor — clamp back into range.
  const t = Math.min(Math.max(d.getTime(), floor), hi);
  return new Date(t);
}

/** Long-tail engagement size: many modest, a few viral, scaled by how long content existed. */
function engagementCount(createdAt: Date, poolSize: number): number {
  const ageDays = Math.max(0, (NOW.getTime() - createdAt.getTime()) / 86_400_000);
  const ageFactor = Math.min(1, 0.3 + ageDays / 25); // older content accrues more
  const roll = Math.random();
  let base: number;
  if (roll < 0.12) base = randInt(0, 3); // quiet
  else if (roll < 0.8) base = randInt(4, 16); // typical
  else base = randInt(17, 32); // popular / viral
  return Math.max(0, Math.min(poolSize, Math.round(base * ageFactor)));
}

// ── Phase 1: FAQ creation dates ─────────────────────────────────────────────
interface FaqLite {
  _id: Types.ObjectId;
  createdAt: Date;
}

async function redistributeFaqDates(): Promise<FaqLite[]> {
  const faqs = await FaqModel.find({}).sort({ createdAt: 1 }).select('_id').lean<FaqLite[]>();
  const used = new Set<number>();
  const result: FaqLite[] = [];
  let offset = 0;

  for (let wi = 0; wi < FAQ_WINDOWS.length; wi++) {
    const win = FAQ_WINDOWS[wi];
    const size = wi < FAQ_BATCH_SIZES.length ? FAQ_BATCH_SIZES[wi] : faqs.length - offset;
    const batch = faqs.slice(offset, offset + size);
    offset += size;
    for (const faq of batch) {
      const ts = randContentDate(win, used);
      await FaqModel.collection.updateOne(
        { _id: faq._id },
        { $set: { createdAt: ts, updatedAt: ts, publishedAt: ts } },
      );
      result.push({ _id: faq._id, createdAt: ts });
    }
    logger.info(
      { window: wi + 1, count: batch.length, from: win.start.toDateString(), to: win.end.toDateString() },
      'FAQ dates: window updated',
    );
  }
  return result;
}

// ── Phase 2: FAQ votes + analytics ──────────────────────────────────────────
async function rebuildFaqVotes(faqs: FaqLite[], studentIds: Types.ObjectId[]): Promise<void> {
  const pool = studentIds.length;
  let totalUp = 0;
  let totalDown = 0;
  let controversial = 0;
  const analyticsDocs: Record<string, unknown>[] = [];
  const faqById = new Map(faqs.map((f) => [f._id.toString(), f.createdAt]));

  for (const faq of faqs) {
    const isControversial = Math.random() < FAQ_CONTROVERSIAL_SHARE;
    const ratioRange = isControversial ? FAQ_CONTROVERSIAL_RATIO : FAQ_POSITIVE_RATIO;
    const total = engagementCount(faq.createdAt, pool);

    if (total === 0) {
      await FaqModel.updateOne(
        { _id: faq._id },
        { $set: { helpfulVotes: [], unhelpfulVotes: [], helpfulCount: 0, unhelpfulCount: 0 } },
        { timestamps: false },
      );
      continue;
    }

    let up = Math.round(total * randFloat(ratioRange.min, ratioRange.max));
    if (total >= 2) {
      if (isControversial) {
        up = Math.min(up, Math.floor((total - 1) / 2));
        controversial++;
      } else {
        up = Math.max(up, Math.ceil((total + 1) / 2));
      }
      up = Math.max(1, Math.min(up, total - 1));
    } else {
      up = Math.random() < 0.85 ? total : 0; // single vote: usually helpful
    }
    const down = total - up;

    const voters = shuffle(studentIds).slice(0, total);
    const helpful = voters.slice(0, up);
    const unhelpful = voters.slice(up);
    const voteFrom = new Date(faq.createdAt.getTime() + 60 * 60 * 1000);

    for (const userId of helpful) {
      analyticsDocs.push({
        eventType: 'faq_helpful',
        userId,
        entityType: 'faq',
        entityId: faq._id,
        occurredAt: pickEngagementDate(voteFrom),
      });
    }
    for (const userId of unhelpful) {
      analyticsDocs.push({
        eventType: 'faq_unhelpful',
        userId,
        entityType: 'faq',
        entityId: faq._id,
        occurredAt: pickEngagementDate(voteFrom),
      });
    }

    await FaqModel.updateOne(
      { _id: faq._id },
      {
        $set: {
          helpfulVotes: helpful,
          unhelpfulVotes: unhelpful,
          helpfulCount: up,
          unhelpfulCount: down,
        },
      },
      { timestamps: false },
    );
    totalUp += up;
    totalDown += down;
  }

  const faqIds = faqs.map((f) => f._id);
  const { deletedCount } = await AnalyticsEventModel.deleteMany({
    eventType: { $in: ['faq_helpful', 'faq_unhelpful'] },
    entityType: 'faq',
    entityId: { $in: faqIds },
  });
  await AnalyticsEventModel.insertMany(analyticsDocs);

  // Re-date faq_viewed events so views fall after the FAQ's new creation date.
  const viewEvents = await AnalyticsEventModel.find({ eventType: 'faq_viewed', entityType: 'faq' })
    .select('_id entityId')
    .lean<{ _id: Types.ObjectId; entityId: Types.ObjectId }[]>();
  let reDatedViews = 0;
  for (const ev of viewEvents) {
    const createdAt = faqById.get(ev.entityId?.toString() ?? '');
    if (!createdAt) continue;
    const occurredAt = pickEngagementDate(new Date(createdAt.getTime() + 30 * 60 * 1000));
    await AnalyticsEventModel.updateOne({ _id: ev._id }, { $set: { occurredAt } });
    reDatedViews++;
  }

  for (const faq of faqs) await FaqModel.calculateQualityScore(faq._id.toString());

  logger.info(
    {
      faqs: faqs.length,
      controversial,
      totalUp,
      totalDown,
      ratio: `${Math.round((totalUp / Math.max(1, totalUp + totalDown)) * 100)}% helpful`,
      analyticsRemoved: deletedCount,
      analyticsInserted: analyticsDocs.length,
      viewEventsReDated: reDatedViews,
    },
    'FAQ votes rebuilt + quality scores recomputed',
  );
}

// ── Phase 3: questions (dates + random askedBy) ─────────────────────────────
interface QuestionLite {
  _id: Types.ObjectId;
  type: string;
  createdAt: Date;
}

async function redistributeQuestions(
  studentIds: Types.ObjectId[],
): Promise<Map<string, { createdAt: Date; askedBy: Types.ObjectId }>> {
  const meta = new Map<string, { createdAt: Date; askedBy: Types.ObjectId }>();
  const used = new Set<number>();
  const juneWindow: Window = { start: JUNE_START, end: NOW };

  for (const type of ['community', 'personal'] as const) {
    const questions = await QuestionModel.find({ type }).select('_id').lean<{ _id: Types.ObjectId }[]>();
    for (const q of questions) {
      const createdAt = randContentDate(juneWindow, used);
      const askedBy = studentIds[randInt(0, studentIds.length - 1)];
      await QuestionModel.collection.updateOne(
        { _id: q._id },
        { $set: { createdAt, updatedAt: createdAt, askedBy } },
      );
      meta.set(q._id.toString(), { createdAt, askedBy });
    }
    logger.info({ type, count: questions.length }, 'Questions re-dated + re-attributed');
  }
  return meta;
}

// ── Phase 4: answers (dates derived from parent, random authors, votes) ─────
async function redistributeAnswers(
  qMeta: Map<string, { createdAt: Date; askedBy: Types.ObjectId }>,
  studentIds: Types.ObjectId[],
): Promise<void> {
  // All answers, grouped by their question.
  const answers = await AnswerModel.find({})
    .select('_id questionId answeredBy status')
    .lean<{ _id: Types.ObjectId; questionId: Types.ObjectId; answeredBy: Types.ObjectId; status: string }[]>();

  // Which questions are community (eligible for student re-attribution)?
  const communityIds = new Set(
    (await QuestionModel.find({ type: 'community' }).select('_id').lean<{ _id: Types.ObjectId }[]>()).map(
      (q) => q._id.toString(),
    ),
  );

  // Pre-pass: park every answer on a fresh unique placeholder author. The
  // {questionId, answeredBy} unique index is checked per-write, so reassigning
  // authors sequentially can otherwise transiently collide with an answer in the
  // same question that still holds the author we're about to assign. Parking on
  // throwaway ObjectIds first removes every original value from the collision space.
  await AnswerModel.bulkWrite(
    answers.map((a) => ({
      updateOne: { filter: { _id: a._id }, update: { $set: { answeredBy: new Types.ObjectId() } } },
    })),
    { ordered: false },
  );

  const byQuestion = new Map<string, typeof answers>();
  const orphans: typeof answers = [];
  for (const a of answers) {
    const qid = a.questionId?.toString();
    if (qid && qMeta.has(qid)) {
      if (!byQuestion.has(qid)) byQuestion.set(qid, []);
      byQuestion.get(qid)!.push(a);
    } else {
      orphans.push(a);
    }
  }

  const used = new Set<number>();
  let reAttributed = 0;
  let votedAnswers = 0;
  let totalUp = 0;
  let totalDown = 0;
  // upvotes received per (student) author of approved answers — feeds Spurti Points.
  const upvotesByAuthor = new Map<string, number>();
  const approvedByAuthor = new Map<string, number>();

  async function applyAnswer(
    a: (typeof answers)[number],
    createdAt: Date,
    author: Types.ObjectId,
  ): Promise<void> {
    const set: Record<string, unknown> = { createdAt, updatedAt: createdAt, answeredBy: author };

    if (a.status === 'approved') {
      // Voters: random distinct students who are not the author.
      const pool = studentIds.filter((s) => !s.equals(author));
      const total = Math.min(pool.length, engagementCount(createdAt, pool.length));
      const isControversial = Math.random() < ANSWER_CONTROVERSIAL_SHARE;
      const ratioRange = isControversial ? ANSWER_CONTROVERSIAL_RATIO : ANSWER_POSITIVE_RATIO;
      let up = total === 0 ? 0 : Math.round(total * randFloat(ratioRange.min, ratioRange.max));
      if (total >= 2) {
        up = isControversial
          ? Math.min(up, Math.floor((total - 1) / 2))
          : Math.max(up, Math.ceil((total + 1) / 2));
        up = Math.max(0, Math.min(up, total));
      }
      const down = total - up;
      const voters = shuffle(pool).slice(0, total);
      set.upvotes = voters.slice(0, up);
      set.downvotes = voters.slice(up);
      set.upvoteCount = up;
      set.downvoteCount = down;
      totalUp += up;
      totalDown += down;
      if (total > 0) votedAnswers++;
      upvotesByAuthor.set(author.toString(), (upvotesByAuthor.get(author.toString()) ?? 0) + up);
      approvedByAuthor.set(author.toString(), (approvedByAuthor.get(author.toString()) ?? 0) + 1);
    } else {
      // Non-approved answers can't be voted in the live flow — reset to zero.
      set.upvotes = [];
      set.downvotes = [];
      set.upvoteCount = 0;
      set.downvoteCount = 0;
    }

    await AnswerModel.collection.updateOne({ _id: a._id }, { $set: set });
  }

  for (const [qid, group] of byQuestion) {
    const { createdAt: qDate, askedBy } = qMeta.get(qid)!;
    const isCommunity = communityIds.has(qid);
    // Distinct authors for this question's answers (community → students ≠ asker).
    const authorPool = isCommunity
      ? shuffle(studentIds.filter((s) => !s.equals(askedBy)))
      : [];
    let authorIdx = 0;

    for (const a of group) {
      // Answer date: shortly after the question, within 30 min … 2 days, capped at NOW.
      const maxOffset = Math.min(2 * 86_400_000, NOW.getTime() - qDate.getTime());
      const offset = maxOffset <= 30 * 60 * 1000 ? Math.max(0, maxOffset) : randInt(30 * 60 * 1000, maxOffset);
      let ms = Math.floor((qDate.getTime() + offset) / 1000) * 1000;
      while (used.has(ms)) ms += 1000;
      ms = Math.min(ms, NOW.getTime());
      used.add(ms);

      let author = a.answeredBy;
      if (isCommunity && authorPool.length > 0) {
        author = authorPool[authorIdx % authorPool.length];
        authorIdx++;
        reAttributed++;
      }
      await applyAnswer(a, new Date(ms), author);
    }
  }

  // Orphan answers: random June date, keep their author.
  const juneWindow: Window = { start: JUNE_START, end: NOW };
  for (const a of orphans) {
    await applyAnswer(a, randContentDate(juneWindow, used), a.answeredBy);
  }

  logger.info(
    {
      totalAnswers: answers.length,
      orphans: orphans.length,
      reAttributedToStudents: reAttributed,
      approvedAnswersVoted: votedAnswers,
      totalUp,
      totalDown,
    },
    'Answers re-dated + re-attributed + votes rebuilt',
  );

  return recomputeSpurtiPoints(studentIds, approvedByAuthor, upvotesByAuthor);
}

// ── Phase 5: recompute Spurti Points for the leaderboard ────────────────────
async function recomputeSpurtiPoints(
  studentIds: Types.ObjectId[],
  approvedByAuthor: Map<string, number>,
  upvotesByAuthor: Map<string, number>,
): Promise<void> {
  let updated = 0;
  for (const id of studentIds) {
    const key = id.toString();
    const approved = approvedByAuthor.get(key) ?? 0;
    const upvotes = upvotesByAuthor.get(key) ?? 0;
    const points =
      SPURTI_POINTS.INITIAL_BALANCE +
      approved * SPURTI_POINTS.ANSWER_APPROVED_DEFAULT +
      upvotes * SPURTI_POINTS.ANSWER_UPVOTED;
    await UserModel.updateOne({ _id: id }, { $set: { spurtiPoints: points } });
    updated++;
  }
  logger.info({ students: updated }, 'Spurti Points recomputed (leaderboard refreshed)');
}

// ── Orchestration ─────────────────────────────────────────────────────────────
async function run(): Promise<void> {
  if (env.isProduction) {
    logger.error('Refusing to redistribute data in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  const students = await UserModel.find({ role: 'student' }).select('_id').lean<{ _id: Types.ObjectId }[]>();
  if (students.length < 2) {
    logger.error('Need at least 2 student accounts. Run the account seeders first.');
    await disconnectDatabase();
    process.exit(1);
  }
  const studentIds = students.map((s) => s._id);
  logger.info({ students: studentIds.length, now: NOW.toISOString() }, 'Starting redistribution');

  const faqs = await redistributeFaqDates();
  await rebuildFaqVotes(faqs, studentIds);

  const qMeta = await redistributeQuestions(studentIds);
  await redistributeAnswers(qMeta, studentIds);

  await disconnectDatabase();
  logger.info('✅ Activity redistribution complete.');
}

run().catch(async (err) => {
  logger.error({ err }, 'Redistribution failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
