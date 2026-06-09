// Scheduled background jobs for analytics. Mirrors remote analyticsJobs.js.
//
// scheduleQualityScoreRecomputation() — runs every 6 hours.
// Recomputes the qualityScore field on all published FAQs so the admin
// dashboard always reflects fresh helpfulness, freshness, and flag data.
//
// Called once from index.ts after the DB connection is established.
// Fire-and-forget — never blocks startup.
import { analyticsService } from '../services/analytics.service.js';
import { logger } from '../config/logger.js';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function scheduleQualityScoreRecomputation(): void {
  // Run once immediately on startup, then on the recurring interval.
  void runQualityRecomputation();
  setInterval(() => void runQualityRecomputation(), SIX_HOURS_MS);
}

async function runQualityRecomputation(): Promise<void> {
  try {
    logger.info('Quality score recomputation started');
    await analyticsService.recomputeAllQualityScores();
    logger.info('Quality score recomputation complete');
  } catch (err) {
    logger.error({ err }, 'Quality score recomputation failed');
  }
}
