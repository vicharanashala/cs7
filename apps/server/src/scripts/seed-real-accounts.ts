// Seeds the production-style accounts requested by the Spurti Points spec.
//
//  - 8 students with a starting balance of 100 Spurti Points
//  - 3 moderators
//  - 2 admins
//
// Idempotent: keys on email so re-running upserts existing rows. Refuses to run when
// NODE_ENV=production as defense in depth.
import bcrypt from 'bcryptjs';
import type { UserRole } from '@samagama/shared';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { UserModel } from '../models/User.model.js';

interface SeedAccount {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  spurtiPoints: number;
}

/** Convert a person's name to a stable lowercase email handle. */
function emailFromName(name: string): string {
  return `${name.toLowerCase().replace(/\s+/g, '.')}@samagama.test`;
}

const STUDENTS: { name: string; password: string }[] = [
  { name: 'Abhishek', password: 'Student@2026' },
  { name: 'Meena', password: 'Student@2026' },
  { name: 'Harshdeep', password: 'Student@2026' },
  { name: 'Harshitha', password: 'Student@2026' },
  { name: 'Spandan', password: 'Student@2026' },
  { name: 'Tejswini', password: 'Student@2026' },
  { name: 'Ravi', password: 'Student@2026' },
  { name: 'Gazal', password: 'Student@2026' },
];

const MODERATORS: { name: string; password: string }[] = [
  { name: 'Kushagra', password: 'Moderator@2026' },
  { name: 'Jahnvi', password: 'Moderator@2026' },
  { name: 'Joyita', password: 'Moderator@2026' },
];

const ADMINS: { name: string; password: string }[] = [
  { name: 'Divy', password: 'Admin@2026' },
  { name: 'Anshuman', password: 'Admin@2026' },
];

const ALL_ACCOUNTS: SeedAccount[] = [
  ...STUDENTS.map(({ name, password }) => ({
    name,
    email: emailFromName(name),
    password,
    role: 'student' as UserRole,
    spurtiPoints: 100,
  })),
  ...MODERATORS.map(({ name, password }) => ({
    name,
    email: emailFromName(name),
    password,
    role: 'moderator' as UserRole,
    spurtiPoints: 0,
  })),
  ...ADMINS.map(({ name, password }) => ({
    name,
    email: emailFromName(name),
    password,
    role: 'admin' as UserRole,
    spurtiPoints: 0,
  })),
];

async function seed(): Promise<void> {
  if (env.isProduction) {
    logger.error('Refusing to seed accounts in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  for (const account of ALL_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    const existing = await UserModel.findOne({ email: account.email });
    if (existing) {
      // Re-running shouldn't reset Spurti Points or wipe activity. Update name and password
      // (in case the password changed in the spec) but leave points alone.
      existing.name = account.name;
      existing.role = account.role;
      existing.passwordHash = passwordHash;
      existing.status = 'active';
      await existing.save();
      logger.info(
        { email: account.email, role: account.role, spurtiPoints: existing.spurtiPoints },
        'Account upserted (existing — points preserved)',
      );
    } else {
      await UserModel.create({
        name: account.name,
        email: account.email,
        passwordHash,
        role: account.role,
        spurtiPoints: account.spurtiPoints,
        status: 'active',
      });
      logger.info(
        { email: account.email, role: account.role, spurtiPoints: account.spurtiPoints },
        'Account created',
      );
    }
  }

  await disconnectDatabase();
  logger.info(
    `✅ Seeded ${STUDENTS.length} students, ${MODERATORS.length} moderators, ${ADMINS.length} admins.`,
  );
}

seed().catch(async (err) => {
  logger.error({ err }, 'Failed to seed accounts');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
