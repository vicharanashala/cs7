// Seeds community questions and personal questions directly into MongoDB.
// Bypasses the check-existing API flow — intended for dev/demo environments only.
//
// What it does:
//   1. Seeds community questions (unchanged from previous version).
//   2. Seeds up to 20 personal questions distributed randomly across all 33 seeded students.
//      Personal questions are private (visible only to the asker and moderators).
//
// Prerequisites:
//   npm run seed:accounts          (real named accounts: 8 students + mods + admins)
//   npm run seed:student-accounts  (25 additional students)
//   npm run seed:faqs              (creates categories)
//
// Idempotent: skips questions whose title already exists in the database.
//
// Run: `npx tsx src/scripts/seed-community-questions.ts`
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { UserModel } from '../models/User.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { CategoryModel } from '../models/Category.model.js';

// ── Community question data ───────────────────────────────────────────────────

const COMMUNITY_QUESTIONS = [
  {
    title: 'NOC format issue',
    description: 'My college provides NOC in its own format. Will it be accepted by IIT Ropar?',
  },
  {
    title: 'Dashboard shows interview incomplete',
    description:
      'I completed my interview and Yaksha confirmed it, but my dashboard still shows "Incomplete". When will it update?',
  },
  {
    title: 'Interview status shows interrupted',
    description:
      'Yaksha said my interview was completed successfully, but the portal shows "Interview Interrupted". Why?',
  },
  {
    title: 'Offer letter delayed after NOC',
    description:
      'My NOC was uploaded and validated over 48 hours ago but I still have not received the formal offer letter. When will I get it?',
  },
  {
    title: 'Offer letter says NOC pending',
    description:
      'My NOC is showing as validated on the dashboard but my offer letter still says "NOC Pending". Please fix this.',
  },
  {
    title: 'Cannot join Zoom meeting',
    description:
      'I registered for the Zoom meeting but it says registration error or wrong passcode. What is the correct meeting link?',
  },
  {
    title: 'WhatsApp group is full',
    description:
      'The Vicharanashala-Summership WhatsApp group shows as full. How can I join and receive updates?',
  },
  {
    title: 'Acceptance email bounced',
    description:
      'My acceptance email bounced with "address not found". What should I do to confirm my acceptance?',
  },
  {
    title: 'How to sign offer letter',
    description:
      'Do I need to print and sign the offer letter physically, or can I sign it digitally? And which email should I send it to?',
  },
  {
    title: 'Change locked internship dates',
    description:
      'The internship dates on my dashboard are locked. I need to change them due to college exam conflicts. How can I modify them?',
  },
  {
    title: 'College refusing NOC',
    description:
      'My college/university is refusing to give me an NOC for this unpaid internship. Is there an alternative?',
  },
  {
    title: 'No Zoom link received',
    description:
      "I have not received any Zoom meeting link for today's session. When will I get the invite?",
  },
  {
    title: 'No ViBe course link',
    description:
      "I received my offer letter but haven't received the Phase 1 / Bronze course link on ViBe. When will I get access?",
  },
  {
    title: 'Mentor not assigned',
    description:
      'My internship started but no mentor has been assigned to me yet. When will I receive mentor details?',
  },
  {
    title: 'Dashboard not updating',
    description:
      'I completed all the steps but my portal dashboard is not updating. What should I do?',
  },
  {
    title: 'Internship start date passed',
    description:
      'My internship start date was 3 days ago but I still have not received any onboarding details or access. What to do?',
  },
  {
    title: 'Leaves and weekends policy',
    description:
      'Do we get leaves during the internship? What about weekends and emergency situations?',
  },
  {
    title: 'Internship flexibility',
    description:
      'Is the internship self-paced or are there fixed timings? Can I manage it alongside college classes?',
  },
  {
    title: 'How daily sessions work',
    description:
      'Will we get a Zoom link every day or are sessions conducted through the Samagama dashboard?',
  },
  {
    title: 'Missed orientation recording',
    description:
      'I missed the orientation session. Can I get the recording or make up for the missed content?',
  },
  {
    title: 'Spurti Points showing zero',
    description:
      'My internship started but my Spurti Points are showing as zero. Will they be updated later?',
  },
  {
    title: 'Need selection letter for NOC',
    description:
      'My college requires an official selection/confirmation letter before they will sign the NOC. How can I get one?',
  },
  {
    title: 'Withdraw from internship',
    description: 'I want to cancel or withdraw from the internship. What is the process?',
  },
  {
    title: 'Spelling mistake in offer letter',
    description:
      'There is a spelling error in my name on the offer letter. How do I get it corrected?',
  },
  {
    title: 'Yaksha chat not working',
    description:
      'I am unable to interact with Yaksha. The chat is not working and shows an interview timer. What should I do?',
  },
  {
    title: 'Cannot access ViBe platform',
    description:
      'I cannot create an account on ViBe or access the course platform. The "create account" button does nothing.',
  },
  {
    title: 'Stipend eligibility query',
    description:
      'I am an NPTEL Gold/Elite student and received an email about a ₹5,000 stipend, but my dashboard shows "VINS (No Stipend)". Am I eligible?',
  },
  {
    title: 'Standup meetings before start date',
    description:
      "My internship starts next month but I received a Zoom standup meeting link. Should I attend even though my start date hasn't arrived?",
  },
  {
    title: 'No confirmation after acceptance email',
    description:
      'I signed and sent the acceptance email 3 days ago but received no confirmation. Is that normal?',
  },
  {
    title: 'Mistake in acceptance email format',
    description:
      'I replied with "reply" instead of "reply all" to the acceptance email. Will it still be accepted? Should I resend?',
  },
];

// ── Personal question data ────────────────────────────────────────────────────
// These are private questions that students would ask directly to moderators,
// not suitable for public community posting. Max 20 will be seeded.

const PERSONAL_QUESTIONS = [
  {
    title: 'Medical emergency — requesting extension on Phase 1 tasks',
    description:
      'I was hospitalized for 5 days and could not complete the Phase 1 tasks by the deadline. Can I get an extension? I can provide medical documents as proof.',
  },
  {
    title: 'Stipend not credited for the second month',
    description:
      'I did not receive my stipend for the second month. I checked with my bank and there is no pending transaction from Samagama. Can you look into this from your end?',
  },
  {
    title: 'Name mismatch between portal and official documents',
    description:
      'My name on the portal shows "Priya Nair" but my NOC and college certificates show "Priya S Nair". Will this mismatch cause issues with the final internship certificate?',
  },
  {
    title: 'Assigned mentor has not responded in 10 days',
    description:
      'My assigned mentor has not replied to any of my messages for the past 10 days. I have sent three follow-up emails and two WhatsApp messages. Can you assign a different mentor or escalate this?',
  },
  {
    title: 'Laptop failure two days before Phase 2 submission',
    description:
      'My laptop suffered a hardware failure two days before the Phase 2 submission deadline. All my work is on the broken device. Can I get a 3-day extension to recover and resubmit?',
  },
  {
    title: 'Supplementary college exams clash with internship weeks',
    description:
      'My college has scheduled supplementary exams during the core internship weeks. Is there a way to pause or reschedule my internship participation without penalty?',
  },
  {
    title: 'Charged twice for registration fee on the same day',
    description:
      'My bank statement shows two deductions of the same registration amount on the same date. This appears to be a duplicate charge. How do I request a refund for the duplicate payment?',
  },
  {
    title: 'Uncomfortable interaction with a platform moderator',
    description:
      'I want to report an uncomfortable interaction I had with one of the platform moderators during a private session. I would prefer to keep this matter confidential and handled discreetly.',
  },
  {
    title: 'Need confidential recommendation letter for scholarship',
    description:
      'I need an official recommendation letter issued by IIT Ropar for a scholarship application. The deadline is next week. Can someone help me obtain this on priority?',
  },
  {
    title: 'Accessibility accommodation for Zoom sessions',
    description:
      'I have a hearing impairment and find it difficult to follow live Zoom sessions without captions. Can you enable automatic captions or provide text transcripts for all mandatory sessions?',
  },
  {
    title: 'My mobile number is visible to other students',
    description:
      'I noticed my personal mobile number appears to be visible to other students on the community page. I did not consent to this. Please remove it and review the privacy settings.',
  },
  {
    title: 'Mandatory session conflicts with a religious festival',
    description:
      'A mandatory live session is scheduled on a major festival day for my community. Can I be granted an exemption or access to the session recording without my attendance being penalised?',
  },
  {
    title: 'Requesting formal withdrawal due to family emergency',
    description:
      'A serious medical emergency in my family has made me the primary caretaker at home. I need to formally withdraw from the internship. Will this affect my eligibility for future Samagama cohorts?',
  },
  {
    title: 'Completion certificate issued with wrong graduation year',
    description:
      'The completion certificate I received shows my graduation year as 2025, but I am a 2026 batch student. Can a corrected certificate be reissued? I need it for my college records.',
  },
  {
    title: 'No internet access for two weeks due to family relocation',
    description:
      'My family is relocating and I will have no reliable internet access for the next two weeks. Is there an offline mode or any accommodation available so I do not lose my internship progress?',
  },
  {
    title: 'Requesting re-evaluation of stipend eligibility after NPTEL result',
    description:
      'I was initially categorised as VINS (no stipend), but I recently qualified for NPTEL Gold certification after the original cutoff date. Can my stipend eligibility be re-evaluated for the remaining internship weeks?',
  },
  {
    title: 'Assigned to wrong domain — requesting reassignment to ML/AI track',
    description:
      'I have been assigned to the data analytics domain but I applied specifically for the Machine Learning and AI track. Can I be reassigned to match my stated preference and existing skill set?',
  },
  {
    title: 'Need participation letter urgently for visa appointment',
    description:
      'I have a visa appointment in 5 days and need an official internship participation letter from IIT Ropar as supporting documentation. Can this be issued on priority?',
  },
  {
    title: 'Submitted incorrect bank account number for stipend',
    description:
      'I made a typing error in the bank account number I submitted for stipend payment. One payment has already been sent to the wrong account. How do I correct this urgently to avoid further misdirected payments?',
  },
  {
    title: 'Completed all modules early — requesting early completion certificate',
    description:
      'I have finished all required modules and submitted all deliverables two weeks ahead of the official end date. Is it possible to receive my completion certificate earlier than scheduled?',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Seeders ───────────────────────────────────────────────────────────────────

async function seedPersonalQuestions(
  students: { _id: unknown }[],
  categoryId: unknown,
): Promise<void> {
  const shuffledStudents = shuffle(students);
  const shuffledQuestions = shuffle([...PERSONAL_QUESTIONS]);
  // Cap at 20
  const toSeed = shuffledQuestions.slice(0, 20);
  let created = 0;
  let skipped = 0;

  for (let i = 0; i < toSeed.length; i++) {
    const student = shuffledStudents[i % shuffledStudents.length];
    const q = toSeed[i];

    const exists = await QuestionModel.exists({ title: q.title, type: 'personal' });
    if (exists) {
      skipped++;
      continue;
    }

    await QuestionModel.create({
      title: q.title,
      description: q.description,
      type: 'personal',
      status: 'open',
      category: categoryId,
      askedBy: student._id,
      existingAnswerCheck: { checkedAt: new Date() },
      answerCount: 0,
      viewCount: 0,
    });
    created++;
    logger.info(
      { title: q.title, student: String(student._id).slice(-6) },
      'Created personal question',
    );
    await new Promise((r) => setTimeout(r, 50));
  }

  logger.info({ created, skipped }, 'Personal questions seeded');
}

async function seedCommunityQuestions() {
  if (env.isProduction) {
    logger.error('Refusing to seed in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  const defaultCategory = await CategoryModel.findOne({ isActive: { $ne: false } }).lean<{
    _id: unknown;
  }>();
  if (!defaultCategory) throw new Error('No categories found. Run seed:faqs first.');

  // Fetch all 33 seeded students (25 from seed:student-accounts + 8 from seed:accounts)
  const students = await UserModel.find({ role: 'student', email: /@samagama\.test$/ }, '_id').lean<
    { _id: unknown }[]
  >();
  if (students.length === 0) {
    throw new Error('No student accounts found. Run seed:accounts + seed:student-accounts first.');
  }

  logger.info({ studentCount: students.length }, 'Fetched student accounts');

  const shuffledStudents = shuffle(students);
  const shuffledQuestions = shuffle([...COMMUNITY_QUESTIONS]);
  let communityCreated = 0;
  let communitySkipped = 0;

  for (let i = 0; i < shuffledQuestions.length; i++) {
    const student = shuffledStudents[i % shuffledStudents.length];
    const q = shuffledQuestions[i];

    const exists = await QuestionModel.exists({ title: q.title, type: 'community' });
    if (exists) {
      communitySkipped++;
      continue;
    }

    await QuestionModel.create({
      title: q.title,
      description: q.description,
      type: 'community',
      status: 'open',
      category: defaultCategory._id,
      askedBy: student._id,
      existingAnswerCheck: { checkedAt: new Date() },
      answerCount: 0,
      viewCount: 0,
    });
    communityCreated++;
    logger.info(
      { title: q.title, student: String(student._id).slice(-6) },
      'Created community question',
    );
    await new Promise((r) => setTimeout(r, 50));
  }

  logger.info({ communityCreated, communitySkipped }, 'Community questions seeded');

  await seedPersonalQuestions(students, defaultCategory._id);

  await disconnectDatabase();
  logger.info('✅ Community and personal questions seeded.');
}

seedCommunityQuestions().catch(async (err) => {
  logger.error({ err }, 'Failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
