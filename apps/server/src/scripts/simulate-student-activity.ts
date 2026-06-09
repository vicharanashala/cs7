// Simulates realistic student activity for demo purposes:
// - Posts questions (with check-existing flow to test FAQ matching)
// - When FAQ match is found: records "helpful" feedback to link student to that FAQ
// - When community match is found: tags onto existing question
// - When no match: creates new community question
// - Posts 3-5 community answers per question
// - Upvotes/downvotes on approved answers
// - Top 3 questions get noticeably higher engagement and net positive votes
//
// Run AFTER seeding student accounts: `npm run simulate:student-activity`
// The server must be running locally (默认: http://localhost:4000).
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { UserModel } from '../models/User.model.js';
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

const QUESTIONS = [
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

const ANSWER_BODIES = [
  'I had the same issue. What worked for me was contacting the support team via email. They resolved it within 24 hours.',
  'Based on my experience, you should check the spam folder first. The emails sometimes land there.',
  'I asked Yaksha about this and got a helpful response. Have you tried using the #escalate command?',
  'This is a common issue during onboarding. I faced it too. The best approach is to wait 24-48 hours and then follow up.',
  'From what I understand, you need to complete all previous steps before this step unlocks. Make sure you have finished everything.',
  'I found the solution — go to your profile settings and re-upload the document. That should refresh the status.',
  'The team usually responds within 24-48 hours on working days. If it has been longer, try emailing directly.',
  'I had a similar concern and was told that this is normal for the first few days. It should resolve automatically.',
  'Try clearing your browser cache and logging in again. That fixed the issue for me.',
  'You can try using a different browser. Some features work better on Chrome than Firefox.',
  'The portal typically updates at midnight. Any changes you made today should reflect by tomorrow morning.',
  'I recommend posting in the community section — other students who faced the same issue might have a working solution.',
  'Have you checked if your college NOC matches the required format? Sometimes the issue is with the document itself.',
  'The best approach is to raise a ticket through the portal itself. The support team monitors those closely.',
  'In my case, the issue was with the email ID format. Make sure you use your college email and not a personal one.',
  'I was in a similar situation last week. The best solution is to be patient — the system takes time to process everything.',
  'What worked for me was reaching out directly on the WhatsApp group. The moderators are very responsive there.',
  'I noticed that the portal works best on Chrome. If you are using Firefox or Safari, try switching browsers.',
];

interface TokenCache {
  [email: string]: { accessToken: string; userId: string };
}

async function getStudentToken(
  email: string,
  _password: string,
  cache: TokenCache,
): Promise<{ accessToken: string; userId: string }> {
  if (cache[email]) return cache[email];

  // Fetch user from DB directly and sign token locally to avoid rate limiting
  const user = await UserModel.findOne({ email }).lean<{ _id: string; role: string }>();
  if (!user) throw new Error(`User not found: ${email}`);
  const accessToken = signAccessToken({ sub: user._id, role: user.role as 'student' });
  cache[email] = { accessToken, userId: user._id };
  return cache[email];
}

async function get(url: string, token: string) {
  let retries = 0;
  while (retries < 3) {
    const res = await fetch(`${BASE_URL}${url}`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 429) {
      retries++;
      await new Promise((r) => setTimeout(r, retries * 1000));
      continue;
    }
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
    return res.json() as Promise<{ data: unknown }>;
  }
  throw new Error(`GET ${url} failed after 3 retries due to rate limiting`);
}

/** Handles both JSON responses and 204 No Content */
async function post(url: string, token: string, body: unknown) {
  let retries = 0;
  while (retries < 3) {
    const res = await fetch(`${BASE_URL}${url}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status === 429) {
      retries++;
      await new Promise((r) => setTimeout(r, retries * 1000));
      continue;
    }
    if (res.status === 204) return { data: null };
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${await res.text()}`);
    return res.json() as Promise<{ data: unknown }>;
  }
  throw new Error(`POST ${url} failed after 3 retries due to rate limiting`);
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
    logger.error('Refusing to run student simulation in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  const tokenCache: TokenCache = {};
  const PASSWORD = 'Student@2026';

  // Pre-fetch all student user IDs
  const students = await UserModel.find({ email: { $in: STUDENT_EMAILS } })
    .select('_id email')
    .lean<{ _id: string; email: string }[]>();
  logger.info({ count: students.length }, 'Fetched student accounts');

  // ── Step 0: Fetch categories so we can assign one to new questions ─────────
  const modToken = (await getStudentToken('kushagra@samagama.test', 'Moderator@2026', tokenCache))
    .accessToken;
  const categoriesData = (await get('/api/categories', modToken)) as {
    data: { _id: string; name: string }[];
  };
  const categories = categoriesData.data;
  const defaultCategoryId = categories[0]?._id;
  logger.info({ categories: categories.length, defaultCategoryId }, 'Fetched categories');

  if (!defaultCategoryId) {
    throw new Error('No categories found in database. Please seed categories first.');
  }

  // ── Step 1: Students post questions (with check-existing workflow) ──────────
  logger.info('=== Posting questions (with check-existing workflow) ===');

  const stats = { faqLinked: 0, questionTagged: 0, questionCreated: 0 };
  const createdQuestions: { id: string; authorId: string }[] = [];

  const shuffledStudents = shuffle(students);
  const shuffledQuestions = shuffle([...QUESTIONS]);

  for (let i = 0; i < shuffledQuestions.length; i++) {
    const student = shuffledStudents[i % shuffledStudents.length];
    const q = shuffledQuestions[i];
    const { accessToken } = await getStudentToken(student.email, PASSWORD, tokenCache);

    // Run check-existing (required before creating a question)
    const checkData = (await post('/api/qna/check-existing', accessToken, {
      title: q.title,
      description: q.description,
    })) as {
      data: {
        token: string;
        matchedFaqs: { id: string; title: string }[];
        matchedQuestions: { id: string }[];
      };
    };

    const { token, matchedFaqs, matchedQuestions } = checkData.data;

    // Route 1: FAQ match found → link student to that FAQ (record "helpful" feedback)
    if (matchedFaqs && matchedFaqs.length > 0) {
      const faqId = matchedFaqs[0].id;
      logger.info(
        { student: student.email, faqId, question: q.title },
        'FAQ match — linking student to FAQ',
      );
      try {
        // Record view + submit "helpful" feedback = student said "this answered my question"
        await post(`/api/faqs/${faqId}/view`, accessToken, {});
        await post(`/api/faqs/${faqId}/feedback`, accessToken, { rating: 'helpful' });
        stats.faqLinked++;
        logger.info({ student: student.email, faqId }, 'Successfully linked to FAQ');
      } catch (e) {
        logger.warn(
          { err: (e as Error).message, student: student.email, faqId },
          'FAQ link failed',
        );
      }
      continue;
    }

    // Route 2: Community question match found → tag onto existing question
    if (matchedQuestions && matchedQuestions.length > 0) {
      const existingQ = matchedQuestions[0];
      logger.info(
        { student: student.email, existingQuestionId: existingQ.id },
        'Community match — tagging existing question',
      );
      try {
        await post(`/api/qna/questions/${existingQ.id}/tag-me`, accessToken, {
          existingAnswerCheckToken: token,
        });
        stats.questionTagged++;
        logger.info(
          { student: student.email, questionId: existingQ.id },
          'Successfully tagged existing question',
        );
      } catch (e) {
        logger.warn(
          { err: (e as Error).message, student: student.email, questionId: existingQ.id },
          'Tag failed',
        );
        // Fall through to create new question
        const created = (await post('/api/qna/questions', accessToken, {
          title: q.title,
          description: q.description,
          type: 'community',
          category: defaultCategoryId,
          existingAnswerCheckToken: token,
        })) as { data: { id: string } };
        createdQuestions.push({ id: created.data.id, authorId: student.email });
        stats.questionCreated++;
      }
      continue;
    }

    // Route 3: No match → create new community question
    const created = (await post('/api/qna/questions', accessToken, {
      title: q.title,
      description: q.description,
      type: 'community',
      category: defaultCategoryId,
      existingAnswerCheckToken: token,
    })) as { data: { id: string } };
    createdQuestions.push({ id: created.data.id, authorId: student.email });
    stats.questionCreated++;
    logger.info(
      { student: student.email, questionId: created.data.id },
      'New community question created',
    );

    await new Promise((r) => setTimeout(r, 200));
  }

  logger.info({ stats }, 'Question posting complete');

  await new Promise((r) => setTimeout(r, 500));

  // ── Step 2: Get all open community questions ────────────────────────────────
  const questionsData = (await get('/api/qna/questions?type=community', modToken)) as {
    data: { id: string; title: string; answerCount: number; status: string }[];
  };
  const openQuestions = questionsData.data.filter(
    (q) => q.status === 'open' || q.status === 'answered',
  );

  // Sort by answerCount desc to identify top 3 for the moderator dashboard demo
  const sortedByActivity = [...openQuestions].sort((a, b) => b.answerCount - a.answerCount);
  const topQuestions = sortedByActivity.slice(0, 3);
  const otherQuestions = sortedByActivity.slice(3);

  logger.info(
    {
      totalQuestions: openQuestions.length,
      topQuestionIds: topQuestions.map((q) => q.id),
    },
    'Identified top questions for engagement',
  );

  await new Promise((r) => setTimeout(r, 1000));

  // ── Step 3: Post answers (3-5 per question, as per spec) ───────────────────
  logger.info('=== Posting answers (3-5 per question) ===');

  async function postAnswers(questionId: string, respondentEmails: string[]) {
    // 3-5 answers per question
    const numAnswers = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
    for (let a = 0; a < Math.min(numAnswers, respondentEmails.length); a++) {
      const { accessToken } = await getStudentToken(respondentEmails[a], PASSWORD, tokenCache);
      const body = pickRandom(ANSWER_BODIES);
      try {
        await post(`/api/qna/questions/${questionId}/answers`, accessToken, { body });
        logger.info({ student: respondentEmails[a], questionId }, 'Answer posted');
      } catch (e) {
        logger.warn({ err: (e as Error).message, student: respondentEmails[a], questionId });
      }
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  // Top questions get 5 respondents (each posts 1 answer = 3-5 total per question)
  for (const q of topQuestions) {
    const respondents = shuffle(students).slice(0, 5);
    await postAnswers(
      q.id,
      respondents.map((s) => s.email),
    );
  }

  // Other questions get 3-4 respondents
  for (const q of otherQuestions) {
    const numRespondents = 3 + Math.floor(Math.random() * 2);
    const respondents = shuffle(students).slice(0, numRespondents);
    await postAnswers(
      q.id,
      respondents.map((s) => s.email),
    );
  }

  // ── Step 4: Vote on pending answers (no approval — moderators review manually) ──
  logger.info('=== Voting on pending answers ===');

  const allPendingAnswers: { id: string; questionId: string }[] = [];
  for (const q of openQuestions) {
    const answersData = (await get(
      `/api/moderation/questions/${q.id}/pending-answers?limit=10`,
      modToken,
    )) as { data: { id: string }[] };
    allPendingAnswers.push(...answersData.data.map((a) => ({ id: a.id, questionId: q.id })));
  }
  logger.info({ count: allPendingAnswers.length }, 'Pending answers found for voting');

  // 18 of 25 students participate in voting
  const votingStudents = shuffle(students).slice(0, 18);
  const netVotes: Record<string, number> = {};

  for (const answer of allPendingAnswers) {
    const isTopQuestion = topQuestions.some((q) => q.id === answer.questionId);
    const numVoters = isTopQuestion
      ? 5 + Math.floor(Math.random() * 4) // 5-8 voters for top questions
      : 3 + Math.floor(Math.random() * 3); // 3-5 voters for others

    const voters = shuffle(votingStudents).slice(0, numVoters);
    netVotes[answer.id] = 0;

    for (const voter of voters) {
      const { accessToken } = await getStudentToken(voter.email, PASSWORD, tokenCache);
      const direction = Math.random() < 0.8 ? 'up' : 'down';
      try {
        await post(
          `/api/qna/answers/${answer.id}/vote/${direction}?allowPending=true`,
          accessToken,
          {},
        );
        netVotes[answer.id] += direction === 'up' ? 1 : -1;
      } catch {
        /* own answer or already voted */
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  // ── Step 5: Ensure top 3 questions have net positive votes ─────────────────
  logger.info('=== Ensuring top 3 questions have net positive votes ===');
  for (const q of topQuestions) {
    const topAnswers = allPendingAnswers.filter((a) => a.questionId === q.id);
    for (const answer of topAnswers) {
      const net = netVotes[answer.id] ?? 0;
      if (net <= 0) {
        const extraNeeded = Math.abs(net) + 1;
        const extraVoters = shuffle(votingStudents).slice(0, extraNeeded);
        for (const voter of extraVoters) {
          const { accessToken } = await getStudentToken(voter.email, PASSWORD, tokenCache);
          try {
            await post(`/api/qna/answers/${answer.id}/vote/up?allowPending=true`, accessToken, {});
          } catch {
            /* ignore */
          }
          await new Promise((r) => setTimeout(r, 50));
        }
      }
    }
  }

  await disconnectDatabase();
  logger.info('✅ Student activity simulation complete.');
  logger.info({
    questionPosting: stats,
    totalQuestions: openQuestions.length,
    topQuestionIds: topQuestions.map((q) => q.id),
    totalAnswersPosted: allPendingAnswers.length,
    votingStudents: votingStudents.length,
  });
}

simulate().catch(async (err) => {
  logger.error({ err }, 'Student simulation failed');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
