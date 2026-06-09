// One-shot migration: re-embed existing community questions on title + description.
//
// Why this exists:
//   The startup embedding-backfill job only fills questions with NO embedding
//   (embedding: { $exists: false }). Questions seeded/created before the
//   "title + description" embedding change already hold a title-only vector, so
//   the backfill skips them and they keep returning low-relevance "Check
//   Community" matches. This script forcibly regenerates every community
//   question's embedding using the same construction as the live query side
//   (composeQuestionEmbeddingText) so existing data benefits immediately.
//
// Safe to re-run: it simply overwrites each vector with a freshly computed one.
// Batched + throttled to respect embedding-provider rate limits (Gemini free
// tier ≈ 15 req/min).
//
// Run: npm --workspace @samagama/server run reembed:questions
import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { QuestionModel } from '../models/Question.model.js';
import { generateEmbedding, composeQuestionEmbeddingText } from '../services/embedding.service.js';

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

async function reembedCommunityQuestions(): Promise<void> {
  await connectDatabase();

  const questions = await QuestionModel.find({ type: 'community' })
    .select('_id title description')
    .lean<{ _id: unknown; title: string; description: string }[]>();

  logger.info({ count: questions.length }, 'Community questions to re-embed');

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (q) => {
        try {
          const embedding = await generateEmbedding(
            composeQuestionEmbeddingText(q.title, q.description),
          );
          await QuestionModel.updateOne({ _id: q._id }, { embedding });
          updated++;
        } catch (err) {
          failed++;
          logger.warn({ err, questionId: q._id }, 'Failed to re-embed question');
        }
      }),
    );
    if (i + BATCH_SIZE < questions.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }

  logger.info({ updated, failed }, '✅ Community question re-embedding complete');
  await disconnectDatabase();
}

reembedCommunityQuestions().catch(async (err) => {
  logger.error({ err }, 'Failed to re-embed community questions');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
