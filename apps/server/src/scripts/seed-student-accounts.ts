// Seeds 25 additional student accounts for demo/test purposes.
// All accounts start with 100 Spurti Points.
// Idempotent: keys on email so re-running upserts existing rows.
// Run via: `npm run seed:student-accounts` (from the server workspace)
import bcrypt from 'bcryptjs';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { UserModel } from '../models/User.model.js';

const STUDENTS = [
  'Aditya',
  'Priya',
  'Arjun',
  'Sneha',
  'Vikram',
  'Kavya',
  'Rohit',
  'Ananya',
  'Siddharth',
  'Deepika',
  'Karthik',
  'Mythili',
  'Naveen',
  'Divya',
  'Suresh',
  'Meenakshi',
  'Chandran',
  'Lavanya',
  'Balaji',
  'Uma',
  'Gopinath',
  'Radhika',
  'Venkat',
  'Shakthi',
  'Nandini',
];

const PASSWORD = 'Student@2026';

async function seed(): Promise<void> {
  if (env.isProduction) {
    logger.error('Refusing to seed student accounts in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  for (const name of STUDENTS) {
    // Derive a deterministic test email from the name so re-runs hit the same row.
    const email = `${name.toLowerCase().replace(/\s+/g, '.')}@samagama.test`;
    const passwordHash = await bcrypt.hash(PASSWORD, 12);
    const existing = await UserModel.findOne({ email });
    if (existing) {
      // Re-seed in place — reset profile/password but deliberately keep earned Spurti Points.
      existing.name = name;
      existing.role = 'student';
      existing.passwordHash = passwordHash;
      existing.status = 'active';
      await existing.save();
      logger.info(
        { email, role: existing.role, spurtiPoints: existing.spurtiPoints },
        'Student upserted (existing — points preserved)',
      );
    } else {
      await UserModel.create({
        name,
        email,
        passwordHash,
        role: 'student',
        spurtiPoints: 100,
        status: 'active',
      });
      logger.info({ email, role: 'student', spurtiPoints: 100 }, 'Student created');
    }
  }

  await disconnectDatabase();
  logger.info(`✅ Seeded ${STUDENTS.length} student accounts.`);
}

seed().catch(async (err) => {
  logger.error({ err }, 'Failed to seed student accounts');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
