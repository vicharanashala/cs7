// Seed a small set of chatbot feedback rows so the moderator dashboard renders something
// before the real chatbot ships in Phase 6. Idempotent: keys on (userId + query) so re-runs
// do not duplicate rows.
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { ChatFeedbackModel } from '../models/ChatFeedback.model.js';
import { UserModel } from '../models/User.model.js';
import { env } from '../config/env.js';

interface SeedRow {
  query: string;
  answer: string;
  rating: 'helpful' | 'incorrect';
  comment?: string;
}

const SEEDS: SeedRow[] = [
  {
    query: 'When will I get my NOC?',
    answer:
      'Your NOC can be downloaded from Documents > NOC Certificate within 7 working days of your internship end date.',
    rating: 'helpful',
  },
  {
    query: 'How do I mark attendance for remote work?',
    answer: 'Use the Remote Attendance button under Attendance > Mark Today before 10:00 AM IST.',
    rating: 'helpful',
  },
  {
    query: 'Can I appeal a stipend deduction?',
    answer: 'Stipend appeals are reviewed within 14 working days. Submit via Profile > Appeals.',
    rating: 'incorrect',
    comment: 'The portal does not have a Profile > Appeals section.',
  },
  {
    query: 'Are leaves carried forward across months?',
    answer: 'No, leaves do not carry forward — they reset on the 1st of each month.',
    rating: 'helpful',
  },
  {
    query: 'How long does internship extension take?',
    answer: 'Extensions are processed within 3 working days of submission.',
    rating: 'incorrect',
    comment: 'The official policy says 5–7 working days, not 3.',
  },
];

async function seed(): Promise<void> {
  // Hard guard: never run destructive/sample-data seeds against a production database.
  if (env.isProduction) {
    logger.error('Refusing to seed chatbot feedback in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  const student = await UserModel.findOne({ email: 'abhishek@samagama.test' });
  if (!student) {
    logger.error('Seed user abhishek@samagama.test not found. Run `seed:accounts` first.');
    await disconnectDatabase();
    process.exit(1);
  }

  for (const row of SEEDS) {
    await ChatFeedbackModel.findOneAndUpdate(
      { userId: student.id, query: row.query },
      {
        $set: {
          answer: row.answer,
          rating: row.rating,
          comment: row.comment,
          status: 'open',
        },
        $setOnInsert: { userId: student.id, query: row.query, messageIndex: 0 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  logger.info({ count: SEEDS.length }, 'Chatbot feedback seeded');

  await disconnectDatabase();
  logger.info('✅ Chatbot feedback seed complete.');
}

seed().catch(async (err) => {
  logger.error({ err }, 'Failed to seed chatbot feedback');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
