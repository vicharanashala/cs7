// Seeds a realistic helpful/unhelpful ("upvote/downvote") distribution across
// published FAQs, with votes spread over different dates.
//
// Engagement model (reflects typical user behaviour):
//   - Most FAQs are net-positive: upvotes clearly outnumber downvotes
//     (helpful ratio ~70–97%).
//   - A small share (~15%) are "controversial": downvotes outnumber upvotes
//     (helpful ratio ~20–48%) — e.g. outdated or confusing answers.
//
// For each vote we write the two things the live `submitFeedback` path writes:
//   1. The FAQ doc's denormalized state — helpfulVotes/unhelpfulVotes arrays +
//      helpfulCount/unhelpfulCount (source of truth for ratio & quality score).
//   2. An AnalyticsEvent (faq_helpful / faq_unhelpful) with a dated `occurredAt`,
//      which powers the "votes trend" analytics chart.
//
// Dates run from shortly after each FAQ was created up to "now", biased toward
// the last 7 days so the trend chart (which only looks back 7 days) is populated.
//
// Idempotent: for every FAQ it touches, it first removes that FAQ's existing
// faq_helpful/faq_unhelpful analytics events and overwrites its vote arrays/counts,
// so re-running produces a clean distribution rather than compounding one.
//
// Run: npm --workspace @samagama/server run seed:faq-votes
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { FaqModel } from '../models/Faq.model.js';
import { UserModel } from '../models/User.model.js';
import { AnalyticsEventModel } from '../models/AnalyticsEvent.model.js';

// ── Tunables ────────────────────────────────────────────────────────────────
const CONTROVERSIAL_SHARE = 0.15; // fraction of FAQs where downvotes > upvotes
const POSITIVE_RATIO = { min: 0.7, max: 0.97 }; // helpful share for normal FAQs
const CONTROVERSIAL_RATIO = { min: 0.2, max: 0.48 }; // helpful share for controversial FAQs
const VOTERS = { min: 4, max: 32 }; // total voters per FAQ (capped by student pool)
const RECENT_BIAS = 0.4; // fraction of votes forced into the last 7 days
const RECENT_DAYS = 7;
const NOW = new Date(); // upper bound for vote dates

// ── Helpers ─────────────────────────────────────────────────────────────────
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

/**
 * Pick a vote date between `from` and NOW. With probability RECENT_BIAS the date
 * is forced into the last RECENT_DAYS so the 7-day trend chart has data, even for
 * FAQs created long ago. Time-of-day is constrained to waking hours (08:00–23:00).
 */
function pickVoteDate(from: Date): Date {
  const recentStart = NOW.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000;
  let lo = from.getTime();
  const hi = NOW.getTime();

  if (Math.random() < RECENT_BIAS) {
    // Bias toward the last week — but never before the FAQ existed.
    lo = Math.max(lo, recentStart);
  }
  if (lo >= hi) lo = hi - 60 * 60 * 1000; // guard: at least an hour of range

  const ts = randInt(lo, hi);
  const d = new Date(ts);
  d.setHours(randInt(8, 22), randInt(0, 59), randInt(0, 59), 0);
  // setHours may push past NOW for same-day picks — clamp back.
  return d.getTime() > hi ? new Date(hi) : d;
}

interface SeededFaq {
  _id: Types.ObjectId;
  createdAt: Date;
}

async function run(): Promise<void> {
  await connectDatabase();

  // Eligible voters: the seeded student pool.
  const students = await UserModel.find(
    { email: /@samagama\.test$/, role: 'student' },
    '_id',
  ).lean<{ _id: Types.ObjectId }[]>();

  if (students.length < 2) {
    logger.error(
      'Need at least 2 @samagama.test student accounts. Run seed:accounts + seed:student-accounts first.',
    );
    await disconnectDatabase();
    process.exit(1);
  }
  logger.info({ students: students.length }, 'Eligible student voters loaded');

  // Only published FAQs accept feedback in the live flow.
  const faqs = await FaqModel.find({ status: 'published' })
    .sort({ createdAt: 1 })
    .select('_id createdAt')
    .lean<SeededFaq[]>();

  if (faqs.length === 0) {
    logger.error('No published FAQs found. Run seed:faqs first.');
    await disconnectDatabase();
    process.exit(1);
  }
  logger.info({ faqs: faqs.length }, 'Published FAQs loaded');

  const maxVoters = Math.min(VOTERS.max, students.length);
  let totalUp = 0;
  let totalDown = 0;
  let controversialCount = 0;
  const analyticsDocs: {
    eventType: 'faq_helpful' | 'faq_unhelpful';
    userId: Types.ObjectId;
    entityType: 'faq';
    entityId: Types.ObjectId;
    occurredAt: Date;
  }[] = [];

  for (const faq of faqs) {
    const isControversial = Math.random() < CONTROVERSIAL_SHARE;
    const ratioRange = isControversial ? CONTROVERSIAL_RATIO : POSITIVE_RATIO;

    const totalVotes = randInt(VOTERS.min, maxVoters);
    let upvotes = Math.round(totalVotes * randFloat(ratioRange.min, ratioRange.max));
    // Enforce the intended majority and keep at least one of each side.
    if (isControversial) {
      upvotes = Math.min(upvotes, Math.floor((totalVotes - 1) / 2)); // downvotes strictly win
      controversialCount++;
    } else {
      upvotes = Math.max(upvotes, Math.ceil((totalVotes + 1) / 2)); // upvotes strictly win
    }
    upvotes = Math.max(1, Math.min(upvotes, totalVotes - 1));
    const downvotes = totalVotes - upvotes;

    // Distinct voters — guarantees the one-vote-per-user-per-FAQ rule.
    const voters = shuffle(students).slice(0, totalVotes);
    const helpfulVoters = voters.slice(0, upvotes).map((v) => v._id);
    const unhelpfulVoters = voters.slice(upvotes).map((v) => v._id);

    // The earliest a vote can occur: a little after the FAQ was created.
    const voteFrom = new Date(faq.createdAt.getTime() + 60 * 60 * 1000);

    for (const userId of helpfulVoters) {
      analyticsDocs.push({
        eventType: 'faq_helpful',
        userId,
        entityType: 'faq',
        entityId: faq._id,
        occurredAt: pickVoteDate(voteFrom),
      });
    }
    for (const userId of unhelpfulVoters) {
      analyticsDocs.push({
        eventType: 'faq_unhelpful',
        userId,
        entityType: 'faq',
        entityId: faq._id,
        occurredAt: pickVoteDate(voteFrom),
      });
    }

    // Overwrite the FAQ's denormalized vote state (idempotent re-seed).
    // timestamps: false — a vote must never change the FAQ's "last edited" time.
    await FaqModel.updateOne(
      { _id: faq._id },
      {
        $set: {
          helpfulVotes: helpfulVoters,
          unhelpfulVotes: unhelpfulVoters,
          helpfulCount: upvotes,
          unhelpfulCount: downvotes,
        },
      },
      { timestamps: false },
    );

    totalUp += upvotes;
    totalDown += downvotes;
  }

  // Replace prior FAQ-vote analytics so the trend chart doesn't double-count on re-runs.
  const faqIds = faqs.map((f) => f._id);
  const { deletedCount } = await AnalyticsEventModel.deleteMany({
    eventType: { $in: ['faq_helpful', 'faq_unhelpful'] },
    entityType: 'faq',
    entityId: { $in: faqIds },
  });
  await AnalyticsEventModel.insertMany(analyticsDocs);
  logger.info(
    { removed: deletedCount, inserted: analyticsDocs.length },
    'FAQ-vote analytics events refreshed',
  );

  // Recompute quality scores — helpfulness ratio feeds the composite score.
  for (const faq of faqs) {
    await FaqModel.calculateQualityScore(faq._id.toString());
  }
  logger.info({ faqs: faqs.length }, 'Quality scores recomputed');

  logger.info(
    {
      faqs: faqs.length,
      controversial: controversialCount,
      controversialPct: `${Math.round((controversialCount / faqs.length) * 100)}%`,
      totalUpvotes: totalUp,
      totalDownvotes: totalDown,
      overallRatio: `${Math.round((totalUp / (totalUp + totalDown)) * 100)}% helpful`,
    },
    '✅ FAQ vote seeding complete',
  );

  await disconnectDatabase();
}

run().catch(async (err) => {
  logger.error({ err }, 'FAQ vote seeding failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
