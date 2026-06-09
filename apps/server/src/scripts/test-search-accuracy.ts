/**
 * Search Accuracy Test — FAQ Matching & Community Question Duplicate Detection
 *
 * Implements the testing plan in full:
 *   Part 1 — 10 seed FAQs × 5 paraphrased student variations = 50 test cases.
 *   Part 2 — 5 community questions from troubleshoot_summership_2026_questions.md
 *             × 5 duplicate variations each = 25 test cases.
 *
 * What it tests:
 *   - Does semantic search surface the correct FAQ in the top-3 results when a
 *     student types a differently-worded question with the same meaning?
 *   - Does the duplicate detector identify the correct existing community question
 *     when a second student posts a paraphrased version of it?
 *
 * Run:
 *   npm --workspace @samagama/server run test:search
 *
 * Save results to a file:
 *   npm --workspace @samagama/server run test:search > testing-results.md
 */

import { config } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load env before anything reads process.env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '../../.env') });

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { generateEmbedding, cosineSimilarity } from '../services/embedding.service.js';
import { FaqModel } from '../models/Faq.model.js';

const SEMANTIC_THRESHOLD = 0.5;
const TOP_K = 3;

// ─── Part 1: FAQ Test Data ────────────────────────────────────────────────────
//
// 10 FAQs selected from the seed file (seed-faqs.ts) covering different
// topics: NOC, offer letter, dates, selection, leave policy, sessions.
// 5 paraphrased variations per FAQ written in realistic student language,
// sourced from troubleshoot_summership_2026_questions.md where available.

interface FaqTestGroup {
  /** Exact title of the FAQ as it exists in the database. */
  faqTitle: string;
  /** 5 student-phrased variations that should match this FAQ. */
  variations: string[];
}

const FAQ_TEST_GROUPS: FaqTestGroup[] = [
  // ── FAQ 1 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: 'What if my college gives me an NOC in their own format?',
    variations: [
      'Can I send my college NOC to IIT Ropar instead of using the template on the portal?',
      'My institution has their own NOC letter format — is that acceptable for upload?',
      'Does the NOC have to be the Samagama template or can my college use their letterhead?',
      'My college gave me their standard internship approval letter — will that work as an NOC?',
      'The HOD signed a different NOC format from our college — will Samagama accept it?',
    ],
  },

  // ── FAQ 2 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: 'When do I get the offer letter?',
    variations: [
      'I uploaded my NOC 48 hours ago but have not received the offer letter yet',
      'My NOC is showing as validated on dashboard but no offer letter has been generated',
      'How long does it take to get the formal offer letter after my NOC is approved?',
      'When will my offer letter be available to download — my internship start date is tomorrow',
      'I uploaded and validated my NOC successfully but I still cannot see my offer letter',
    ],
  },

  // ── FAQ 3 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: 'How do I accept the offer letter?',
    variations: [
      'Is it required to sign the offer letter physically by printing it or can I sign it digitally?',
      'What is the exact wording or format I need to use to accept the offer letter by email?',
      'Should I click reply or reply all when sending my acceptance for the offer letter?',
      'Where do I send the signed offer letter and to which email address?',
      'I have the offer letter downloaded and signed — what are the next steps to submit it?',
    ],
  },

  // ── FAQ 4 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: 'How do I confirm my internship dates?',
    variations: [
      'I accidentally saved the wrong internship dates — how can I change them on the portal?',
      'My dashboard shows that the dates are locked — can I still change my internship period?',
      'Where exactly do I enter or update my internship start and end dates on Samagama?',
      'The dates on my dashboard are incorrect and now they appear to be locked',
      'The dates on my NOC do not match what I entered on Samagama — how do I correct this?',
    ],
  },

  // ── FAQ 5 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: 'What is VINS?',
    variations: [
      'I got selected for the online internship but it says no stipend — what exactly is VINS?',
      'The yellow panel on my result page says VINS — what does that mean for me?',
      'Is VINS the unpaid online version of the Vicharanashala internship programme?',
      'I got selected for VINS but I am confused about whether I will receive any stipend',
      'What is the difference between the regular internship and VINS?',
    ],
  },

  // ── FAQ 6 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: 'I have to attend my class during the internship — can I take leave?',
    variations: [
      'Can I take a break from the internship when my college classes start in July?',
      'My college semester begins in August — is it possible to pause the internship for that?',
      'Is there any flexibility to attend college classes alongside the internship?',
      'I have college exams coming up in June — will I be given any leave from the internship?',
      'Can I manage the internship alongside my college timetable or do I need to be full-time?',
    ],
  },

  // ── FAQ 7 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: 'Are orientation session recordings shared with interns?',
    variations: [
      'I missed the orientation session today — is there any way to get the recording?',
      'Is there a way to catch up if I was unable to attend the live kickoff session?',
      "Will the video recording of today's session be shared with all interns?",
      'I joined the Zoom session late and missed part of it — where can I watch the replay?',
      'Can you please send me the recording of the session I missed yesterday?',
    ],
  },

  // ── FAQ 8 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: "What happens after I send my acceptance? My dashboard doesn't update.",
    variations: [
      'I sent the signed offer letter 3 days ago but my dashboard still shows offer letter pending',
      'After sending the acceptance mail how long does the dashboard take to reflect the change?',
      'I accepted the offer letter via email but the portal status has not changed at all',
      'My offer letter acceptance was sent correctly but the dashboard still says Download Offer Letter',
      'Why is my internship not showing as started even though I accepted the offer letter already?',
    ],
  },

  // ── FAQ 9 ──────────────────────────────────────────────────────────────────
  {
    faqTitle: 'My HOD wants written confirmation before signing my NOC. What do I show them?',
    variations: [
      'My college needs an official selection confirmation letter before they will issue the NOC',
      'How do I get proof of selection to show my HOD so that they agree to sign the NOC?',
      'My department will not issue an NOC without seeing official documentation from IIT Ropar',
      'Is there any official document I can get from Samagama to show my college as proof?',
      'Can I get a provisional or tentative letter before my NOC is uploaded to prove my selection?',
    ],
  },

  // ── FAQ 10 ─────────────────────────────────────────────────────────────────
  {
    faqTitle: 'When do I submit the NOC? Is the deadline hard?',
    variations: [
      'Is there a strict deadline for submitting the NOC or can I submit it whenever it is ready?',
      'My NOC will be ready next week — will I lose my selection if I submit it late?',
      'How much time do I have to upload the NOC after getting selected for the internship?',
      'Is there a last date to submit the NOC or can I upload it whenever my college signs it?',
      'My college is taking time to sign the NOC — will the internship opportunity expire?',
    ],
  },
];

// ─── Part 2: Community Question Test Data ─────────────────────────────────────
//
// 5 unique question categories extracted from troubleshoot_summership_2026_questions.md
// that represent real student issues NOT covered by existing FAQs.
// Each has 5 paraphrased duplicate variations.
//
// The test checks: given that the original question exists in the community
// (with its embedding stored), does each variation correctly identify it as a duplicate?

interface CommunityTestGroup {
  groupIndex: number;
  /** Title of the original community question already posted in the system. */
  originalQuestion: string;
  /** 5 variations that a second student might post meaning the same thing. */
  duplicateVariations: string[];
}

const COMMUNITY_TEST_GROUPS: CommunityTestGroup[] = [
  // ── Community Q 1 (from Unique Question 2 in troubleshoot file) ────────────
  {
    groupIndex: 0,
    originalQuestion:
      'My dashboard is still showing the interview status as Incomplete even though I completed the interview successfully',
    duplicateVariations: [
      'I successfully completed my interview and the chatbot confirmed it but dashboard still shows Incomplete',
      'My dashboard is still showing interview as Incomplete — please verify and update my status',
      'I completed my interview 48 hours ago and selected my dates but have not received confirmation',
      'I have done the interview three times due to errors and it is still showing Incomplete status',
      'I waited more than 34 hours after completing the interview but dashboard still shows Incomplete',
    ],
  },

  // ── Community Q 2 (from Unique Question 3 in troubleshoot file) ────────────
  {
    groupIndex: 1,
    originalQuestion:
      'My interview status shows Interview Interrupted even though I completed it and Yaksha confirmed all answers were saved',
    duplicateVariations: [
      'My Yaksha interview was completed and I got confirmation but when I logged back in it shows Interview Interrupted',
      'Yaksha said my interview was complete and all answers were saved but the system still shows interrupted',
      'It only shows interview interrupted while Yaksha said the interview was already completed',
      'I asked Yaksha to escalate multiple times and even emailed but it still reflects as interrupted',
      'Yaksha confirmed interview complete but my dashboard status still shows Interview Interrupted',
    ],
  },

  // ── Community Q 3 (from Unique Question 6 in troubleshoot file) ────────────
  {
    groupIndex: 2,
    originalQuestion:
      'I am unable to join the orientation Zoom meeting — it says this meeting is for authorized registrants only or the passcode is incorrect',
    duplicateVariations: [
      'I registered for the Zoom meeting but the passcode is showing as incorrect — what should I do?',
      'I am getting the error This meeting is for authorized registrants only even with my registered email',
      'I created a Zoom account but the meeting passcode was not included in the email — what to do?',
      'I received the Zoom link but cannot join because it says authorized registrants only',
      'The Zoom meeting link is not opening at all — I cannot get into the orientation session',
    ],
  },

  // ── Community Q 4 (from Unique Question 7 in troubleshoot file) ────────────
  {
    groupIndex: 3,
    originalQuestion:
      'I am unable to join the internship WhatsApp group because it shows the group is full',
    duplicateVariations: [
      'The Vicharanashala Summership WhatsApp group is full and I cannot join — please share a new link',
      'I missed the mail and when I try to join the WhatsApp group it says group is full',
      'My teammates are in the WhatsApp group getting updates but I cannot join because it is full',
      'I cannot connect to the internship WhatsApp group because it reached the limit and shows full',
      'When will I be added to the WhatsApp group — the previous invite link says the group is full',
    ],
  },

  // ── Community Q 5 (from Unique Question 25 in troubleshoot file) ───────────
  {
    groupIndex: 4,
    originalQuestion:
      'I am not able to interact with Yaksha or the chat feature is not working or not enabled on my account',
    duplicateVariations: [
      'I uploaded my self declaration and fixed my dates but I am still not able to chat with Yaksha',
      'The platform is not allowing me to message Yaksha even though I received the offer letter',
      'My Yaksha portal has been behaving like it is still in interview mode for the past 5 days',
      'Whenever I try to ask a query on Yaksha the interview timer keeps running and gives a warning',
      'Yaksha chat is not enabled for my account since the very first day of my internship',
    ],
  },
];

// ─── Test Runner ──────────────────────────────────────────────────────────────

interface FaqTestResult {
  groupIndex: number;
  variationIndex: number;
  faqTitle: string;
  variation: string;
  topMatches: { title: string; score: number }[];
  passed: boolean;
}

interface CommunityTestResult {
  groupIndex: number;
  variationIndex: number;
  originalQuestion: string;
  variation: string;
  topMatches: { title: string; score: number; correctGroup: boolean }[];
  passed: boolean;
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

async function runFaqTests(
  faqEmbeddings: { title: string; embedding: number[] }[],
): Promise<FaqTestResult[]> {
  const results: FaqTestResult[] = [];

  for (let gi = 0; gi < FAQ_TEST_GROUPS.length; gi++) {
    const group = FAQ_TEST_GROUPS[gi];
    for (let vi = 0; vi < group.variations.length; vi++) {
      const variation = group.variations[vi];
      const queryEmbedding = await generateEmbedding(variation);

      const scored = faqEmbeddings
        .map((f) => ({ title: f.title, score: cosineSimilarity(queryEmbedding, f.embedding) }))
        .filter((f) => f.score >= SEMANTIC_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_K);

      // Pass if the expected FAQ title appears anywhere in the top-K results.
      const passed = scored.some(
        (m) => m.title.toLowerCase().trim() === group.faqTitle.toLowerCase().trim(),
      );

      results.push({
        groupIndex: gi,
        variationIndex: vi,
        faqTitle: group.faqTitle,
        variation,
        topMatches: scored,
        passed,
      });
    }
  }

  return results;
}

async function runCommunityTests(
  communityEmbeddings: { title: string; embedding: number[] }[],
): Promise<CommunityTestResult[]> {
  const results: CommunityTestResult[] = [];

  for (let gi = 0; gi < COMMUNITY_TEST_GROUPS.length; gi++) {
    const group = COMMUNITY_TEST_GROUPS[gi];
    for (let vi = 0; vi < group.duplicateVariations.length; vi++) {
      const variation = group.duplicateVariations[vi];
      const queryEmbedding = await generateEmbedding(variation);

      const scored = communityEmbeddings
        .map((q, idx) => ({
          title: q.title,
          score: cosineSimilarity(queryEmbedding, q.embedding),
          correctGroup: idx === group.groupIndex,
        }))
        .filter((q) => q.score >= SEMANTIC_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2);

      // Pass if the top-2 results include the correct original question.
      const passed = scored.some((m) => m.correctGroup);

      results.push({
        groupIndex: gi,
        variationIndex: vi,
        originalQuestion: group.originalQuestion,
        variation,
        topMatches: scored,
        passed,
      });
    }
  }

  return results;
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  await connectDatabase();

  const provider = process.env.EMBEDDING_PROVIDER ?? 'mock';
  const timestamp = new Date().toISOString();

  console.log('# Samagama — Search Accuracy Test Results\n');
  console.log(`- **Embedding provider:** \`${provider}\``);
  console.log(`- **Similarity threshold:** ${SEMANTIC_THRESHOLD}`);
  console.log(`- **Top-K:** ${TOP_K}`);
  console.log(`- **Generated:** ${timestamp}\n`);

  if (provider === 'mock') {
    console.log('> ⚠️  **Warning:** Running with mock embeddings. Mock embeddings use character');
    console.log('> counting, not real semantic understanding. Accuracy will be very low.');
    console.log(
      '> Set `EMBEDDING_PROVIDER=ollama` or `EMBEDDING_PROVIDER=gemini` for meaningful results.\n',
    );
  }

  // ── Load FAQ embeddings from database ─────────────────────────────────────
  console.log('Loading published FAQs from database...\n');
  const rawFaqs = await FaqModel.find({ status: 'published' })
    .select('title embedding')
    .lean<{ _id: unknown; title: string; embedding?: number[] }[]>();

  console.log(`Found ${rawFaqs.length} published FAQs.`);
  console.log(`Generating fresh FAQ embeddings using provider: ${provider}`);
  console.log(`(Stored embeddings are ignored — they may have been generated by a different`);
  console.log(` provider, e.g. mock, causing a mismatch. Fresh generation ensures consistency.)\n`);

  // Always generate fresh embeddings using the current active provider.
  // Stored embeddings in the DB may be from a previous provider (e.g. mock)
  // which would make cosine similarity meaningless against real embeddings.
  const faqEmbeddings: { title: string; embedding: number[] }[] = [];
  for (let i = 0; i < rawFaqs.length; i++) {
    faqEmbeddings.push({
      title: rawFaqs[i].title,
      embedding: await generateEmbedding(rawFaqs[i].title),
    });
    // 500ms pause between requests keeps Gemini free-tier well under its rate limit.
    // Ollama and mock providers ignore this delay (they respond instantly).
    if (provider === 'gemini' && i < rawFaqs.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`Embeddings ready for ${faqEmbeddings.length} FAQs.\n`);

  // ══════════════════════════════════════════════════════════════════════════
  // PART 1 — FAQ MATCHING
  // ══════════════════════════════════════════════════════════════════════════

  console.log('---\n');
  console.log(
    `## Part 1: FAQ Matching (${FAQ_TEST_GROUPS.length} FAQs × 5 variations = ${FAQ_TEST_GROUPS.length * 5} test cases)\n`,
  );
  console.log('Testing whether each paraphrased student question surfaces the correct FAQ');
  console.log(
    `within the top ${TOP_K} results at a similarity threshold of ${SEMANTIC_THRESHOLD}.\n`,
  );

  const faqResults = await runFaqTests(faqEmbeddings);
  const faqPassed = faqResults.filter((r) => r.passed).length;
  const faqTotal = faqResults.length;
  const faqPct = Math.round((faqPassed / faqTotal) * 100);

  console.log(`### Summary\n`);
  console.log(`**${faqPassed} / ${faqTotal} passed — ${faqPct}% accuracy**\n`);

  // Results table
  console.log('### Detailed Results\n');
  console.log('| # | Submitted Question | Expected FAQ | Top Match Returned | Score | Pass? |');
  console.log('|---|--------------------|-------------|-------------------|-------|-------|');

  faqResults.forEach((r, i) => {
    const top = r.topMatches[0];
    const topTitle = top ? truncate(top.title, 40) : '*(no match above threshold)*';
    const topScore = top ? top.score.toFixed(3) : '—';
    const mark = r.passed ? '✅' : '❌';
    console.log(
      `| ${i + 1} | ${truncate(r.variation, 55)} | ${truncate(r.faqTitle, 40)} | ${topTitle} | ${topScore} | ${mark} |`,
    );
  });

  // Per-FAQ breakdown
  console.log('\n### Per-FAQ Breakdown\n');
  for (let gi = 0; gi < FAQ_TEST_GROUPS.length; gi++) {
    const group = FAQ_TEST_GROUPS[gi];
    const groupResults = faqResults.filter((r) => r.groupIndex === gi);
    const groupPassed = groupResults.filter((r) => r.passed).length;
    const status =
      groupPassed === 5
        ? '✅ All pass'
        : groupPassed === 0
          ? '❌ All fail'
          : `⚠️  ${groupPassed}/5 pass`;
    console.log(`**FAQ ${gi + 1}:** "${group.faqTitle}" — ${status}`);
    groupResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        const top = r.topMatches[0];
        console.log(`  - ❌ "${truncate(r.variation, 70)}"`);
        if (top)
          console.log(`       → matched "${truncate(top.title, 60)}" (${top.score.toFixed(3)})`);
        else console.log(`       → no match above threshold`);
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PART 2 — COMMUNITY QUESTION DUPLICATE DETECTION
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n---\n');
  console.log(`## Part 2: Community Question Duplicate Detection\n`);
  console.log('5 original community questions from troubleshoot_summership_2026_questions.md.');
  console.log('Each has 5 paraphrased duplicate variations. Test passes if the correct original');
  console.log(
    `question appears in the top-2 semantic matches at threshold ${SEMANTIC_THRESHOLD}.\n`,
  );

  console.log('**Original questions used:**\n');
  COMMUNITY_TEST_GROUPS.forEach((g, i) => {
    console.log(`${i + 1}. ${truncate(g.originalQuestion, 90)}`);
  });
  console.log();

  // Generate embeddings for original questions
  console.log('Generating embeddings for original community questions...\n');
  const communityEmbeddings = await Promise.all(
    COMMUNITY_TEST_GROUPS.map(async (g) => ({
      title: g.originalQuestion,
      embedding: await generateEmbedding(g.originalQuestion),
    })),
  );

  const communityResults = await runCommunityTests(communityEmbeddings);
  const commPassed = communityResults.filter((r) => r.passed).length;
  const commTotal = communityResults.length;
  const commPct = Math.round((commPassed / commTotal) * 100);

  console.log(`### Summary\n`);
  console.log(`**${commPassed} / ${commTotal} passed — ${commPct}% accuracy**\n`);

  // Results table
  console.log('### Detailed Results\n');
  console.log(
    '| # | Duplicate Variation | Expected Original (short) | Top Match Returned | Score | Pass? |',
  );
  console.log(
    '|---|---------------------|--------------------------|-------------------|-------|-------|',
  );

  communityResults.forEach((r, i) => {
    const top = r.topMatches[0];
    const topTitle = top
      ? top.correctGroup
        ? '✓ Correct'
        : truncate(top.title, 30)
      : '*(no match)*';
    const topScore = top ? top.score.toFixed(3) : '—';
    const mark = r.passed ? '✅' : '❌';
    console.log(
      `| ${i + 1} | ${truncate(r.variation, 50)} | Q${r.groupIndex + 1}: ${truncate(r.originalQuestion, 30)} | ${topTitle} | ${topScore} | ${mark} |`,
    );
  });

  // Per-question breakdown
  console.log('\n### Per-Question Breakdown\n');
  for (let gi = 0; gi < COMMUNITY_TEST_GROUPS.length; gi++) {
    const group = COMMUNITY_TEST_GROUPS[gi];
    const groupResults = communityResults.filter((r) => r.groupIndex === gi);
    const groupPassed = groupResults.filter((r) => r.passed).length;
    const status =
      groupPassed === 5
        ? '✅ All pass'
        : groupPassed === 0
          ? '❌ All fail'
          : `⚠️  ${groupPassed}/5 pass`;
    console.log(`**Q${gi + 1}:** "${truncate(group.originalQuestion, 70)}" — ${status}`);
    groupResults
      .filter((r) => !r.passed)
      .forEach((r) => {
        const top = r.topMatches[0];
        console.log(`  - ❌ "${truncate(r.variation, 70)}"`);
        if (top)
          console.log(`       → matched "${truncate(top.title, 50)}" (${top.score.toFixed(3)})`);
        else console.log(`       → no match above threshold`);
      });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OVERALL SUMMARY
  // ══════════════════════════════════════════════════════════════════════════

  const totalPassed = faqPassed + commPassed;
  const totalCases = faqTotal + commTotal;
  const totalPct = Math.round((totalPassed / totalCases) * 100);

  console.log('\n---\n');
  console.log('## Overall Summary\n');
  console.log('| Section | Passed | Total | Accuracy |');
  console.log('|---------|--------|-------|----------|');
  console.log(`| Part 1 — FAQ Matching | ${faqPassed} | ${faqTotal} | ${faqPct}% |`);
  console.log(
    `| Part 2 — Community Duplicate Detection | ${commPassed} | ${commTotal} | ${commPct}% |`,
  );
  console.log(`| **Total** | **${totalPassed}** | **${totalCases}** | **${totalPct}%** |`);

  console.log('\n### Interpretation\n');
  if (totalPct >= 90) {
    console.log('🟢 **Excellent** — The semantic search is performing very well. The threshold');
    console.log('   of 0.50 is well-calibrated for the current embedding provider.');
  } else if (totalPct >= 75) {
    console.log('🟡 **Good** — Semantic search is working but some paraphrases are being missed.');
    console.log('   Consider lowering SEMANTIC_THRESHOLD slightly (e.g. 0.45) or switching to');
    console.log('   a higher-quality embedding provider (Gemini text-embedding-004).');
  } else if (totalPct >= 50) {
    console.log('🟠 **Fair** — Results suggest embeddings are not well-suited to this content.');
    console.log(
      '   If using mock or all-minilm, switch to EMBEDDING_PROVIDER=gemini for significantly',
    );
    console.log(
      '   better accuracy. Also run the embedding backfill script to populate stored vectors.',
    );
  } else {
    console.log('🔴 **Poor** — Most likely cause: FAQs have no stored embeddings (embeddings are');
    console.log('   generated on-the-fly from titles only) or EMBEDDING_PROVIDER=mock is active.');
    console.log('   Steps to fix:');
    console.log(
      '   1. Set EMBEDDING_PROVIDER=gemini or EMBEDDING_PROVIDER=ollama in apps/server/env',
    );
    console.log(
      '   2. Run the FAQ embedding backfill: npm --workspace @samagama/server run seed:faqs',
    );
    console.log('   3. Re-run this test script.');
  }

  console.log(`\n*Test completed at ${new Date().toISOString()}*`);

  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ Test run failed:', err);
  process.exit(1);
});
