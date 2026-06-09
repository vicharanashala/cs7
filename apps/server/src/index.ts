// Server entry point. Boots the database, then starts the HTTP listener.
import { createApp } from './app.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { runEmbeddingBackfill } from './jobs/embedding-backfill.js';
import { scheduleQualityScoreRecomputation } from './jobs/analytics-jobs.js';
import { scheduleTrashExpiry } from './jobs/trash-expiry-job.js';

async function start(): Promise<void> {
  await connectDatabase();

  // Background jobs — fire-and-forget, never block startup.
  void runEmbeddingBackfill();
  scheduleQualityScoreRecomputation();
  scheduleTrashExpiry();

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Samagama API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Graceful shutdown initiated');
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Force-exit after 10s if cleanup hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

start().catch((err) => {
  logger.fatal({ err }, 'Server failed to start');
  process.exit(1);
});
