// Back-fills createdAt / updatedAt on FAQs to spread them across 5 weekly
// cohorts, matching the commit history the team expects:
//
//  First 25  → Week 4 of April  (Apr 21–27, 2026)
//  Next  25  → Week 1 of May    (Apr 28 – May 4, 2026)
//  Next  25  → Week 2 of May    (May 5–11, 2026)
//  Next  25  → Week 3 of May    (May 12–18, 2026)
//  Remaining → Last week of May (May 19–30, 2026)
//
// All timestamps are random within each window, constrained to 09:00–18:00,
// and guaranteed to be unique (1-second granularity minimum separation).
//
// Run: npm --workspace @samagama/server run seed:faq-timestamps
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { FaqModel } from '../models/Faq.model.js';

interface Window {
  start: Date;
  end: Date;
}

const WINDOWS: Window[] = [
  { start: new Date('2026-04-21T09:00:00+05:30'), end: new Date('2026-04-27T18:00:00+05:30') },
  { start: new Date('2026-04-28T09:00:00+05:30'), end: new Date('2026-05-04T18:00:00+05:30') },
  { start: new Date('2026-05-05T09:00:00+05:30'), end: new Date('2026-05-11T18:00:00+05:30') },
  { start: new Date('2026-05-12T09:00:00+05:30'), end: new Date('2026-05-18T18:00:00+05:30') },
  { start: new Date('2026-05-19T09:00:00+05:30'), end: new Date('2026-05-30T18:00:00+05:30') },
];

const BATCH_SIZES = [25, 25, 25, 25]; // Last window takes the remainder.

function randomTimestampInWindow(win: Window, usedMs: Set<number>): Date {
  const lo = win.start.getTime();
  const hi = win.end.getTime();
  const workdayMs = 9 * 60 * 60 * 1000; // 09:00 to 18:00 = 9 hours

  for (let attempt = 0; attempt < 500; attempt++) {
    // Pick a random day within the window.
    const daySpan = Math.floor((hi - lo) / (24 * 60 * 60 * 1000));
    const dayOffset = Math.floor(Math.random() * (daySpan + 1));
    const dayStart = new Date(lo + dayOffset * 24 * 60 * 60 * 1000);
    dayStart.setHours(9, 0, 0, 0);

    // Pick a random second within 09:00–18:00.
    const secOffset = Math.floor((Math.random() * workdayMs) / 1000) * 1000;
    const candidate = dayStart.getTime() + secOffset;

    if (!usedMs.has(candidate)) {
      usedMs.add(candidate);
      return new Date(candidate);
    }
  }

  // Fallback: just nudge the last used timestamp by 1 second.
  const last = Math.max(...usedMs);
  const fallback = last + 1000;
  usedMs.add(fallback);
  return new Date(fallback);
}

async function run() {
  await connectDatabase();

  // Fetch all FAQs sorted by their current createdAt so ordering is deterministic.
  const faqs = await FaqModel.find({}).sort({ createdAt: 1 }).select('_id').lean();
  logger.info({ total: faqs.length }, 'FAQs found');

  const usedMs = new Set<number>();
  let offset = 0;

  for (let wi = 0; wi < WINDOWS.length; wi++) {
    const win = WINDOWS[wi];
    const size = wi < BATCH_SIZES.length ? BATCH_SIZES[wi] : faqs.length - offset;
    const batch = faqs.slice(offset, offset + size);
    offset += size;

    for (const faq of batch) {
      const ts = randomTimestampInWindow(win, usedMs);
      // Use updateOne with { timestamps: false } workaround: bypass mongoose timestamps
      // by writing directly to the fields.
      await FaqModel.collection.updateOne(
        { _id: faq._id },
        { $set: { createdAt: ts, updatedAt: ts } },
      );
    }

    logger.info(
      {
        window: wi + 1,
        count: batch.length,
        from: win.start.toDateString(),
        to: win.end.toDateString(),
      },
      'Window updated',
    );
  }

  await disconnectDatabase();
  logger.info('✅ FAQ timestamp backfill complete.');
}

run().catch(async (err) => {
  logger.error({ err }, 'Backfill failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
