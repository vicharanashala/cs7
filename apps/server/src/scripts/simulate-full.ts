// Complete student activity simulation for demo purposes.
// Creates community questions directly in MongoDB (no API rate limits),
// then uses the API for answers/voting with proper delays.
//
// Run: `npm run simulate:full`
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { UserModel } from '../models/User.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { CategoryModel } from '../models/Category.model.js';
import { signAccessToken } from '../utils/jwt.js';

const BASE_URL = process.env.API_BASE_URL ?? 'http://localhost:4000';

const STUDENT_EMAILS = [
  'aditya@samagama.test',
  'priya@samagama.test',
  'arjun@samagama.test',
  'sneha@samagama.test',
  'vikram@samagama.test',
  'kavya@samagama.test',
  'rohit@samagama.test',
  'ananya@samagama.test',
  'siddharth@samagama.test',
  'deepika@samagama.test',
  'karthik@samagama.test',
  'mythili@samagama.test',
  'naveen@samagama.test',
  'divya@samagama.test',
  'suresh@samagama.test',
  'meenakshi@samagama.test',
  'chandran@samagama.test',
  'lavanya@samagama.test',
  'balaji@samagama.test',
  'uma@samagama.test',
  'gopinath@samagama.test',
  'radhika@samagama.test',
  'venkat@samagama.test',
  'shakthi@samagama.test',
  'nandini@samagama.test',
];

const QUESTIONS: { title: string; description: string }[] = [
  {
    title: 'Dashboard still shows interview incomplete',
    description:
      'I completed my interview and Yaksha confirmed it, but my dashboard still shows "Incomplete". It has been more than 24 hours. When will the status update?',
  },
  {
    title: 'Portal shows Interview Interrupted after Yaksha',
    description:
      'Yaksha said my interview was completed successfully, but the portal shows "Interview Interrupted". The discrepancy is confusing — which status should I trust?',
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
      'My offer letter arrived but there is no link to the Phase 1 / Bronze course on the ViBe platform. When will I receive the course access link, and where should I look for it?',
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
      'How many leaves are we allowed during the internship? Are weekends counted as working days? Is there any provision for emergency or medical leave without it affecting the stipend?',
  },
  {
    title: 'Is the internship self-paced or fixed schedule',
    description:
      'I want to manage the internship alongside my college timetable. Are there mandatory fixed session timings, or can I complete tasks at my own pace within the day?',
  },
  {
    title: 'Are daily sessions on Zoom or Samagama dashboard',
    description:
      'I am unsure how daily sessions are conducted. Will I receive a Zoom link each day, or are sessions and assignments delivered through the Samagama portal dashboard?',
  },
  {
    title: 'Missed orientation — how to catch up',
    description:
      'I missed the orientation session due to a technical issue on my end. Is there a recording I can access? Will missing orientation affect my internship evaluation or standing?',
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
];

const ANSWER_BODIES = [
  'I had the same issue. What worked for me was contacting the support team via email.',
  'Based on my experience, you should check the spam folder first.',
  'I asked Yaksha about this and got a helpful response. Have you tried using the #escalate command?',
  'This is a common issue during onboarding. The best approach is to wait 24-48 hours.',
  'You need to complete all previous steps before this step unlocks.',
  'Go to your profile settings and re-upload the document. That should refresh the status.',
  'The team usually responds within 24-48 hours on working days.',
  'I was told this is normal for the first few days. It should resolve automatically.',
  'Try clearing your browser cache and logging in again. That fixed the issue for me.',
  'Some features work better on Chrome than Firefox — try switching browsers.',
  'The portal typically updates at midnight. Changes should reflect by tomorrow morning.',
  'I recommend posting in the community section — other students might have a working solution.',
  'Have you checked if your document matches the required format?',
  'The best approach is to raise a ticket through the portal itself.',
  'In my case, the issue was with the email ID format — make sure you use your college email.',
  'The best solution is to be patient — the system takes time to process everything.',
  'What worked for me was reaching out directly on the WhatsApp group.',
  'I noticed that the portal works best on Chrome. Try switching browsers.',
];

interface TokenCache {
  [email: string]: { accessToken: string; userId: string };
}

async function getStudentToken(email: string, cache: TokenCache) {
  if (cache[email]) return cache[email];
  const user = await UserModel.findOne({ email }).lean<{ _id: string; role: string }>();
  if (!user) throw new Error(`User not found: ${email}`);
  const accessToken = signAccessToken({ sub: user._id, role: user.role as 'student' });
  cache[email] = { accessToken, userId: user._id };
  return cache[email];
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function httpGet(url: string, token: string) {
  let retries = 0;
  while (retries < 5) {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) {
      retries++;
      await sleep(retries * 1500);
      continue;
    }
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    return res.json() as Promise<{ data: unknown }>;
  }
  throw new Error(`GET ${url} rate limited after 5 retries`);
}

async function httpPost(url: string, token: string, body: unknown) {
  let retries = 0;
  while (retries < 5) {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      retries++;
      await sleep(retries * 1500);
      continue;
    }
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<{ data: unknown }>;
  }
  throw new Error(`POST ${url} rate limited after 5 retries`);
}

async function httpPatch(url: string, token: string, body: unknown) {
  let retries = 0;
  while (retries < 5) {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      retries++;
      await sleep(retries * 1500);
      continue;
    }
    if (res.status === 204) return null;
    if (!res.ok) throw new Error(`PATCH ${url} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<{ data: unknown }>;
  }
  throw new Error(`PATCH ${url} rate limited after 5 retries`);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function simulate() {
  if (env.isProduction) {
    logger.error('Refusing to run simulation in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();
  const tokenCache: TokenCache = {};

  const students = await UserModel.find({ email: { $in: STUDENT_EMAILS } }).lean<
    { _id: string; email: string }[]
  >();
  if (students.length === 0)
    throw new Error('No student accounts. Run seed:student-accounts first.');
  logger.info({ count: students.length }, 'Fetched student accounts');

  const defaultCategory = await CategoryModel.findOne().lean<{ _id: string }>();
  if (!defaultCategory) throw new Error('No categories found. Please seed categories first.');
  logger.info({ categoryId: defaultCategory._id.toString() }, 'Fetched default category');

  const modToken = (await getStudentToken('kushagra@samagama.test', tokenCache)).accessToken;

  // ── Step 1: Reset existing data from previous runs ──────────────────────────
  logger.info('=== Resetting previous run data ===');
  const { AnswerModel } = await import('../models/Answer.model.js');
  const questionIds = await QuestionModel.find({ type: 'community' }).distinct('_id');
  // Delete all existing answers for community questions (fresh start)
  await AnswerModel.deleteMany({ questionId: { $in: questionIds } });
  await sleep(200);
  // Reset question counts, status, and tagged students
  await QuestionModel.updateMany(
    { type: 'community' },
    { status: 'open', answerCount: 0, taggedStudents: [] },
  );
  logger.info(
    'Reset complete — all community questions open, answers deleted, taggedStudents cleared',
  );

  // ── Step 2: Create community questions directly in MongoDB ─────────────────
  logger.info('=== Creating community questions (direct MongoDB) ===');
  const shuffledQuestions = shuffle([...QUESTIONS]);
  const shuffledStudents = shuffle(students);
  const createdQuestionIds: string[] = [];

  for (let i = 0; i < shuffledQuestions.length; i++) {
    const student = shuffledStudents[i % shuffledStudents.length];
    const { title, description } = shuffledQuestions[i];

    const existing = await QuestionModel.findOne({ title, type: 'community' }).lean();
    if (existing) {
      logger.info({ title: title.slice(0, 40) }, 'Already exists — skipping');
      createdQuestionIds.push(existing._id.toString());
      continue;
    }

    const q = await QuestionModel.create({
      title,
      description,
      type: 'community',
      status: 'open',
      category: defaultCategory._id,
      askedBy: student._id,
      answerCount: 0,
      viewCount: 0,
    });
    createdQuestionIds.push(q._id.toString());
    logger.info({ questionId: q._id.toString(), title: title.slice(0, 50) }, 'Created');
    await sleep(30);
  }

  logger.info({ created: createdQuestionIds.length }, 'Community questions created');

  // ── Step 2.5: Tag multiple students onto select questions ──────────────────
  // Simulates the realistic case where many students have the same question.
  // Distribution: [12, 10, 8, 7, 5, 3, 2] tagged students on the first 7 questions.
  logger.info('=== Tagging students onto questions ===');
  const TAG_DISTRIBUTION = [12, 10, 8, 7, 5, 3, 2];

  for (let i = 0; i < Math.min(TAG_DISTRIBUTION.length, createdQuestionIds.length); i++) {
    const questionId = createdQuestionIds[i];
    const count = TAG_DISTRIBUTION[i];
    const taggedIds = shuffle(students)
      .slice(0, count)
      .map((s) => s._id);
    await QuestionModel.updateOne({ _id: questionId }, { $set: { taggedStudents: taggedIds } });
    logger.info({ questionId: questionId.slice(-6), taggedCount: count }, 'Students tagged');
    await sleep(20);
  }
  logger.info('Tagging complete');

  // ── Step 3: Fetch all community questions to get their IDs and answer counts ─
  await sleep(1000);
  const allQuestionsData = (await httpGet('/api/qna/questions?type=community', modToken)) as {
    data: { id: string; title: string; answerCount: number; status: string }[];
  };
  const openQuestions = allQuestionsData.data.filter(
    (q) => q.status === 'open' || q.status === 'answered',
  );

  // Top 3 by answerCount (or just first 3 if no answers yet)
  const topQuestions = [...openQuestions].sort((a, b) => b.answerCount - a.answerCount).slice(0, 3);
  const otherQuestions = openQuestions.filter((q) => !topQuestions.find((t) => t.id === q.id));

  logger.info({ total: openQuestions.length, topIds: topQuestions.map((q) => q.id.slice(-6)) });

  // ── Step 4: Post answers via API (3-5 per question) ───────────────────────
  logger.info('=== Posting answers (3-5 per question) ===');
  const shuffledForAnswers = shuffle(students);

  for (const q of openQuestions) {
    const isTop = topQuestions.some((t) => t.id === q.id);
    const numRespondents = isTop ? 5 : 3 + Math.floor(Math.random() * 2);
    const respondents = shuffle(shuffledForAnswers).slice(0, numRespondents);

    for (const student of respondents) {
      const { accessToken } = await getStudentToken(student.email, tokenCache);
      const body = pickRandom(ANSWER_BODIES);
      try {
        await httpPost(`/api/qna/questions/${q.id}/answers`, accessToken, { body });
        logger.info({ student: student.email, questionId: q.id.slice(-6) }, 'Answer posted');
      } catch (e) {
        logger.warn({ err: (e as Error).message, student: student.email });
      }
      await sleep(300);
    }
  }

  // ── Step 5: Vote on newly created answers (using allowPending=true) ──────────
  const allAnswersForVoting: { id: string; questionId: string }[] = [];

  for (const q of openQuestions) {
    const pendingData = (await httpGet(
      `/api/moderation/questions/${q.id}/pending-answers?limit=10`,
      modToken,
    )) as { data: { id: string }[] };
    for (const a of pendingData.data) {
      allAnswersForVoting.push({ id: a.id, questionId: q.id });
    }
    await sleep(100);
  }
  logger.info({ answerCount: allAnswersForVoting.length }, 'Pending answers found for voting');

  logger.info('=== Voting on pending answers ===');
  await sleep(500);

  const votingStudents = shuffle(students).slice(0, 18);

  for (const answer of allAnswersForVoting) {
    const isTop = topQuestions.some((t) => t.id === answer.questionId);
    const numVoters = isTop ? 6 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 2);
    const voters = shuffle(votingStudents).slice(0, numVoters);

    for (const voter of voters) {
      const { accessToken } = await getStudentToken(voter.email, tokenCache);
      const direction = Math.random() < 0.8 ? 'up' : 'down';
      try {
        // Use allowPending=true so voting works on pending answers
        await httpPost(
          `/api/qna/answers/${answer.id}/vote/${direction}?allowPending=true`,
          accessToken,
          {},
        );
      } catch {
        /* own answer or already voted */
      }
    }
    await sleep(50);
  }

  // ── Step 5: Ensure top 3 questions have net positive votes ─────────────────
  logger.info('=== Ensuring top 3 have net positive votes ===');
  await sleep(500);
  for (const q of topQuestions) {
    const answersData = (await httpGet(`/api/qna/questions/${q.id}/answers`, modToken)) as {
      data: { id: string; upvoteCount: number; downvoteCount: number }[];
    };
    for (const a of answersData.data) {
      if (a.downvoteCount > a.upvoteCount) {
        const extra = a.downvoteCount - a.upvoteCount + 1;
        const extraVoters = shuffle(votingStudents).slice(0, extra);
        for (const voter of extraVoters) {
          const { accessToken } = await getStudentToken(voter.email, tokenCache);
          try {
            await httpPost(`/api/qna/answers/${a.id}/vote/up?allowPending=true`, accessToken, {});
          } catch {
            /* ignore */
          }
          await sleep(50);
        }
      }
    }
  }

  await disconnectDatabase();
  logger.info(
    {
      questionsCreated: createdQuestionIds.length,
      totalQuestions: openQuestions.length,
      topQuestionIds: topQuestions.map((q) => q.id),
      totalAnswers: allAnswersForVoting.length,
      votingStudents: votingStudents.length,
    },
    '✅ Full simulation complete.',
  );
}

simulate().catch(async (err) => {
  logger.error({ err }, 'Simulation failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
