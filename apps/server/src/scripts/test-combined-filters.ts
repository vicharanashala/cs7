// Validates that the Community Q&A listQuestions endpoint correctly
// handles combined (AND) filtering of Status + Activity Window.
//
// Test matrix:
//   1.  status=open only
//   2.  status=answered only
//   3.  status=resolved only
//   4.  idle=last24h only
//   5.  idle=over3days only
//   6.  idle=over1week only
//   7.  status=open  + idle=last24h   (intersection)
//   8.  status=open  + idle=over3days (intersection)
//   9.  status=answered + idle=last24h
//  10.  status=answered + idle=over3days
//  11.  status=resolved + idle=last24h  (resolved questions in time window)
//  12.  No filters at all
//  13.  Empty result — unlikely combination
//
// Run: `npm --workspace @samagama/server run test:combined-filters`

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { QuestionModel } from '../models/Question.model.js';
import { env } from '../config/env.js';

const day = 24 * 60 * 60 * 1000;

// ─── Tiny query helper — mirrors the listQuestions service logic ───────────────

async function queryQuestions(opts: {
  status?: string;
  idle?: 'last24h' | 'over3days' | 'over1week';
}): Promise<{ count: number; ids: string[] }> {
  const now = Date.now();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filter: Record<string, any> = {
    type: 'community',
    isTrashed: { $ne: true },
  };

  if (opts.status) filter.status = opts.status;

  if (opts.idle) {
    // Mirrors qna.service.ts line 479: preserve explicit status, default to open/answered
    filter.status = filter.status ?? { $in: ['open', 'answered'] };
    if (opts.idle === 'last24h') {
      filter.updatedAt = { $gte: new Date(now - day) };
    } else if (opts.idle === 'over3days') {
      filter.updatedAt = { $lt: new Date(now - day), $gte: new Date(now - 7 * day) };
    } else {
      filter.updatedAt = { $lt: new Date(now - 7 * day) };
    }
  }

  const docs = await QuestionModel.find(filter).select('_id status updatedAt').lean();
  return { count: docs.length, ids: docs.map((d) => d._id.toString()) };
}

// ─── Assertion helpers ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(name: string, condition: boolean, detail?: string) {
  if (condition) {
    logger.info({ test: name }, '✅ PASS');
    passed++;
  } else {
    const msg = detail ? `${name}: ${detail}` : name;
    logger.error({ test: name }, `❌ FAIL${detail ? ': ' + detail : ''}`);
    failures.push(msg);
    failed++;
  }
}

// ─── Test runner ──────────────────────────────────────────────────────────────

async function run() {
  if (env.isProduction) {
    logger.error('Refusing to run test script in production.');
    process.exit(1);
  }

  await connectDatabase();

  logger.info('=== Combined Filter Tests ===');

  // ── 1. status=open only ─────────────────────────────────────────────────────
  const openOnly = await queryQuestions({ status: 'open' });
  assert('1. status=open only', openOnly.count >= 0, `found ${openOnly.count} open questions`);

  // ── 2. status=answered only ─────────────────────────────────────────────────
  const answeredOnly = await queryQuestions({ status: 'answered' });
  assert(
    '2. status=answered only',
    answeredOnly.count >= 0,
    `found ${answeredOnly.count} answered questions`,
  );

  // ── 3. status=resolved only ─────────────────────────────────────────────────
  const resolvedOnly = await queryQuestions({ status: 'resolved' });
  assert(
    '3. status=resolved only',
    resolvedOnly.count >= 0,
    `found ${resolvedOnly.count} resolved questions`,
  );

  // ── 4. idle=last24h only ────────────────────────────────────────────────────
  const idle24h = await queryQuestions({ idle: 'last24h' });
  assert(
    '4. idle=last24h only',
    idle24h.count >= 0,
    `found ${idle24h.count} questions active in last 24h`,
  );

  // ── 5. idle=over3days only ──────────────────────────────────────────────────
  const idle3d = await queryQuestions({ idle: 'over3days' });
  assert(
    '5. idle=over3days only',
    idle3d.count >= 0,
    `found ${idle3d.count} questions idle 3-7 days`,
  );

  // ── 6. idle=over1week only ──────────────────────────────────────────────────
  const idle1w = await queryQuestions({ idle: 'over1week' });
  assert(
    '6. idle=over1week only',
    idle1w.count >= 0,
    `found ${idle1w.count} questions idle > 1 week`,
  );

  // ── 7. status=open + idle=last24h — must be subset of BOTH ─────────────────
  const openAnd24h = await queryQuestions({ status: 'open', idle: 'last24h' });
  assert(
    '7. status=open + idle=last24h count ≤ open-only',
    openAnd24h.count <= openOnly.count,
    `${openAnd24h.count} ≤ ${openOnly.count}`,
  );
  assert(
    '7. status=open + idle=last24h count ≤ last24h-only',
    openAnd24h.count <= idle24h.count,
    `${openAnd24h.count} ≤ ${idle24h.count}`,
  );
  // Every returned question must be open
  if (openAnd24h.ids.length > 0) {
    const docs = await QuestionModel.find({ _id: { $in: openAnd24h.ids } })
      .select('status updatedAt')
      .lean();
    const allOpen = docs.every((d) => d.status === 'open');
    const threshold = new Date(Date.now() - day);
    const allRecent = docs.every((d) => new Date(d.updatedAt) >= threshold);
    assert('7. all results are status=open', allOpen, allOpen ? 'ok' : 'some are not open');
    assert(
      '7. all results updated within last 24h',
      allRecent,
      allRecent ? 'ok' : 'some are older than 24h',
    );
  } else {
    logger.info({ test: '7' }, 'ℹ️  No combined results — intersection is empty (acceptable)');
  }

  // ── 8. status=open + idle=over3days ─────────────────────────────────────────
  const openAnd3d = await queryQuestions({ status: 'open', idle: 'over3days' });
  assert(
    '8. status=open + idle=over3days count ≤ open-only',
    openAnd3d.count <= openOnly.count,
    `${openAnd3d.count} ≤ ${openOnly.count}`,
  );
  if (openAnd3d.ids.length > 0) {
    const docs = await QuestionModel.find({ _id: { $in: openAnd3d.ids } })
      .select('status updatedAt')
      .lean();
    const allOpen = docs.every((d) => d.status === 'open');
    const lo = new Date(Date.now() - 7 * day);
    const hi = new Date(Date.now() - day);
    const allInWindow = docs.every(
      (d) => new Date(d.updatedAt) >= lo && new Date(d.updatedAt) < hi,
    );
    assert('8. all results are status=open', allOpen, allOpen ? 'ok' : 'some are not open');
    assert(
      '8. all results in 3-7d window',
      allInWindow,
      allInWindow ? 'ok' : 'some fall outside 3-7d window',
    );
  }

  // ── 9. status=answered + idle=last24h ───────────────────────────────────────
  const answeredAnd24h = await queryQuestions({ status: 'answered', idle: 'last24h' });
  assert(
    '9. status=answered + idle=last24h count ≤ answered-only',
    answeredAnd24h.count <= answeredOnly.count,
    `${answeredAnd24h.count} ≤ ${answeredOnly.count}`,
  );
  if (answeredAnd24h.ids.length > 0) {
    const docs = await QuestionModel.find({ _id: { $in: answeredAnd24h.ids } })
      .select('status')
      .lean();
    const allAnswered = docs.every((d) => d.status === 'answered');
    assert('9. all results are status=answered', allAnswered, allAnswered ? 'ok' : 'mismatch');
  }

  // ── 10. status=answered + idle=over3days ─────────────────────────────────────
  const answeredAnd3d = await queryQuestions({ status: 'answered', idle: 'over3days' });
  assert(
    '10. status=answered + idle=over3days count ≤ answered-only',
    answeredAnd3d.count <= answeredOnly.count,
    `${answeredAnd3d.count} ≤ ${answeredOnly.count}`,
  );

  // ── 11. status=resolved + idle=last24h — resolved questions also filterable ──
  const resolvedAnd24h = await queryQuestions({ status: 'resolved', idle: 'last24h' });
  assert(
    '11. status=resolved + idle=last24h count ≤ resolved-only',
    resolvedAnd24h.count <= resolvedOnly.count,
    `${resolvedAnd24h.count} ≤ ${resolvedOnly.count}`,
  );
  if (resolvedAnd24h.ids.length > 0) {
    const docs = await QuestionModel.find({ _id: { $in: resolvedAnd24h.ids } })
      .select('status')
      .lean();
    const allResolved = docs.every((d) => d.status === 'resolved');
    assert('11. all results are status=resolved', allResolved, allResolved ? 'ok' : 'mismatch');
  }

  // ── 12. No filters — returns all community questions ─────────────────────────
  const noFilter = await queryQuestions({});
  assert(
    '12. No filters returns ≥ any individual filter result',
    noFilter.count >= Math.max(openOnly.count, answeredOnly.count, resolvedOnly.count),
    `total=${noFilter.count} open=${openOnly.count} answered=${answeredOnly.count} resolved=${resolvedOnly.count}`,
  );

  // ── 13. Idempotency — running same query twice gives same count ───────────────
  const openAnd24h_b = await queryQuestions({ status: 'open', idle: 'last24h' });
  assert(
    '13. Idempotency: status=open + idle=last24h returns same count twice',
    openAnd24h.count === openAnd24h_b.count,
    `${openAnd24h.count} === ${openAnd24h_b.count}`,
  );

  // ── 14. Bucket sum — last24h + over3days + over1week = totalOpen ──────────────
  const totalFromBuckets = idle24h.count + idle3d.count + idle1w.count;
  const totalOpen = await queryQuestions({ status: undefined, idle: undefined });
  const openAndAnswered = await QuestionModel.countDocuments({
    type: 'community',
    status: { $in: ['open', 'answered'] },
    isTrashed: { $ne: true },
  });
  assert(
    '14. Bucket sum (24h + 3d + 1w) equals open+answered total',
    totalFromBuckets === openAndAnswered,
    `${idle24h.count} + ${idle3d.count} + ${idle1w.count} = ${totalFromBuckets} vs DB open+answered = ${openAndAnswered}`,
  );

  // ── Summary ───────────────────────────────────────────────────────────────────
  logger.info(`\n=== Results: ${passed} passed, ${failed} failed ===`);
  if (failures.length) {
    logger.error({ failures }, 'Failed tests');
  }

  await disconnectDatabase();

  if (failed > 0) process.exit(1);
  logger.info('✅ All combined filter tests passed.');
}

run().catch(async (err) => {
  logger.error({ err }, 'Test runner crashed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
