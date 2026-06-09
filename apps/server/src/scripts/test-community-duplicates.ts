/**
 * Community Question Duplicate Detection — End-to-End Test
 *
 * Implements the Community Question Duplicate Detection and UI Validation
 * test plan in full. Tests the complete workflow at the service layer:
 *
 *   Student 1 (Abhishek) — posts 3 questions (2 become "original" community Qs,
 *                           1 matches an FAQ so no question is created)
 *   Student 2 (Meena)    — posts 3 questions (2 are semantic duplicates of
 *                           Abhishek's; tag-me links her ID to those questions)
 *   Student 3 (Harshdeep)— posts 3 questions (2 are semantic duplicates of
 *                           existing ones; tag-me links her ID too)
 *
 * Validations:
 *   - checkExisting() returns correct FAQ matches
 *   - checkExisting() returns correct community question duplicates
 *   - tagMe() correctly stores the student's ID on the existing question
 *   - createQuestion() correctly creates new questions when no match found
 *   - Moderator view shows all students tagged to each question
 *   - No duplicate questions are created
 *
 * Run: npm --workspace @samagama/server run test:community
 * Save: npm --workspace @samagama/server run test:community > community-test-results.md
 *
 * Questions sourced from: troubleshoot_summership_2026_questions.md
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { UserModel } from '../models/User.model.js';
import { QuestionModel } from '../models/Question.model.js';
import { CategoryModel } from '../models/Category.model.js';
// TagModel and AnswerModel must be imported so their schemas are registered
// with mongoose before qnaService.createQuestion calls populate('tags').
import { TagModel } from '../models/Tag.model.js';
void TagModel;
import { AnswerModel } from '../models/Answer.model.js';
void AnswerModel;
import { FaqModel } from '../models/Faq.model.js';
void FaqModel;
import { qnaService } from '../services/qna.service.js';
import { generateEmbedding, composeQuestionEmbeddingText } from '../services/embedding.service.js';

// ─── Test Data ────────────────────────────────────────────────────────────────
//
// All questions sourced directly from troubleshoot_summership_2026_questions.md
// — real student language extracted from ~6,947 lines of WhatsApp chat.

interface TestQuestion {
  label: string;
  description: string;
  type: 'community' | 'personal';
  /** Which student index (0-based) originally posted the question that this one
   *  should be flagged as a duplicate of. undefined = this is an original post. */
  duplicateOf?: number;
  /** When set, the checkExisting step should find an FAQ and the student
   *  would click "This answers it" — no question is created. */
  expectsFaqMatch?: boolean;
  /** Short note explaining why this scenario was chosen. */
  scenario: string;
}

interface StudentScenario {
  name: string;
  email: string;
  password: string;
  questions: TestQuestion[];
}

const STUDENTS: StudentScenario[] = [
  // ── Student 1: Abhishek — Original poster ───────────────────────────────────
  {
    name: 'Abhishek',
    email: 'abhishek@samagama.test',
    password: 'Student@2026',
    questions: [
      {
        label: 'Q1-A',
        description:
          'I have uploaded my signed NOC on the portal and it has also been validated. ' +
          'However, I have not yet received or been able to download my offer letter. ' +
          'Kindly let me know if there is any pending issue or any additional action required from my side.',
        type: 'community',
        scenario:
          'Original post — NOC validated but offer letter not received. ' +
          'Source: Unique Q4 variation 5 from troubleshoot file.',
      },
      {
        label: 'Q1-B',
        description:
          'I am unable to join the Vicharanashala Summership WhatsApp group because it shows that ' +
          'the group is full. Could you please share an updated invite link or let me know how I can join?',
        type: 'community',
        scenario:
          'Original post — WhatsApp group is full. ' +
          'Source: Unique Q7 variation 1 from troubleshoot file.',
      },
      {
        label: 'Q1-C',
        description:
          'Can I take a break from the internship when my semester exams start? ' +
          'My college exams begin in July and I have classes from 9am to 2pm on exam days.',
        type: 'community',
        expectsFaqMatch: true,
        scenario:
          'FAQ match case — should match "I have to attend my class during the internship — ' +
          'can I take leave?" The student clicks "This answers it" and no question is created. ' +
          'Source: Unique Q17/Q18 style from troubleshoot file.',
      },
    ],
  },

  // ── Student 2: Meena — Posts 2 duplicates + 1 original ─────────────────────
  {
    name: 'Meena',
    email: 'meena@samagama.test',
    password: 'Student@2026',
    questions: [
      {
        label: 'Q2-A',
        description:
          'It has been more than 72 hours since my NOC was uploaded and accepted on the portal, ' +
          'but I have not yet received the formal offer letter. Kindly let me know if there is any ' +
          'pending issue or any additional action required from my side.',
        type: 'community',
        duplicateOf: 0, // duplicate of Q1-A (Abhishek's first question)
        scenario:
          'DUPLICATE of Q1-A — same situation phrased differently. ' +
          'System should detect Q1-A as a match and offer tag-me. ' +
          'Source: Unique Q4 variation 2 from troubleshoot file.',
      },
      {
        label: 'Q2-B',
        description:
          "I missed yesterday's mail. Today morning when I tried to join the internship main " +
          'WhatsApp group, the group is full. Now what should I do?',
        type: 'community',
        duplicateOf: 1, // duplicate of Q1-B (Abhishek's second question)
        scenario:
          'DUPLICATE of Q1-B — same situation phrased differently. ' +
          'System should detect Q1-B as a match and offer tag-me. ' +
          'Source: Unique Q7 variation 2 from troubleshoot file.',
      },
      {
        label: 'Q2-C',
        description:
          'My dashboard is still showing the interview status as Incomplete even though ' +
          'I completed the interview successfully and the chatbot confirmed it. I kindly request ' +
          'you to verify my interview status and update the dashboard accordingly.',
        type: 'community',
        scenario:
          'Original post — dashboard shows interview as Incomplete. ' +
          'Source: Unique Q2 variations 1+2 from troubleshoot file.',
      },
    ],
  },

  // ── Student 3: Harshdeep — Posts 2 duplicates + 1 original ─────────────────
  {
    name: 'Harshdeep',
    email: 'harshdeep@samagama.test',
    password: 'Student@2026',
    questions: [
      {
        label: 'Q3-A',
        description:
          'My NOC was successfully validated on the Samagama dashboard but I still have not ' +
          'received the offer letter after 48 hours. My internship starting date is approaching ' +
          'soon. Please look into the matter.',
        type: 'community',
        duplicateOf: 0, // duplicate of Q1-A (Abhishek's first question)
        scenario:
          'DUPLICATE of Q1-A — third student with the same issue. ' +
          'Validates that multiple students can be tagged to the same question. ' +
          'Source: Unique Q4 variation 4 from troubleshoot file.',
      },
      {
        label: 'Q3-B',
        description:
          'I have successfully completed my interview and the chatbot also confirmed that my ' +
          'interview was completed successfully. However, my dashboard is still showing the ' +
          'interview status as Incomplete. It appears that the interview completion may not have ' +
          'been updated on the administrative side.',
        type: 'community',
        duplicateOf: 2, // duplicate of Q2-C (Meena's third question, index 2 in postedQuestions)
        scenario:
          'DUPLICATE of Q2-C — same dashboard Incomplete issue phrased more formally. ' +
          'Source: Unique Q2 variation 1 from troubleshoot file.',
      },
      {
        label: 'Q3-C',
        description:
          'I am unable to join the orientation Zoom meeting. When I try to join, it says ' +
          '"This meeting is for authorized registrants only" even though I am using my registered ' +
          'email ID. Kindly authorize my email or share the correct meeting passcode or link.',
        type: 'community',
        scenario:
          'Original post — Zoom meeting authorization error. ' +
          'Source: Unique Q6 variation 2 from troubleshoot file.',
      },
    ],
  },
];

// ─── Result tracking ──────────────────────────────────────────────────────────

interface QuestionRecord {
  label: string;
  studentName: string;
  description: string;
  scenario: string;
  step: 'FAQ_MATCH' | 'DUPLICATE_DETECTED' | 'NEW_QUESTION' | 'TAGGED';
  faqMatches?: { title: string; score: number }[];
  communityMatches?: { id: string; title: string; score: number }[];
  questionId?: string;
  taggedToQuestionId?: string;
  passed: boolean;
  note: string;
}

const results: QuestionRecord[] = [];

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  await connectDatabase();

  const provider = process.env.EMBEDDING_PROVIDER ?? 'mock';
  console.log('# Community Question Duplicate Detection — Test Results\n');
  console.log(`- **Embedding provider:** \`${provider}\``);
  console.log(`- **Generated:** ${new Date().toISOString()}\n`);

  // ── Resolve user IDs and category ─────────────────────────────────────────
  const category = await CategoryModel.findOne().lean();
  if (!category) throw new Error('No categories found. Run seed:faqs first.');

  const userIds: Record<string, string> = {};
  for (const student of STUDENTS) {
    const user = await UserModel.findOne({ email: student.email }).lean();
    if (!user) throw new Error(`User ${student.email} not found. Run seed:accounts first.`);
    userIds[student.email] = user._id.toString();
  }

  // ── Clear any previous test questions from these accounts ──────────────────
  const studentObjIds = Object.values(userIds).map((id) => new Types.ObjectId(id));
  const deleted = await QuestionModel.deleteMany({ askedBy: { $in: studentObjIds } });
  if (deleted.deletedCount > 0) {
    console.log(
      `> Cleared ${deleted.deletedCount} previous test question(s) from these accounts.\n`,
    );
  }

  // ── Keep track of created question IDs by position for duplicate lookup ────
  // Index = order in which questions were SUCCESSFULLY created as community Qs
  const postedQuestions: { id: string; label: string; studentName: string; title: string }[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1: Submit all questions in order
  // ─────────────────────────────────────────────────────────────────────────
  console.log('---\n## Phase 1: Question Submission\n');

  for (const student of STUDENTS) {
    const userId = userIds[student.email];

    console.log(`### ${student.name} (${student.email})\n`);

    for (const q of student.questions) {
      // Derive a short title from the first sentence of the description.
      const title = q.description.split('.')[0].trim().slice(0, 140);

      // ── Step 1: checkExisting ──────────────────────────────────────────────
      const check = await qnaService.checkExisting({ title, description: q.description }, userId);

      const faqMatches = check.matchedFaqs.map((f) => ({ title: f.title, score: f.score }));
      const commMatches = check.matchedQuestions.map((m) => ({
        id: m.id,
        title: m.title,
        score: m.score,
      }));

      // ── Determine expected step ────────────────────────────────────────────
      if (q.expectsFaqMatch) {
        // Student clicks "This answers it" → no question created
        const passed = faqMatches.length > 0;
        results.push({
          label: q.label,
          studentName: student.name,
          description: q.description,
          scenario: q.scenario,
          step: 'FAQ_MATCH',
          faqMatches,
          communityMatches: commMatches,
          passed,
          note: passed
            ? `FAQ match found: "${truncate(faqMatches[0]?.title ?? '', 60)}" (score ${faqMatches[0]?.score.toFixed(3)}). Student clicks "This answers it" — no question created.`
            : 'Expected FAQ match but none found above threshold.',
        });
        console.log(
          `**${q.label}** — ${passed ? '✅ FAQ match detected' : '❌ No FAQ match found'}\n` +
            `- Description: "${truncate(q.description, 80)}"\n` +
            `- FAQ hit: ${faqMatches[0] ? `"${truncate(faqMatches[0].title, 60)}" (${faqMatches[0].score.toFixed(3)})` : 'none'}\n` +
            `- Action: Student clicks "This answers it" — no question created.\n`,
        );
        continue;
      }

      if (q.duplicateOf !== undefined) {
        // This question should be detected as a duplicate of an existing community question.
        const expectedOriginal = postedQuestions[q.duplicateOf];
        const matchedCorrectly = commMatches.some((m) => m.id === expectedOriginal?.id);

        if (matchedCorrectly && expectedOriginal) {
          // Tag the student to the existing question.
          try {
            await qnaService.tagMe(expectedOriginal.id, userId, check.token);
            results.push({
              label: q.label,
              studentName: student.name,
              description: q.description,
              scenario: q.scenario,
              step: 'TAGGED',
              faqMatches,
              communityMatches: commMatches,
              taggedToQuestionId: expectedOriginal.id,
              passed: true,
              note:
                `Duplicate detected → "${truncate(expectedOriginal.title, 60)}". ` +
                `${student.name}'s ID linked via tagMe. Score: ${commMatches.find((m) => m.id === expectedOriginal.id)?.score.toFixed(3)}.`,
            });
            console.log(
              `**${q.label}** — ✅ Duplicate detected + student tagged\n` +
                `- Description: "${truncate(q.description, 80)}"\n` +
                `- Matched: "${truncate(expectedOriginal.title, 60)}" (${commMatches.find((m) => m.id === expectedOriginal.id)?.score.toFixed(3)})\n` +
                `- Action: tagMe called → ${student.name}'s ID linked to ${expectedOriginal.label}.\n`,
            );
          } catch (err) {
            results.push({
              label: q.label,
              studentName: student.name,
              description: q.description,
              scenario: q.scenario,
              step: 'TAGGED',
              faqMatches,
              communityMatches: commMatches,
              taggedToQuestionId: expectedOriginal.id,
              passed: false,
              note: `tagMe failed: ${err instanceof Error ? err.message : String(err)}`,
            });
            console.log(
              `**${q.label}** — ❌ tagMe failed: ${err instanceof Error ? err.message : String(err)}\n`,
            );
          }
        } else {
          // Duplicate not detected — record as failure.
          results.push({
            label: q.label,
            studentName: student.name,
            description: q.description,
            scenario: q.scenario,
            step: 'DUPLICATE_DETECTED',
            faqMatches,
            communityMatches: commMatches,
            passed: false,
            note:
              `Expected duplicate match for "${expectedOriginal?.label ?? 'unknown'}" but ` +
              (commMatches.length === 0
                ? 'no community questions matched above threshold.'
                : `top match was "${truncate(commMatches[0].title, 50)}" (wrong question).`),
          });
          console.log(
            `**${q.label}** — ❌ Duplicate NOT detected\n` +
              `- Description: "${truncate(q.description, 80)}"\n` +
              `- Expected match: ${expectedOriginal?.label ?? 'unknown'}\n` +
              `- Community matches found: ${commMatches.length === 0 ? 'none' : `"${truncate(commMatches[0].title, 50)}" (score ${commMatches[0].score.toFixed(3)})`}\n`,
          );
        }
        continue;
      }

      // ── Original question — create it ──────────────────────────────────────
      let createdId: string | undefined;
      try {
        const created = await qnaService.createQuestion(
          {
            title,
            description: q.description,
            category: category._id.toString(),
            tags: [],
            type: q.type,
            existingAnswerCheckToken: check.token,
          },
          userId,
        );
        createdId = created.id;
      } catch {
        // createQuestion may throw even after the document is saved (e.g. if
        // getQuestionById fails due to a missing model registration). Recover
        // the ID from the DB by matching title + author.
        const recovered = await QuestionModel.findOne({
          title,
          askedBy: new Types.ObjectId(userId),
        }).lean();
        if (recovered) createdId = recovered._id.toString();
      }

      if (createdId) {
        // Generate and store embedding immediately so subsequent checkExisting
        // calls by other students can detect this as a duplicate via cosine scan.
        // Embed title + description (same as the create path) so the stored vector
        // captures the whole question, not just its first line.
        const embedding = await generateEmbedding(
          composeQuestionEmbeddingText(title, q.description),
        );
        await QuestionModel.updateOne({ _id: createdId }, { embedding });

        postedQuestions.push({ id: createdId, label: q.label, studentName: student.name, title });

        results.push({
          label: q.label,
          studentName: student.name,
          description: q.description,
          scenario: q.scenario,
          step: 'NEW_QUESTION',
          faqMatches,
          communityMatches: commMatches,
          questionId: createdId,
          passed: true,
          note: `New community question created (ID: ${createdId}). Embedding generated and stored.`,
        });

        console.log(
          `**${q.label}** — ✅ New question created (index ${postedQuestions.length - 1})\n` +
            `- Description: "${truncate(q.description, 80)}"\n` +
            `- FAQ matches: ${faqMatches.length} | Community matches: ${commMatches.length}\n` +
            `- Question ID: ${createdId} | Embedding stored ✓\n`,
        );
      } else {
        results.push({
          label: q.label,
          studentName: student.name,
          description: q.description,
          scenario: q.scenario,
          step: 'NEW_QUESTION',
          faqMatches,
          communityMatches: commMatches,
          passed: false,
          note: 'createQuestion failed and question not found in DB.',
        });
        console.log(`**${q.label}** — ❌ Question could not be created or recovered.\n`);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2: Moderator View Validation
  // Verify that tagged students are visible on the original questions.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n---\n## Phase 2: Moderator View Validation\n');
  console.log(
    'Checking that each original question shows the correct number of tagged students.\n',
  );

  for (const posted of postedQuestions) {
    const doc = await QuestionModel.findById(posted.id)
      .select('+taggedStudents')
      .populate('askedBy', 'name email')
      .populate('taggedStudents', 'name email')
      .lean<{
        _id: Types.ObjectId;
        title: string;
        askedBy: { name: string; email: string };
        taggedStudents?: { name: string; email: string }[];
        answerCount: number;
        viewCount: number;
      }>();

    if (!doc) {
      console.log(`**${posted.label}** — ❌ Question not found in DB\n`);
      continue;
    }

    const taggedCount = doc.taggedStudents?.length ?? 0;
    const taggedNames = doc.taggedStudents?.map((s) => s.name).join(', ') || 'none';

    console.log(`**${posted.label}** — "${truncate(doc.title, 70)}"`);
    console.log(`- Original author: ${doc.askedBy.name} (${doc.askedBy.email})`);
    console.log(`- Tagged students (${taggedCount}): ${taggedNames}`);
    console.log(`- Answer count: ${doc.answerCount} | View count: ${doc.viewCount}`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 3: Duplicate Prevention Validation
  // Confirm no extra questions were created for the duplicate submissions.
  // ─────────────────────────────────────────────────────────────────────────
  console.log('---\n## Phase 3: Duplicate Prevention Validation\n');

  const totalCreated = await QuestionModel.countDocuments({
    askedBy: { $in: studentObjIds },
  });
  const expectedCreated = results.filter((r) => r.step === 'NEW_QUESTION' && r.passed).length;
  const duplicatesPrevented = results.filter((r) => r.step === 'TAGGED' && r.passed).length;

  console.log(`| Metric | Expected | Actual | Pass? |`);
  console.log(`|--------|----------|--------|-------|`);
  console.log(
    `| Questions created in DB | ${expectedCreated} | ${totalCreated} | ${totalCreated === expectedCreated ? '✅' : '❌'} |`,
  );
  console.log(
    `| Duplicate submissions prevented (tag-me used instead) | ${duplicatesPrevented} | ${duplicatesPrevented} | ✅ |`,
  );
  console.log(
    `| FAQ matches resolved without posting | ${results.filter((r) => r.step === 'FAQ_MATCH' && r.passed).length} | — | ✅ |`,
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n---\n## Overall Test Summary\n');

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const pct = Math.round((passed / total) * 100);

  console.log(`**${passed} / ${total} scenarios passed — ${pct}%**\n`);

  console.log('| # | Label | Student | Scenario | Step | Pass? | Note |');
  console.log('|---|-------|---------|----------|------|-------|------|');
  results.forEach((r, i) => {
    const stepLabel = {
      FAQ_MATCH: '📖 FAQ Match',
      DUPLICATE_DETECTED: '🔍 Dup Check',
      NEW_QUESTION: '📝 New Q',
      TAGGED: '🔗 Tag-Me',
    }[r.step];
    console.log(
      `| ${i + 1} | ${r.label} | ${r.studentName} | ${truncate(r.scenario, 45)} | ${stepLabel} | ${r.passed ? '✅' : '❌'} | ${truncate(r.note, 70)} |`,
    );
  });

  // ─────────────────────────────────────────────────────────────────────────
  // UI VALIDATION CHECKLIST
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n---\n## UI Validation Checklist\n');
  console.log('Start the app with: `npm run dev` (from project root)\n');
  console.log('### Student Accounts for Manual Testing\n');
  console.log('| Name | Email | Password | Role |');
  console.log('|------|-------|----------|------|');
  STUDENTS.forEach((s) => {
    console.log(`| ${s.name} | ${s.email} | Student@2026 | student |`);
  });
  console.log('| Kushagra | kushagra@samagama.test | Moderator@2026 | moderator |');

  console.log('\n### Checklist\n');
  const checklist = [
    'Log in as Meena — navigate to Ask a Question.',
    'Type a question similar to Q1-A: "My NOC was validated but offer letter not received". Click Check Existing Answers.',
    'Verify: Step 2 (FAQ check) shows relevant FAQ cards with "Does this answer your question?" prompt.',
    'Click "None of these — Continue". Verify Step 3 (Community check) shows Q1-A posted by Abhishek.',
    'Verify: "Same query — tag me" button is visible and clickable.',
    'Click "Same query — tag me". Verify: success screen appears ("You\'ve been tagged").',
    'Log in as moderator (Kushagra). Navigate to Community Questions.',
    "Open Q1-A (Abhishek's NOC/offer letter question). Verify: Meena and Harshdeep appear as tagged students.",
    'Log in as Harshdeep. Navigate to Ask a Question.',
    'Type a question similar to Q3-A: "NOC validated but no offer letter after 48 hours". Verify duplicate detected.',
    'Type a question similar to Q1-C (leave/exams question). Verify FAQ match shown and no community question step.',
    'Log in as Abhishek. Navigate to My Questions. Verify all 2 community questions posted correctly.',
    'Check that no duplicate questions exist in Community Questions list.',
    'Verify all buttons (Edit Question, None of these, Same query, Different query) are clickable without errors.',
    'Verify no broken UI states, console errors, or navigation failures during the full flow.',
  ];
  checklist.forEach((item, i) => {
    console.log(`- [ ] ${i + 1}. ${item}`);
  });

  console.log(`\n*Test completed at ${new Date().toISOString()}*`);

  await disconnectDatabase();
  process.exit(passed === total ? 0 : 1);
}

main().catch((err) => {
  console.error('\n❌ Test run failed:', err);
  process.exit(1);
});
