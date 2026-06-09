// One-shot embedding backfill job. Mirrors remote embeddingBackfillJob.js.
//
// On server startup, finds FAQs and Questions that have no embedding vector
// (embedding === undefined) and generates 384-dim embeddings for them in
// small batches so it doesn't overwhelm the embedding API.
//
// Called once from index.ts after the DB connection is established.
// Fire-and-forget — never blocks startup or request handling.
import { FaqModel } from '../models/Faq.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { generateEmbedding, composeQuestionEmbeddingText } from '../services/embedding.service.js';
import { logger } from '../config/logger.js';

const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 200;

export async function runEmbeddingBackfill(): Promise<void> {
  try {
    logger.info('Embedding backfill started');
    await backfillFaqs();
    await backfillQuestions();
    logger.info('Embedding backfill complete');
  } catch (err) {
    logger.error({ err }, 'Embedding backfill failed');
  }
}

async function backfillFaqs(): Promise<void> {
  const faqs = await FaqModel.find({
    status: 'published',
    embedding: { $exists: false },
  })
    .select('_id title')
    .lean<{ _id: unknown; title: string }[]>();

  logger.info({ count: faqs.length }, 'FAQs needing embedding');

  for (let i = 0; i < faqs.length; i += BATCH_SIZE) {
    const batch = faqs.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (faq) => {
        try {
          const embedding = await generateEmbedding(faq.title);
          await FaqModel.updateOne({ _id: faq._id }, { embedding });
        } catch (err) {
          logger.warn({ err, faqId: faq._id }, 'Failed to embed FAQ');
        }
      }),
    );
    if (i + BATCH_SIZE < faqs.length) {
      await delay(BATCH_DELAY_MS);
    }
  }
}

async function backfillQuestions(): Promise<void> {
  const questions = await QuestionModel.find({
    embedding: { $exists: false },
  })
    .select('_id title description')
    .lean<{ _id: unknown; title: string; description: string }[]>();

  logger.info({ count: questions.length }, 'Questions needing embedding');

  for (let i = 0; i < questions.length; i += BATCH_SIZE) {
    const batch = questions.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (q) => {
        try {
          // Embed title + description (same as the query side) so the vector
          // captures the whole question, not just its first line.
          const embedding = await generateEmbedding(
            composeQuestionEmbeddingText(q.title, q.description),
          );
          await QuestionModel.updateOne({ _id: q._id }, { embedding });
        } catch (err) {
          logger.warn({ err, questionId: q._id }, 'Failed to embed Question');
        }
      }),
    );
    if (i + BATCH_SIZE < questions.length) {
      await delay(BATCH_DELAY_MS);
    }
  }
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
