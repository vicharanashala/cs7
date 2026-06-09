// MongoDB connection lifecycle.
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from './logger.js';

mongoose.set('strictQuery', true);

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    logger.info({ uri: redactUri(env.MONGODB_URI) }, 'MongoDB connected');
  } catch (err) {
    logger.error({ err }, 'MongoDB connection failed');
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}

/** Hide credentials in connection string before logging. */
function redactUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}
