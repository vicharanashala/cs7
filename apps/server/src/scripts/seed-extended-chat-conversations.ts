// Seed extended multi-turn chatbot conversations for the Yaksha-mini test dataset.
//
// Creates realistic back-and-forth sessions between students and Yaksha-mini,
// simulating responses as they would be generated via Ollama (llama3.2).
// Each session is stored as a ChatFeedback record with the full messages snapshot.
//
// Feedback distribution:
//   - helpful       → student confirmed the answer resolved their query
//   - incorrect     → student found the answer unhelpful or wrong
//   - fallback      → Yaksha couldn't answer; "not answered" scenario
//   - partial       → student left feedback: "Does this resolve your query?"
//
// Idempotent: keys on (userId + query) so re-runs only upsert existing rows.
// Run via: `npm run seed:chat-conversations` (from the server workspace)

import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { ChatFeedbackModel } from '../models/ChatFeedback.model.js';
import { UserModel } from '../models/User.model.js';
import { env } from '../config/env.js';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ConversationSeed {
  studentEmail: string;
  messages: Message[];
  /** The rated bot message — index into messages[] (must be an assistant turn). */
  ratedMessageIndex: number;
  rating: 'helpful' | 'incorrect';
  comment?: string;
  status: 'open' | 'reviewed' | 'resolved';
  /** Human-readable label shown only in seed logs */
  scenario: string;
}

// ─── Conversation dataset ─────────────────────────────────────────────────────

const CONVERSATIONS: ConversationSeed[] = [
  // ── 1. NOC Certificate — HELPFUL ─────────────────────────────────────────
  {
    studentEmail: 'aditya@samagama.test',
    scenario: 'NOC Certificate workflow (helpful)',
    rating: 'helpful',
    status: 'resolved',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content: 'Hi, I just finished my internship. When can I download my NOC?',
      },
      {
        role: 'assistant',
        content:
          'Hi Aditya! Congratulations on completing your internship. Your NOC (No Objection Certificate) will be available for download within 7 working days after your internship end date. You can find it under **Documents → NOC Certificate** in the portal.',
      },
      {
        role: 'user',
        content:
          'My end date was 3 days ago. The Documents section still shows "Processing". Is that normal?',
      },
      {
        role: 'assistant',
        content:
          'Yes, that is completely normal. "Processing" status means the HR team has received your completion data and the certificate is being generated. It typically resolves within 7 working days — weekends and public holidays are not counted. If the status has not changed after the full 7-day window, you may raise a query through the portal\'s support section.',
      },
      {
        role: 'user',
        content: 'Got it. What format is the NOC — PDF or image?',
      },
      {
        role: 'assistant',
        content:
          'The NOC is issued as a digitally signed PDF. It includes your name, internship period, department, and the Samagama official seal. The PDF is suitable for submission to colleges and universities without any additional notarisation.',
      },
      {
        role: 'user',
        content: 'Perfect. One last thing — is there a validity period for the NOC?',
      },
      {
        role: 'assistant',
        content:
          'The NOC itself does not have an expiry date — it is a permanent record of your internship. However, some institutions may ask for certificates issued within a specific timeframe, so it is advisable to download and submit it as soon as it becomes available. You can re-download it from the portal at any time even after submission.',
      },
    ],
  },

  // ── 2. Stipend Deductions — INCORRECT / UNHELPFUL ────────────────────────
  {
    studentEmail: 'priya@samagama.test',
    scenario: 'Stipend deduction dispute (unhelpful — wrong policy quoted)',
    rating: 'incorrect',
    status: 'open',
    comment:
      'Yaksha quoted a 14-day review window but my offer letter says 7 days. The answer was misleading. Provider: ollama/llama3.2',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content: 'My stipend this month was ₹500 less than expected. How do I find out why?',
      },
      {
        role: 'assistant',
        content:
          'Hi Priya! Stipend deductions usually occur due to unexcused absences, late attendance marking, or leave overdraft. You can see the breakdown by navigating to **Stipend → Monthly Statement** — it lists each deduction with a reason code and the date it was applied.',
      },
      {
        role: 'user',
        content:
          'I checked and it says "Leave Overdraft: 2 days". But I only took 1 leave day this month.',
      },
      {
        role: 'assistant',
        content:
          'A "Leave Overdraft" entry could also appear if you took a leave in the previous month that was not approved in time and carried forward as a deduction in the current cycle. Check the leave approval status in **Attendance → Leave History** to see if any prior leave was marked as unapproved.',
      },
      {
        role: 'user',
        content: 'My leave history shows both days are "approved". This seems like a portal error.',
      },
      {
        role: 'assistant',
        content:
          'If both leave days are marked as approved but a deduction still appears, it may be a calculation error on the portal. You can appeal the deduction by going to **Profile → Appeals** and submitting the relevant pay period. Stipend appeals are reviewed within 14 working days.',
      },
      {
        role: 'user',
        content: 'My offer letter says appeals are resolved in 7 days, not 14. Which is correct?',
      },
      {
        role: 'assistant',
        content:
          'I can only confirm what is stated in the FAQ: the reviewed timeline is 14 working days. For discrepancies between the FAQ and your offer letter, the offer letter terms would take precedence. I recommend reaching out to your HR coordinator directly to clarify the applicable timeline for your cohort.',
      },
    ],
  },

  // ── 3. Attendance — HELPFUL ───────────────────────────────────────────────
  {
    studentEmail: 'sneha@samagama.test',
    scenario: 'Remote attendance marking (helpful)',
    rating: 'helpful',
    status: 'resolved',
    comment: 'Clear and accurate. Provider: ollama/llama3.2',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content: 'How do I mark attendance when I am working from home today?',
      },
      {
        role: 'assistant',
        content:
          'For remote work days, use the **Remote Attendance** button located under **Attendance → Mark Today**. You must mark it before 10:00 AM IST. If you miss the window, it will be recorded as absent for that day.',
      },
      {
        role: 'user',
        content: 'What if I start work late due to a power cut and cannot mark by 10 AM?',
      },
      {
        role: 'assistant',
        content:
          'If you miss the 10:00 AM deadline due to an unavoidable reason, you can submit a late attendance request via **Attendance → Request Correction**. You will need to provide a brief reason. The correction request is reviewed by your assigned coordinator, typically within 1 working day.',
      },
      {
        role: 'user',
        content:
          'Does marking remote attendance count the same as in-office attendance for stipend calculation?',
      },
      {
        role: 'assistant',
        content:
          'Yes, approved remote attendance days are treated identically to in-office days for stipend calculation purposes. Both contribute equally to your monthly attendance percentage, and there is no penalty for working remotely as long as the attendance is marked correctly before the cutoff.',
      },
      {
        role: 'user',
        content: 'Great. And how many remote days am I allowed per month?',
      },
      {
        role: 'assistant',
        content:
          'The number of permitted remote days per month depends on your internship agreement and department policy. The portal will reflect your allocated remote quota under **Attendance → Remote Quota**. If the field is not visible, your internship track may be fully remote or fully in-office — your coordinator can confirm this.',
      },
    ],
  },

  // ── 4. Leave Policy — FALLBACK / NOT ANSWERED ────────────────────────────
  {
    studentEmail: 'arjun@samagama.test',
    scenario: 'Compassionate leave policy — not in FAQ (fallback / not answered)',
    rating: 'incorrect',
    status: 'open',
    comment:
      'Yaksha could not answer. Student escalated. Fallback triggered. Provider: ollama/llama3.2',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content:
          'I need to take emergency leave for a family bereavement. Does Samagama have a compassionate leave policy?',
      },
      {
        role: 'assistant',
        content:
          "I'm sorry to hear that, Arjun. Regarding compassionate leave specifically, the portal FAQ covers the general leave policy — you are typically allocated a fixed number of paid and unpaid leaves per month. However, I do not have verified details about a dedicated compassionate leave policy in the FAQ.",
      },
      {
        role: 'user',
        content:
          'So will those emergency days be deducted from my monthly leave quota or are they separate?',
      },
      {
        role: 'assistant',
        content:
          "I don't have an answer for you at the moment. You can escalate it to the backend team: Type #escalate",
      },
      {
        role: 'user',
        content: 'Can I at least get a provisional approval while the HR team reviews it?',
      },
      {
        role: 'assistant',
        content:
          "I don't have an answer for you at the moment. You can escalate it to the backend team: Type #escalate",
      },
      {
        role: 'user',
        content: '#escalate',
      },
      {
        role: 'assistant',
        content:
          "✅ Your issue has been escalated to the moderation team. They'll review it shortly.\n\n**Summary:** Student Arjun is requesting clarification on the compassionate/bereavement leave policy — specifically whether emergency leave days are deducted from the monthly quota or handled separately, and whether provisional approvals are available. This topic is not covered in the current FAQ and requires HR guidance.",
      },
    ],
  },

  // ── 5. Completion Certificate — HELPFUL ──────────────────────────────────
  {
    studentEmail: 'vikram@samagama.test',
    scenario: 'Completion certificate download (helpful)',
    rating: 'helpful',
    status: 'resolved',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content:
          'I need my internship completion certificate for a job application. Where do I get it?',
      },
      {
        role: 'assistant',
        content:
          'Hi Vikram! Your completion certificate is available under **Documents → Completion Certificate** once your internship officially ends and the HR team processes it. Processing typically takes 5 working days after your end date.',
      },
      {
        role: 'user',
        content: 'My internship ended last week. The section exists but the button is greyed out.',
      },
      {
        role: 'assistant',
        content:
          'A greyed-out download button usually means one of two things: (1) the 5-working-day processing window has not elapsed yet, or (2) there is a pending item on your account such as an unsubmitted exit report or outstanding attendance correction. Check **Profile → Pending Actions** to see if anything is blocking generation.',
      },
      {
        role: 'user',
        content: 'I see "Exit Survey — Not Submitted" in Pending Actions. Is that mandatory?',
      },
      {
        role: 'assistant',
        content:
          'Yes, the exit survey is mandatory before the completion certificate is released. It takes approximately 5 minutes to complete and covers your experience, mentorship quality, and suggestions for the programme. Once submitted, the certificate should become available within 1 working day.',
      },
      {
        role: 'user',
        content: 'Submitted it just now. Thank you, that solved it!',
      },
      {
        role: 'assistant',
        content:
          "That's great to hear! Your certificate should appear in the Documents section by the next working day. If it does not appear after 24 hours, you can raise a support ticket from **Help → Raise Ticket**. Best of luck with your job application!",
      },
    ],
  },

  // ── 6. Internship Extension — INCORRECT ──────────────────────────────────
  {
    studentEmail: 'kavya@samagama.test',
    scenario: 'Internship extension eligibility — incorrect policy details',
    rating: 'incorrect',
    status: 'open',
    comment:
      'Yaksha said extensions are processed in 3 days but the official policy is 5–7 working days. Provider: ollama/llama3.2',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content: 'I want to extend my internship by one month. Is that possible?',
      },
      {
        role: 'assistant',
        content:
          'Hi Kavya! Internship extensions are possible subject to project availability and mentor approval. You can submit an extension request under **Internship → Request Extension**. The form asks for your desired new end date and a brief reason for the extension.',
      },
      {
        role: 'user',
        content:
          'What is the deadline to apply for an extension? My current end date is in 10 days.',
      },
      {
        role: 'assistant',
        content:
          'Extension requests should ideally be submitted at least 2 weeks before your scheduled end date to allow time for mentor review and HR processing. With 10 days remaining, you are within the window but should submit immediately to avoid delays.',
      },
      {
        role: 'user',
        content: 'OK I have submitted it. How long does the approval take?',
      },
      {
        role: 'assistant',
        content:
          'Extensions are typically processed within 3 working days of submission. You will receive an email notification once a decision is made, and your portal end date will update automatically if approved.',
      },
      {
        role: 'user',
        content: 'My HR email says they take 5 to 7 working days, not 3. Which is accurate?',
      },
      {
        role: 'assistant',
        content:
          'I can see there is a discrepancy between what the FAQ states and the timeline in your HR communication. For matters where the HR email and FAQ differ, the official HR communication should be considered authoritative. I apologise for any confusion — the FAQ entry on extension timelines may be outdated.',
      },
    ],
  },

  // ── 7. VINS Portal Access — HELPFUL ──────────────────────────────────────
  {
    studentEmail: 'rohit@samagama.test',
    scenario: 'VINS portal login and task submission (helpful)',
    rating: 'helpful',
    status: 'resolved',
    comment: 'Accurate and helpful. Provider: ollama/llama3.2',
    ratedMessageIndex: 9,
    messages: [
      {
        role: 'user',
        content: 'What is VINS? My mentor mentioned it but I cannot find it on the portal.',
      },
      {
        role: 'assistant',
        content:
          'VINS stands for Virtual Internship Navigation System. It is the task and milestone tracking module within the Samagama portal where you log your daily work, submit weekly reports, and view assignments set by your mentor. You can access it from the main dashboard under the **VINS** tab in the left sidebar.',
      },
      {
        role: 'user',
        content: 'I can see the VINS tab but it says "Access Pending". What does that mean?',
      },
      {
        role: 'assistant',
        content:
          '"Access Pending" means your VINS workspace has not been activated yet. This typically happens in the first 1–2 days of your internship while the admin team links your account to your mentor\'s project. If it remains in this state after 3 working days, contact your mentor directly — they may need to send the activation invite.',
      },
      {
        role: 'user',
        content:
          'It has been 4 days already. I emailed my mentor and they said they already activated it.',
      },
      {
        role: 'assistant',
        content:
          'If the mentor has confirmed activation but you still see "Access Pending", try logging out of the portal and back in — activation changes sometimes require a fresh session to reflect. If that does not resolve it, clear your browser cache or try an incognito window. If still stuck, raise a ticket via **Help → Raise Ticket** and mention that the mentor has already completed the activation step.',
      },
      {
        role: 'user',
        content:
          'Logging out and back in worked! Now I can see my tasks. How do I submit a weekly report?',
      },
      {
        role: 'assistant',
        content:
          'To submit a weekly report in VINS: go to **VINS → Weekly Reports → New Report**, fill in your progress summary, achievements, blockers, and planned tasks for next week, then click **Submit**. Reports are due every Friday before 6:00 PM IST. Late submissions are accepted but marked accordingly.',
      },
      {
        role: 'user',
        content: 'What happens if I miss a weekly report submission?',
      },
      {
        role: 'assistant',
        content:
          'Missing a weekly report is flagged to your mentor and recorded in your performance log. Two or more missed reports in a month may affect your final evaluation rating. If you know in advance that you will miss a deadline, inform your mentor before the Friday cutoff so they can note a valid reason against the record.',
      },
    ],
  },

  // ── 8. Leaves and Monthly Reset — DOES THIS RESOLVE YOUR QUERY ───────────
  {
    studentEmail: 'ananya@samagama.test',
    scenario: 'Leave carryforward policy — partial resolution ("Does this resolve your query?")',
    rating: 'helpful',
    status: 'open',
    comment:
      'Does this resolve your query? — Student responded: Partially. I still have questions about sick leave. Provider: ollama/llama3.2',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content: 'Do unused leaves carry forward to the next month?',
      },
      {
        role: 'assistant',
        content:
          'No, leaves do not carry forward in the Samagama internship programme — they reset on the 1st of each month. Any unused leave from the current month expires at month-end and cannot be applied to future months.',
      },
      {
        role: 'user',
        content: 'That seems strict. Is there any exception for medical emergencies?',
      },
      {
        role: 'assistant',
        content:
          'The portal FAQ does not document a specific exception for medical emergencies under the standard leave reset policy. However, if you have a documented medical situation, it is worth discussing with your HR coordinator — they may be able to apply a discretionary adjustment outside the automated system.',
      },
      {
        role: 'user',
        content: 'How many leaves am I entitled to each month?',
      },
      {
        role: 'assistant',
        content:
          'The standard monthly leave entitlement under the Samagama internship programme is 2 paid leaves per month. Additional leaves beyond this count as unpaid and may affect your monthly stipend calculation proportionally.',
      },
      {
        role: 'user',
        content: 'Are sick leaves counted separately from casual leaves?',
      },
      {
        role: 'assistant',
        content:
          "I don't have an answer for you at the moment. You can escalate it to the backend team: Type #escalate",
      },
    ],
  },

  // ── 9. Portal Login Issue — HELPFUL ──────────────────────────────────────
  {
    studentEmail: 'siddharth@samagama.test',
    scenario: 'Password reset and portal access (helpful)',
    rating: 'helpful',
    status: 'resolved',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content: 'I forgot my portal password. How do I reset it?',
      },
      {
        role: 'assistant',
        content:
          'Hi Siddharth! To reset your password, click **Forgot Password** on the login page and enter your registered email address. You will receive a reset link within 5 minutes. The link is valid for 30 minutes — if it expires, you can request a new one.',
      },
      {
        role: 'user',
        content: "I didn't receive the email even after 10 minutes. I checked spam too.",
      },
      {
        role: 'assistant',
        content:
          "If the reset email has not arrived after 10 minutes and is not in spam, it is possible that your account is registered under a slightly different email address. Try the exact email your institution used when registering you, which may be a college email rather than your personal one. If you're still stuck, contact your institution's internship coordinator for the registered email.",
      },
      {
        role: 'user',
        content:
          'I tried my college email and it worked! Now I have a new password. But the portal says my account is "Inactive".',
      },
      {
        role: 'assistant',
        content:
          'An "Inactive" account status usually means your internship has not officially started yet, or there is a pending onboarding step. Check if you have received an onboarding email from Samagama with an activation link. If your internship start date has already passed and the account is still inactive, raise a ticket via **Help → Raise Ticket** and mention your student ID.',
      },
      {
        role: 'user',
        content:
          'Found the onboarding email in an old folder. Activated successfully. I can log in now!',
      },
      {
        role: 'assistant',
        content:
          "That's excellent news! Now that you're in, I'd recommend completing your profile under **Profile → Setup** and linking your VINS workspace within the first day. If you have any more questions as you navigate the portal, feel free to ask — I'm here to help.",
      },
    ],
  },

  // ── 10. Stipend Date Confusion — DOES THIS RESOLVE YOUR QUERY ────────────
  {
    studentEmail: 'abhishek@samagama.test',
    scenario: 'Stipend payment date — partial answer ("Does this resolve your query?")',
    rating: 'helpful',
    status: 'open',
    comment:
      'Does this resolve your query? — Student: Not fully. I need to know what happens when the 5th falls on a Sunday. Provider: ollama/llama3.2',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content: 'When is the stipend paid each month?',
      },
      {
        role: 'assistant',
        content:
          "Stipends are processed on the 5th of every month for the previous month's attendance. For example, your June stipend (covering June attendance) will be credited on July 5th. Credits usually appear in your registered bank account by end of business on that date.",
      },
      {
        role: 'user',
        content: 'What if I joined mid-month? Do I get a full stipend or a proportional one?',
      },
      {
        role: 'assistant',
        content:
          'If you joined mid-month, your stipend for that month is calculated on a pro-rated basis — you receive the daily rate multiplied by the number of working days you were present after your joining date. The daily rate is derived by dividing your monthly stipend by the total working days in that month.',
      },
      {
        role: 'user',
        content: 'What is the daily rate if my monthly stipend is ₹5000?',
      },
      {
        role: 'assistant',
        content:
          'For a ₹5,000 monthly stipend, assuming approximately 22 working days in a typical month, your daily rate would be approximately **₹227 per working day** (₹5,000 ÷ 22). This may vary slightly by month depending on the actual number of working days.',
      },
      {
        role: 'user',
        content: 'What happens when the 5th falls on a Sunday or public holiday?',
      },
      {
        role: 'assistant',
        content:
          "I don't have an answer for you at the moment. You can escalate it to the backend team: Type #escalate",
      },
    ],
  },

  // ── 11. VINS Report Deletion — NOT ANSWERED / ESCALATED ─────────────────
  {
    studentEmail: 'deepika@samagama.test',
    scenario: 'Deleting a mistakenly submitted VINS report — not in FAQ (escalated)',
    rating: 'incorrect',
    status: 'open',
    comment:
      'Yaksha escalated after 2 fallbacks. Student needed to delete a wrong VINS entry. Not answered. Provider: ollama/llama3.2',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content:
          'I accidentally submitted my weekly VINS report to the wrong project. Can I delete or recall it?',
      },
      {
        role: 'assistant',
        content:
          'Hi Deepika! I understand the urgency. Once a VINS weekly report is submitted, the portal does not currently show a self-service delete or recall option. However, you may be able to submit a correction report for the same week to overwrite the earlier entry — try **VINS → Weekly Reports → New Report** and select the same reporting week to see if it allows resubmission.',
      },
      {
        role: 'user',
        content:
          'It does not let me submit for the same week — it says "Report already exists for this period".',
      },
      {
        role: 'assistant',
        content:
          "I don't have an answer for you at the moment. You can escalate it to the backend team: Type #escalate",
      },
      {
        role: 'user',
        content: 'Can my mentor delete it from their end?',
      },
      {
        role: 'assistant',
        content:
          "I don't have an answer for you at the moment. You can escalate it to the backend team: Type #escalate",
      },
      {
        role: 'user',
        content: '#escalate',
      },
      {
        role: 'assistant',
        content:
          "✅ Your issue has been escalated to the moderation team. They'll review it shortly.\n\n**Summary:** Student Deepika submitted a VINS weekly report to the wrong project and cannot delete or overwrite it — the system blocks resubmission for the same period. She is asking whether a mentor can delete it from the admin side. This requires backend/admin intervention and is not covered in the FAQ.",
      },
    ],
  },

  // ── 12. Certificate of Appreciation — HELPFUL ────────────────────────────
  {
    studentEmail: 'karthik@samagama.test',
    scenario: 'Certificate of Appreciation eligibility (helpful)',
    rating: 'helpful',
    status: 'resolved',
    comment: 'Very clear and detailed. Provider: ollama/llama3.2',
    ratedMessageIndex: 7,
    messages: [
      {
        role: 'user',
        content:
          'What is the Certificate of Appreciation? Is it different from the completion certificate?',
      },
      {
        role: 'assistant',
        content:
          'Yes, they are different documents. The **Completion Certificate** confirms you finished your internship and is issued to all interns who complete the programme. The **Certificate of Appreciation** is an additional recognition awarded to interns who demonstrate outstanding performance — it carries a merit citation and is signed by the programme director.',
      },
      {
        role: 'user',
        content: 'How is "outstanding performance" judged? Is there a score threshold?',
      },
      {
        role: 'assistant',
        content:
          'Outstanding performance is evaluated on a combination of factors: VINS task completion rate, mentor evaluation score, attendance percentage, and peer or project contributions. A composite score above a set threshold (typically in the top 15–20% of your cohort) qualifies you for the certificate. The exact threshold may vary by cohort.',
      },
      {
        role: 'user',
        content: 'Where can I see my current evaluation score?',
      },
      {
        role: 'assistant',
        content:
          'You can view your performance metrics under **Profile → Performance Dashboard**. This shows your VINS task completion rate, attendance percentage, and mentor rating (if the mentor has submitted a mid-term evaluation). The composite score is calculated at the end of the internship.',
      },
      {
        role: 'user',
        content: 'My attendance shows 94%. Is that good enough?',
      },
      {
        role: 'assistant',
        content:
          '94% attendance is strong — it is well above the 85% minimum threshold required to be eligible for the Certificate of Appreciation. Combined with consistent VINS submissions and a good mentor rating, you have a solid chance. Keep up the good work for the remainder of your internship!',
      },
    ],
  },
];

// ─── Seed runner ──────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
  if (env.isProduction) {
    logger.error('Refusing to seed extended chat conversations in production. Aborting.');
    process.exit(1);
  }

  await connectDatabase();

  let inserted = 0;
  let skipped = 0;

  for (const conv of CONVERSATIONS) {
    const user = await UserModel.findOne({ email: conv.studentEmail }).lean();
    if (!user) {
      logger.warn({ email: conv.studentEmail }, 'Student not found — skipping conversation');
      skipped++;
      continue;
    }

    const ratedMsg = conv.messages[conv.ratedMessageIndex];
    if (!ratedMsg || ratedMsg.role !== 'assistant') {
      logger.error(
        { scenario: conv.scenario, index: conv.ratedMessageIndex },
        'ratedMessageIndex does not point to an assistant message — skipping',
      );
      skipped++;
      continue;
    }

    // The query is the user turn immediately before the rated assistant turn.
    const queryMsg = conv.messages[conv.ratedMessageIndex - 1];
    const query = queryMsg?.content ?? conv.messages.find((m) => m.role === 'user')?.content ?? '';

    await ChatFeedbackModel.findOneAndUpdate(
      { userId: user._id, query },
      {
        $set: {
          answer: ratedMsg.content,
          rating: conv.rating,
          comment: conv.comment,
          status: conv.status,
          messages: conv.messages,
          messageIndex: conv.ratedMessageIndex,
        },
        $setOnInsert: { userId: user._id, query },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    logger.info(
      {
        email: conv.studentEmail,
        scenario: conv.scenario,
        rating: conv.rating,
        turns: Math.floor(conv.messages.length / 2),
      },
      'Conversation upserted',
    );
    inserted++;
  }

  logger.info({ inserted, skipped }, 'Extended chat conversations seeded');
  await disconnectDatabase();
  logger.info('✅ Extended chat conversation seed complete.');
}

seed().catch(async (err) => {
  logger.error({ err }, 'Failed to seed extended chat conversations');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
