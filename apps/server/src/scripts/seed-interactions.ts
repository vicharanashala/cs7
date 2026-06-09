// Seeds community question interactions directly into MongoDB — no running server needed.
//
// What it does (four phases):
//   Phase 0  — Prerequisite: if no community questions exist, creates them.
//   Phase 0.5 — Personal questions: seeds up to 20 personal questions if none exist.
//   Phase 1  — Answers: adds 5–10 answers per question; ~10 questions deliberately left unanswered.
//   Phase 2  — Votes:   applies upvotes/downvotes (80 % up, 20 % down).
//   Phase 3  — Boost:   guarantees the top-3 most-tagged questions are net-positive.
//
// Idempotent: skips existing answers (unique-index enforced), skips already-cast votes.
// Refuses to run when NODE_ENV=production.
//
// Prerequisites:
//   npm run seed:accounts         (real named accounts: students, mods, admins)
//   npm run seed:student-accounts (25 extra students for richer interaction data)
//   npm run seed:faqs             (seeds categories — required for question creation)
//
// Run via: npm run seed:interactions  (from apps/server)
//       or: npm --workspace @samagama/server run seed:interactions  (from repo root)

import type { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AnswerModel } from '../models/Answer.model.js';
import { CategoryModel } from '../models/Category.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { UserModel } from '../models/User.model.js';

// ── Personal question seed data ───────────────────────────────────────────────
// Private questions distributed randomly to students; max 20 seeded.

const PERSONAL_QUESTIONS_SEED: { title: string; description: string }[] = [
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
      'I made a typing error in the bank account number I submitted for stipend payment. One payment has already been sent to the wrong account. How do I correct this urgently?',
  },
  {
    title: 'Completed all modules early — requesting early completion certificate',
    description:
      'I have finished all required modules and submitted all deliverables two weeks ahead of the official end date. Is it possible to receive my completion certificate earlier than scheduled?',
  },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const ANSWER_CAP = 10; // hard cap — no question exceeds this
const ANSWERS_MIN = 5; // min answers for a question that gets responses
const ANSWERS_MAX = 10; // max answers per question (matches ANSWER_CAP)
const UNANSWERED_QUESTION_COUNT = 10; // ~10 community questions seeded with zero answers
const UPVOTE_PROBABILITY = 0.8;
const VOTERS_TOP = { min: 6, max: 9 };
const VOTERS_OTHER = { min: 3, max: 5 };

// Distribution of tagged-student counts on the first N questions (most common question pattern)
const TAG_DISTRIBUTION = [12, 10, 8, 7, 5, 3, 2];

const COMMUNITY_QUESTIONS: { title: string; description: string }[] = [
  {
    title: 'Dashboard still shows interview incomplete',
    description:
      'I completed my interview and Yaksha confirmed it, but my dashboard still shows "Incomplete". It has been more than 24 hours. When will the status update?',
  },
  {
    title: 'Portal shows Interview Interrupted after Yaksha',
    description:
      'Yaksha said my interview was completed successfully, but the portal shows "Interview Interrupted". Which status should I trust?',
  },
  {
    title: 'Offer letter not received after NOC validation',
    description:
      'My NOC was uploaded and validated over 48 hours ago but I still have not received the formal offer letter. Is there a delay or did something go wrong?',
  },
  {
    title: 'Offer letter still says NOC Pending after upload',
    description:
      'My dashboard shows my NOC as validated, but the offer letter still displays "NOC Pending". This mismatch is preventing me from proceeding. Please advise.',
  },
  {
    title: 'Zoom meeting registration error or wrong passcode',
    description:
      'I registered for the orientation Zoom meeting but get a "registration error" or "wrong passcode" message when trying to join. What is the correct link or passcode?',
  },
  {
    title: 'WhatsApp group is full — how to join',
    description:
      'The Vicharanashala-Summership WhatsApp group shows as full when I try to join. I need to be in the group to receive important updates. Is there an alternate channel?',
  },
  {
    title: 'Acceptance email bounced with address not found',
    description:
      'When I tried to send my signed acceptance email, it bounced with an "address not found" error. What is the correct email address I should be sending it to?',
  },
  {
    title: 'Digital vs physical signature on offer letter',
    description:
      'Do I need to print and physically sign the offer letter, or is a digital signature acceptable? Also, which email address should I use to send the signed copy back?',
  },
  {
    title: 'Cannot change locked internship dates on dashboard',
    description:
      'The internship start and end dates on my dashboard appear locked with no edit option. I need to change them due to my college examination schedule. How can I request a date change?',
  },
  {
    title: 'College refusing to give NOC for unpaid internship',
    description:
      'My college administration is refusing to issue an NOC because the internship is unpaid. Is there any alternative document or workaround that Samagama accepts in place of an NOC?',
  },
  {
    title: 'No Zoom meeting link received for today',
    description:
      "I have not received any Zoom meeting link for today's scheduled session. My email shows no invite. When will I get the link, or where can I find it on the portal?",
  },
  {
    title: 'No ViBe course link in offer letter email',
    description:
      'My offer letter arrived but there is no link to the Phase 1 / Bronze course on the ViBe platform. When will I receive the course access link?',
  },
  {
    title: 'No mentor assigned after internship started',
    description:
      'My internship officially started but I have not been assigned a mentor yet. I need mentor guidance to begin my project work. When will the assignment happen?',
  },
  {
    title: 'Portal dashboard not updating after completing steps',
    description:
      'I have completed all the required onboarding steps but my portal dashboard is still showing them as incomplete. I have waited 24 hours with no change. What should I do?',
  },
  {
    title: 'No onboarding details three days after start date',
    description:
      'My internship start date was three days ago but I have received no onboarding materials, access credentials, or portal instructions. What is the next step?',
  },
  {
    title: 'Leave policy — weekends and emergency situations',
    description:
      'How many leaves are we allowed during the internship? Are weekends counted as working days? Is there any provision for emergency or medical leave?',
  },
  {
    title: 'Is the internship self-paced or fixed schedule',
    description:
      'I want to manage the internship alongside my college timetable. Are there mandatory fixed session timings, or can I complete tasks at my own pace?',
  },
  {
    title: 'Are daily sessions on Zoom or Samagama dashboard',
    description:
      'I am unsure how daily sessions are conducted. Will I receive a Zoom link each day, or are sessions delivered through the Samagama portal dashboard?',
  },
  {
    title: 'Missed orientation — how to catch up',
    description:
      'I missed the orientation session due to a technical issue on my end. Is there a recording I can access? Will missing orientation affect my internship evaluation?',
  },
  {
    title: 'Need selection letter for college NOC process',
    description:
      'My college requires an official selection or confirmation letter from Samagama before they will issue the NOC. How can I get such a letter, and who should I contact?',
  },
  {
    title: 'How to withdraw or cancel my internship',
    description:
      'I need to cancel my internship due to personal circumstances. What is the official process for withdrawal? Will it affect my academic record or any future Samagama applications?',
  },
  {
    title: 'Name spelling error in offer letter',
    description:
      'There is a spelling mistake in my name on the offer letter I received. I need a corrected copy for submission to my college. How do I request a corrected letter?',
  },
  {
    title: 'Yaksha chat not responding — shows interview timer',
    description:
      'I am unable to interact with Yaksha through the chatbot. The interface shows an interview timer instead of the normal chat UI. How do I access the chat assistant?',
  },
  {
    title: 'Cannot create ViBe account — button does nothing',
    description:
      'I am trying to access the ViBe course platform but the "Create Account" button does nothing when I click it. I have tried different browsers. How do I get access?',
  },
  {
    title: 'NPTEL Gold student stipend eligibility question',
    description:
      'I received an email about a ₹5,000 stipend for NPTEL Gold or Elite students, but my portal dashboard shows "VINS (No Stipend)". Am I eligible, and what do I need to do to claim it?',
  },
  {
    title: 'Received standup link before internship start date',
    description:
      'My internship officially starts next month but I already received a Zoom standup meeting link for next week. Should I attend even though my start date has not arrived yet?',
  },
  {
    title: 'No reply received after sending acceptance email',
    description:
      'I signed and sent my acceptance email three days ago and have received no confirmation or acknowledgement. Is this normal, or should I send it again?',
  },
  {
    title: 'Sent acceptance email with Reply instead of Reply All',
    description:
      'I accidentally used "Reply" instead of "Reply All" when responding to the acceptance email. Will my acceptance still be registered? Should I send the email again?',
  },
  {
    title: 'College NOC in its own format — will it be accepted',
    description:
      "My college provides NOC documents only in their own institutional format rather than a standard template. Will Samagama or IIT Ropar accept a NOC in the college's own format?",
  },
  {
    title: 'Spurti Points showing zero after internship started',
    description:
      'My internship started but my Spurti Points are showing as zero on the dashboard. Will they be updated retroactively, or is there something I need to do to trigger the update?',
  },
];

const ANSWER_BODIES = [
  'I had the same issue. What worked for me was contacting the support team via email. They resolved it within 24 hours.',
  'Based on my experience, check the spam folder first. The emails sometimes land there.',
  'I asked Yaksha about this and got a helpful response. Have you tried the #escalate command?',
  'This is a common onboarding issue. The best approach is to wait 24–48 hours then follow up.',
  'Make sure you have finished all previous steps — this step only unlocks after everything else is complete.',
  'Go to your profile settings and re-upload the document. That should refresh the status.',
  'The team usually responds within 24–48 hours on working days. If it has been longer, email them directly.',
  'I was told this is normal for the first few days. It should resolve automatically.',
  'Try clearing your browser cache and logging in again. That fixed the issue for me.',
  'Some portal features work better on Chrome than on Firefox — try switching browsers.',
  'The portal typically updates at midnight. Any changes should reflect by tomorrow morning.',
  'Posting in the community section is helpful — other students who faced the same issue may have a solution.',
  'Have you checked that your document matches the required format? That was the root cause in my case.',
  'Raise a support ticket through the portal itself. The team monitors those closely.',
  'In my case the issue was with the email ID format. Make sure you use your college email, not a personal one.',
  'The best solution here is patience — the system takes time to process everything during peak onboarding.',
  'Reaching out on the WhatsApp group worked for me. The moderators are quite responsive there.',
  'I noticed the portal works best on Chrome. Try switching if you are on a different browser.',
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

function randInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Student {
  _id: Types.ObjectId;
  email: string;
}

interface Question {
  _id: Types.ObjectId;
  askedBy: Types.ObjectId;
  answerCount: number;
  taggedStudents: Types.ObjectId[];
}

interface AnswerDoc {
  _id: Types.ObjectId;
  answeredBy: Types.ObjectId;
  upvotes: Types.ObjectId[];
  downvotes: Types.ObjectId[];
  upvoteCount: number;
  downvoteCount: number;
}

// ── Phase 0: Ensure community questions exist ─────────────────────────────────

async function ensureQuestions(students: Student[]): Promise<void> {
  const existing = await QuestionModel.countDocuments({
    type: 'community',
    isTrashed: { $ne: true },
  });

  if (existing > 0) {
    logger.info({ existing }, 'Community questions already present — skipping creation');
    return;
  }

  logger.info('No community questions found — creating them now');

  const defaultCategory = await CategoryModel.findOne({ isActive: { $ne: false } }).lean<{
    _id: Types.ObjectId;
  }>();

  if (!defaultCategory) {
    throw new Error('No categories found. Run `npm run seed:faqs` first.');
  }

  const shuffledStudents = shuffle(students);
  let created = 0;

  for (let i = 0; i < COMMUNITY_QUESTIONS.length; i++) {
    const { title, description } = COMMUNITY_QUESTIONS[i];
    const student = shuffledStudents[i % shuffledStudents.length];

    const alreadyExists = await QuestionModel.exists({ title, type: 'community' });
    if (alreadyExists) continue;

    await QuestionModel.create({
      title,
      description,
      type: 'community',
      status: 'open',
      category: defaultCategory._id,
      askedBy: student._id,
      answerCount: 0,
      viewCount: 0,
    });
    created++;
  }

  // Tag multiple students onto the first questions to simulate realistic demand distribution.
  const allQuestions = await QuestionModel.find(
    { type: 'community', isTrashed: { $ne: true } },
    '_id',
  ).lean<{ _id: Types.ObjectId }[]>();

  for (let i = 0; i < Math.min(TAG_DISTRIBUTION.length, allQuestions.length); i++) {
    const tagCount = TAG_DISTRIBUTION[i];
    const taggedIds = shuffle(students)
      .slice(0, tagCount)
      .map((s) => s._id);
    await QuestionModel.updateOne(
      { _id: allQuestions[i]._id },
      { $set: { taggedStudents: taggedIds } },
    );
  }

  logger.info(
    { created, tagged: Math.min(TAG_DISTRIBUTION.length, allQuestions.length) },
    'Community questions created',
  );
}

// ── Phase 0.5: Personal questions ────────────────────────────────────────────

async function ensurePersonalQuestions(
  students: Student[],
  categoryId: Types.ObjectId,
): Promise<void> {
  const existing = await QuestionModel.countDocuments({
    type: 'personal',
    isTrashed: { $ne: true },
  });

  if (existing >= PERSONAL_QUESTIONS_SEED.length) {
    logger.info({ existing }, 'Personal questions already present — skipping creation');
    return;
  }

  logger.info({ existing }, 'Seeding personal questions');

  const shuffledStudents = shuffle(students);
  const shuffledQuestions = shuffle([...PERSONAL_QUESTIONS_SEED]);
  let created = 0;

  for (let i = 0; i < shuffledQuestions.length; i++) {
    const { title, description } = shuffledQuestions[i];
    const student = shuffledStudents[i % shuffledStudents.length];

    const alreadyExists = await QuestionModel.exists({ title, type: 'personal' });
    if (alreadyExists) continue;

    await QuestionModel.create({
      title,
      description,
      type: 'personal',
      status: 'open',
      category: categoryId,
      askedBy: student._id,
      answerCount: 0,
      viewCount: 0,
    });
    created++;
  }

  logger.info({ created }, 'Personal questions created');
}

// ── Phase 1: Answers ──────────────────────────────────────────────────────────

async function seedAnswers(
  questions: Question[],
  students: Student[],
  unansweredIds: Set<string>,
): Promise<number> {
  let totalCreated = 0;

  for (const question of questions) {
    // Skip questions deliberately kept unanswered for realism.
    if (unansweredIds.has(question._id.toString())) continue;

    const remaining = ANSWER_CAP - question.answerCount;
    if (remaining <= 0) continue;

    const existingAnswerers = await AnswerModel.find(
      { questionId: question._id },
      'answeredBy',
    ).lean<{ answeredBy: Types.ObjectId }[]>();

    const voted = new Set(existingAnswerers.map((a) => a.answeredBy.toString()));
    voted.add(question.askedBy.toString()); // asker cannot answer their own question

    const eligible = students.filter((s) => !voted.has(s._id.toString()));
    if (eligible.length === 0) continue;

    const target = Math.min(randInt(ANSWERS_MIN, ANSWERS_MAX), eligible.length, remaining);

    const selected = shuffle(eligible).slice(0, target);
    let created = 0;

    for (const student of selected) {
      await AnswerModel.create({
        questionId: question._id,
        body: pickRandom(ANSWER_BODIES),
        answeredBy: student._id,
        status: 'pending',
      });
      created++;
    }

    if (created > 0) {
      await QuestionModel.updateOne(
        { _id: question._id },
        {
          $inc: { answerCount: created },
          ...(question.answerCount === 0 ? { $set: { status: 'answered' } } : {}),
        },
      );
      logger.info({ questionId: question._id.toString().slice(-6), created }, 'Answers added');
      totalCreated += created;
    }
  }

  return totalCreated;
}

// ── Phase 2: Votes ────────────────────────────────────────────────────────────

async function seedVotes(
  questions: Question[],
  students: Student[],
  topIds: Set<string>,
): Promise<number> {
  const answers = await AnswerModel.find({ questionId: { $in: questions.map((q) => q._id) } })
    .select('+upvotes +downvotes')
    .lean<AnswerDoc[]>();

  let totalVotes = 0;

  for (const answer of answers) {
    const isTop = topIds.has(
      questions
        .find((q) =>
          answers.some(
            (a) =>
              a._id.equals(answer._id) &&
              // find via questionId on the answer itself
              true,
          ),
        )
        ?._id.toString() ?? '',
    );

    const questionOfAnswer = questions.find(
      (q) =>
        answers.filter((a) => {
          const qIdStr = (a as unknown as { questionId: Types.ObjectId }).questionId?.toString();
          return qIdStr === q._id.toString() && a._id.equals(answer._id);
        }).length > 0,
    );
    const isTopQuestion = questionOfAnswer ? topIds.has(questionOfAnswer._id.toString()) : false;

    const voterRange = isTopQuestion ? VOTERS_TOP : VOTERS_OTHER;
    const numVoters = randInt(voterRange.min, voterRange.max);

    const alreadyVoted = new Set([
      ...answer.upvotes.map((v) => v.toString()),
      ...answer.downvotes.map((v) => v.toString()),
    ]);

    const eligible = students.filter(
      (s) =>
        s._id.toString() !== answer.answeredBy.toString() && !alreadyVoted.has(s._id.toString()),
    );

    const voters = shuffle(eligible).slice(0, Math.min(numVoters, eligible.length));

    for (const voter of voters) {
      const direction = Math.random() < UPVOTE_PROBABILITY ? 'up' : 'down';
      if (direction === 'up') {
        await AnswerModel.updateOne(
          { _id: answer._id },
          { $addToSet: { upvotes: voter._id }, $inc: { upvoteCount: 1 } },
        );
      } else {
        await AnswerModel.updateOne(
          { _id: answer._id },
          { $addToSet: { downvotes: voter._id }, $inc: { downvoteCount: 1 } },
        );
      }
      totalVotes++;
    }
  }

  return totalVotes;
}

// ── Phase 3: Net-positive boost for top-3 questions ───────────────────────────

async function boostTopQuestions(topIds: Set<string>, students: Student[]): Promise<void> {
  const topAnswers = await AnswerModel.find({ questionId: { $in: Array.from(topIds) } })
    .select('+upvotes +downvotes')
    .lean<AnswerDoc[]>();

  for (const answer of topAnswers) {
    const net = answer.upvoteCount - answer.downvoteCount;
    if (net >= 1) continue;

    const extraNeeded = 1 - net;
    const alreadyVoted = new Set([
      ...answer.upvotes.map((v) => v.toString()),
      ...answer.downvotes.map((v) => v.toString()),
    ]);

    const eligible = students.filter(
      (s) =>
        s._id.toString() !== answer.answeredBy.toString() && !alreadyVoted.has(s._id.toString()),
    );

    const boosters = shuffle(eligible).slice(0, Math.min(extraNeeded, eligible.length));
    for (const voter of boosters) {
      await AnswerModel.updateOne(
        { _id: answer._id },
        { $addToSet: { upvotes: voter._id }, $inc: { upvoteCount: 1 } },
      );
    }

    if (boosters.length > 0) {
      logger.info(
        { answerId: answer._id.toString().slice(-6), boosted: boosters.length },
        'Net-positive boost applied',
      );
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function seedInteractions(): Promise<void> {
  if (env.isProduction) {
    logger.error('Refusing to seed interactions in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  // Load all seeded students (both seed scripts share @samagama.test domain)
  const students = await UserModel.find(
    { email: /@samagama\.test$/, role: 'student' },
    '_id email',
  ).lean<Student[]>();

  if (students.length === 0) {
    logger.error(
      'No @samagama.test student accounts found. Run seed:accounts + seed:student-accounts first.',
    );
    await disconnectDatabase();
    process.exit(1);
  }
  logger.info({ count: students.length }, 'Seeded students loaded');

  // ── Phase 0 ───────────────────────────────────────────────────────────────────
  logger.info('=== Phase 0: Community questions ===');
  await ensureQuestions(students);

  // ── Phase 0.5 ────────────────────────────────────────────────────────────────
  logger.info('=== Phase 0.5: Personal questions ===');
  const defaultCategory = await CategoryModel.findOne({ isActive: { $ne: false } }).lean<{
    _id: Types.ObjectId;
  }>();
  if (defaultCategory) {
    await ensurePersonalQuestions(students, defaultCategory._id);
  } else {
    logger.warn('No category found — skipping personal question seeding');
  }

  // Reload community questions after potential creation
  const questions = await QuestionModel.find(
    {
      type: 'community',
      status: { $in: ['open', 'answered'] },
      isTrashed: { $ne: true },
    },
    '_id askedBy answerCount taggedStudents',
  ).lean<Question[]>();

  logger.info({ count: questions.length }, 'Community questions ready');

  // Top-3: most tagged students → highest demand → guaranteed net-positive votes
  const sorted = [...questions].sort(
    (a, b) => (b.taggedStudents?.length ?? 0) - (a.taggedStudents?.length ?? 0),
  );
  const topIds = new Set(sorted.slice(0, 3).map((q) => q._id.toString()));
  logger.info({ topIds: Array.from(topIds).map((id) => id.slice(-6)) }, 'Top-3 identified');

  // Select ~10 questions that will remain unanswered to simulate real-world engagement gaps.
  // Only candidates with 0 existing answers are eligible so already-answered questions are
  // never retroactively stripped of their answers on re-runs.
  const unansweredCandidates = questions.filter((q) => q.answerCount === 0);
  const unansweredCount = Math.min(UNANSWERED_QUESTION_COUNT, unansweredCandidates.length);
  const unansweredIds = new Set(
    shuffle(unansweredCandidates)
      .slice(0, unansweredCount)
      .map((q) => q._id.toString()),
  );
  logger.info(
    { unansweredCount, totalCommunity: questions.length },
    'Unanswered questions designated',
  );

  // ── Phase 1 ───────────────────────────────────────────────────────────────────
  logger.info('=== Phase 1: Answers ===');
  const newAnswers = await seedAnswers(questions, students, unansweredIds);
  logger.info({ newAnswers }, 'Phase 1 complete');

  // ── Phase 2 ───────────────────────────────────────────────────────────────────
  logger.info('=== Phase 2: Votes ===');
  const totalVotes = await seedVotes(questions, students, topIds);
  logger.info({ totalVotes }, 'Phase 2 complete');

  // ── Phase 3 ───────────────────────────────────────────────────────────────────
  logger.info('=== Phase 3: Net-positive boost ===');
  await boostTopQuestions(topIds, students);

  // ── Summary ───────────────────────────────────────────────────────────────────
  const personalCount = await QuestionModel.countDocuments({
    type: 'personal',
    isTrashed: { $ne: true },
  });
  const [totalAnswers, upAgg, downAgg] = await Promise.all([
    AnswerModel.countDocuments({ questionId: { $in: questions.map((q) => q._id) } }),
    AnswerModel.aggregate<{ total: number }>([
      { $match: { questionId: { $in: questions.map((q) => q._id) } } },
      { $group: { _id: null, total: { $sum: '$upvoteCount' } } },
    ]),
    AnswerModel.aggregate<{ total: number }>([
      { $match: { questionId: { $in: questions.map((q) => q._id) } } },
      { $group: { _id: null, total: { $sum: '$downvoteCount' } } },
    ]),
  ]);

  logger.info(
    {
      communityQuestions: questions.length,
      personalQuestions: personalCount,
      unansweredCommunity: unansweredCount,
      totalAnswers,
      newAnswersThisRun: newAnswers,
      totalUpvotes: upAgg[0]?.total ?? 0,
      totalDownvotes: downAgg[0]?.total ?? 0,
    },
    '✅ Interaction seeding complete',
  );

  await disconnectDatabase();
}

seedInteractions().catch(async (err) => {
  logger.error({ err }, 'seed-interactions failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
