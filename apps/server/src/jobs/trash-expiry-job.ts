// Hourly job that moves expired community posts to the trash.
//
// A community question is eligible when:
//   - isTrashed is false (not already trashed)
//   - visibilityExpiresAt exists and is <= now
//
// The job sets isTrashed=true and trashedAt=now on every matching question.
// Runs once immediately on startup, then every hour.
import { QuestionModel } from '../models/Question.model.js';
import { logger } from '../config/logger.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

export function scheduleTrashExpiry(): void {
  void runTrashExpiry();
  setInterval(() => void runTrashExpiry(), ONE_HOUR_MS);
}

async function runTrashExpiry(): Promise<void> {
  try {
    const now = new Date();
    const result = await QuestionModel.updateMany(
      {
        isTrashed: { $ne: true },
        visibilityExpiresAt: { $lte: now },
      },
      {
        $set: { isTrashed: true, trashedAt: now },
      },
    );
    if (result.modifiedCount > 0) {
      logger.info({ count: result.modifiedCount }, 'Trash expiry: questions moved to trash');
    }
  } catch (err) {
    logger.error({ err }, 'Trash expiry job failed');
  }
}
