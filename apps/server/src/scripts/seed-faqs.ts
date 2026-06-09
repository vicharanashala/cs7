// Seeds canonical categories, tags, and FAQs from the official Vicharanashala FAQ (v21.0.0).
// Idempotent: re-running upserts by slug / title.
//
// Run: `npm --workspace @samagama/server run seed:faqs`
import { FAQ_CATEGORIES } from '@samagama/shared';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { logger } from '../config/logger.js';
import { CategoryModel } from '../models/Category.model.js';
import { TagModel } from '../models/Tag.model.js';
import { FaqModel } from '../models/Faq.model.js';
import { slugify } from '../utils/slugify.js';

const TAG_NAMES = [
  'noc',
  'certificate',
  'download',
  'login',
  'password',
  'attendance',
  'remote',
  'wfh',
  'leave',
  'stipend',
  'payment',
  'deadline',
  'project',
  'submission',
  'completion',
  'cohort',
  'bug',
  'policy',
  'vibe',
  'proctoring',
  'quiz',
  'video',
  'team-formation',
  'rosetta',
  'journal',
  'mentor',
  'offer-letter',
  'selection',
  'orientation',
  'start-date',
  'eligibility',
  'yaksha',
  'exam',
  'phase',
  'grace-period',
  'email',
  'iit-ropar',
  'online',
  'offline',
  'dates',
  'dashboard',
  'upload',
  'signature',
  'kickoff',
  'conduct',
  'interview',
];

interface SeedFaq {
  title: string;
  answer: string;
  summary?: string;
  categoryName: (typeof FAQ_CATEGORIES)[number];
  tags: string[];
}

const SEED_FAQS: SeedFaq[] = [
  // ── Section 1: About the Internship ──────────────────────────────────────────
  {
    title: 'What is the Vicharanashala internship?',
    answer:
      'A two-month internship run by Vicharanashala, a research lab at IIT Ropar. You will work on a real open-source project under a mentor, after a short training phase tailored to where you already are. The internship is free — we do not charge, and the work is real.',
    summary: 'Two-month free open-source internship at IIT Ropar under a mentor.',
    categoryName: 'Internship Guidelines',
    tags: ['cohort', 'mentor', 'iit-ropar'],
  },
  {
    title: 'What is VINS?',
    answer:
      'VINS is the Vicharanashala Internship — an online programme open to anyone who clears our interview. The work is real open-source contribution under a mentor, the certificate is from the Vicharanashala Lab for Education Design at IIT Ropar, and the programme itself is free (we charge nothing). There is no stipend. If you are seeing a yellow VINS panel on your result page, you are selected.',
    summary:
      'VINS = online internship track; free, no stipend, real open-source work, IIT Ropar certificate.',
    categoryName: 'Internship Guidelines',
    tags: ['selection', 'eligibility', 'online', 'iit-ropar'],
  },
  {
    title: 'What are the phases of VINS, and what do the badges mean?',
    answer:
      'VINS has four phases marked by badges:\n\n' +
      '• Bronze (Phase 1) — a short training period at the start, planned around what you already know. If you arrive already comfortable with the basics, your mentor may skip Bronze and put you straight on to the project.\n' +
      '• Silver (Phase 2) — the main work. You contribute to a real open-source project under a Vicharanashala mentor. Finishing Bronze and Silver completes your internship and earns the certificate.\n' +
      '• Gold (Phase 3) — a recognition awarded during Silver if your contribution stands on its own as a meaningful feature, not just a small fix.\n' +
      '• Platinum (Phase 4) — a standing invitation to visit the lab any time during the year after your internship ends. We help with travel through a small visit stipend.\n\n' +
      'Most interns finish at Bronze + Silver, and that is exactly what the certificate is for. Gold and Platinum are extras you can pick up if your work makes the case for them.',
    summary:
      'Bronze = training, Silver = main project (earns cert), Gold = significant feature, Platinum = lab visit.',
    categoryName: 'Internship Guidelines',
    tags: ['phase', 'cohort', 'certificate'],
  },
  {
    title: 'Who is the internship for? Are alumni eligible?',
    answer:
      'The internship is for currently-enrolled students at any college or university — undergraduate, postgraduate, or doctoral. Candidates who have already graduated and are not currently enrolled in any programme are not eligible for this cycle. If you re-enrol later (higher studies, etc.), you are very welcome to apply again in a future cycle.',
    summary: 'Currently-enrolled students only; graduated alumni are not eligible.',
    categoryName: 'Internship Guidelines',
    tags: ['eligibility', 'policy'],
  },
  {
    title: "Is this the same as IIT Ropar's official Summer Research Internship?",
    answer:
      'No. Summership 2026 is a VLED Lab initiative. The certificate is issued by the Vicharanashala Lab for Education Design, not centrally by the institute. IIT Ropar runs a separate institutional summer research internship through its own office. Do not represent Summership 2026 as equivalent to that programme.',
    summary: "No — this is a VLED Lab initiative, not IIT Ropar's central summer internship.",
    categoryName: 'Internship Guidelines',
    tags: ['iit-ropar', 'certificate', 'policy'],
  },
  {
    title: 'I have to attend my class during the internship — can I take leave?',
    answer:
      'Leave is not permitted. If you are also attending classes or exams, you will be relieved from the internship immediately and will need to join the next batch when it starts.',
    summary:
      'No leave for classes; attending classes during the internship results in immediate termination.',
    categoryName: 'Internship Guidelines',
    tags: ['leave', 'policy', 'exam'],
  },

  // ── Section 2: Timing and Dates ───────────────────────────────────────────────
  {
    title: 'When can I start the internship?',
    answer:
      'You can start any time in 2026 — VINS is flexible on the start date — but there are two things you must hold in mind together, and one strong recommendation.\n\n' +
      'The hard rule: your internship must finish by 31 December 2026. That date is non-negotiable. Whatever start you pick, your end date (start + 2 months, with up to 1 month grace) must land on or before 31 December 2026.\n\n' +
      'The strong recommendation: start as soon as possible. The earlier you join, the more of the May–July main cohort you catch. Cohort networking, TA support, and training rollout are all concentrated in this window.',
    summary:
      'Any time in 2026; must finish by 31 Dec 2026. Start early to catch the May–July cohort.',
    categoryName: 'Deadlines',
    tags: ['start-date', 'dates', 'deadline', 'cohort'],
  },
  {
    title: 'How long is the internship?',
    answer:
      'Two months from your chosen start date, with an optional one-month grace period if you need it. End must land on or before 31 December 2026.',
    summary: '2 months + optional 1-month grace; end by 31 Dec 2026.',
    categoryName: 'Deadlines',
    tags: ['dates', 'grace-period', 'deadline'],
  },
  {
    title: 'Can I start in July, August or later if I have exams now?',
    answer:
      'Yes — but only if your exams genuinely make an earlier start impossible. Wait until your exams are done, then opt in and start. Do not attempt to juggle this internship with ongoing exams. Make sure your chosen start date plus 2 months (or 3 with grace) lands on or before 31 December 2026.',
    summary: 'Yes, defer start until after exams; ensure end date still falls by 31 Dec 2026.',
    categoryName: 'Deadlines',
    tags: ['start-date', 'exam', 'dates'],
  },
  {
    title: 'Can I start with the cohort and take a break during my exam window?',
    answer:
      'No. This is not an arrangement we offer. VINS is a full-attention internship — six to ten hours a day, sometimes more. Splitting that with college exams damages both sides. If your exams fall inside the cohort duration, defer your start to after your exams end.\n\nA note on consequences: if we later learn that a candidate was sitting college exams during their internship period, we reserve the right to terminate the internship or withhold the certificate at any time — including after the internship has otherwise been completed.',
    summary: 'No breaks for exams; defer start until after exams end.',
    categoryName: 'Deadlines',
    tags: ['exam', 'leave', 'policy', 'cohort'],
  },
  {
    title: 'Can I take leave or get an exemption during the internship for an exam in June?',
    answer:
      'The attendance rule is firm — the 55-day continuous window is a non-negotiable part of the internship, and we cannot offer an exemption for an exam during this period.',
    summary: '55-day continuous window is non-negotiable; no exam exemptions.',
    categoryName: 'Deadlines',
    tags: ['leave', 'exam', 'policy', 'attendance'],
  },
  {
    title: 'Are orientation session recordings shared with interns?',
    answer:
      'Recordings of the sessions will not be provided. However, we may provide access to an abridged version of a talk or session if we consider it important. We do not guarantee this for every session.',
    summary: 'Full recordings are not shared; abridged versions may be provided selectively.',
    categoryName: 'Internship Guidelines',
    tags: ['orientation', 'kickoff'],
  },

  // ── Section 3: NOC ────────────────────────────────────────────────────────────
  {
    title: 'What dates do I put on the NOC?',
    answer:
      'Default: your chosen start date — your start + 2 months (with up to 1 month grace), ensuring the end date is on or before 31 December 2026. Pick the earliest start date you can realistically make — the May–July summer window is the main cohort. If the NOC will be signed on a specific later date, pick a start date after the signature date.',
    summary: 'Start date to start + 2 months (max grace + 1 month); end by 31 Dec 2026.',
    categoryName: 'NOC',
    tags: ['noc', 'dates', 'deadline'],
  },
  {
    title: 'Who can sign the NOC?',
    answer:
      'Any authorised signatory at your college: HOD, Acting HOD (during holidays), Principal, Dean, Director, or Training & Placement Officer. For dual-degree students, either institution can sign — pick whichever is easier. For IITM BS Online Degree (standalone) students, any officer from the BS office can sign.',
    summary:
      'HOD, Principal, Dean, Director, or T&P Officer; dual-degree students can use either institution.',
    categoryName: 'NOC',
    tags: ['noc', 'signature', 'upload'],
  },
  {
    title: 'When do I submit the NOC? Is the deadline hard?',
    answer:
      'The deadline is not hard — there is no specific cut-off date. But for the internship to actually begin properly, you should submit it as early as possible and join the current summer cohort. We strongly do not recommend starting later in the year.',
    summary: 'No hard deadline, but submit ASAP to join the summer cohort.',
    categoryName: 'NOC',
    tags: ['noc', 'deadline', 'cohort'],
  },
  {
    title: 'What format should the NOC be in? Do I need to design it myself?',
    answer:
      'No — we provide a printable NOC format. Once your result is out and you log in to samagama.in, you will see a "Download blank NOC" button on your dashboard. Take a printout, get it physically signed and stamped by your authorised signatory, scan it, and upload the signed PDF. You do not need to draft anything yourself, and you do not need college letterhead.',
    summary:
      'Download blank NOC from dashboard, print, sign, scan, upload — no custom format needed.',
    categoryName: 'NOC',
    tags: ['noc', 'download', 'upload', 'dashboard'],
  },
  {
    title: 'What if my college gives me an NOC in their own format?',
    answer:
      "A college's own NOC format is acceptable, as long as all four required entries are present: the signing authority's handwritten signature, the signing authority's official email address (we cross-check to verify), your full name, and your signature.",
    summary:
      'College format accepted if it has: authority signature, authority email, your name, your signature.',
    categoryName: 'NOC',
    tags: ['noc', 'signature', 'email'],
  },
  {
    title: 'Does the NOC need to be signed by hand?',
    answer:
      "Yes. Three things are required: the authorised signatory's handwritten signature, the institutional rubber stamp/seal applied in the designated area, and the signatory's email address filled in the designated field — we automatically cross-check to verify the signature is genuine. Digital signatures are not accepted on the PDF path.",
    summary:
      'Handwritten signature + institutional stamp + signatory email required; no digital signatures.',
    categoryName: 'NOC',
    tags: ['noc', 'signature'],
  },
  {
    title: 'Can my HOD email the NOC instead of signing a printout?',
    answer:
      'Yes — there is a fully-equivalent email-forward path.\n\n' +
      '1. From your dashboard, download the text NOC (the "Download text NOC (email path)" button).\n' +
      '2. Fill in the student-side fields, then email the file to your HOD and ask them to forward it.\n' +
      '3. Your HOD forwards the email to sudarshan@iitrpr.ac.in from their official institutional email address, with the subject line: "NOC for my student <Your Full Name>"\n\n' +
      'Two non-negotiable conditions: the forward must come from the HOD\'s official institutional email address (not a personal Gmail), and the subject line must start with "NOC for my student" so it routes correctly.',
    summary:
      'Yes — HOD forwards text NOC email from official address to sudarshan@iitrpr.ac.in with subject "NOC for my student <Name>".',
    categoryName: 'NOC',
    tags: ['noc', 'email', 'upload'],
  },
  {
    title: 'How do I download and upload the NOC?',
    answer:
      'Both happen on your dashboard at samagama.in once your result is out. Two buttons: "Download blank NOC" saves the printable NOC format PDF; "Upload signed NOC (PDF)" opens a file picker — the file must be a PDF of at most 1 MB.',
    summary:
      'Dashboard: "Download blank NOC" button to get template; "Upload signed NOC (PDF)" to submit (max 1 MB).',
    categoryName: 'NOC',
    tags: ['noc', 'download', 'upload', 'dashboard'],
  },
  {
    title: 'What if my NOC is not formally verified yet?',
    answer:
      'NOC verification takes time — typically anywhere between an hour and one full working day from the moment you upload. If you are planning to start soon and need your offer letter sooner, there is a tentative route: upload a self-declaration on your profile and a tentative offer letter will be issued to you immediately. The formal offer letter follows once your NOC clears verification.',
    summary:
      'Verification takes up to 1 working day; upload self-declaration to get tentative offer letter immediately.',
    categoryName: 'NOC',
    tags: ['noc', 'offer-letter', 'dashboard'],
  },
  {
    title: "My online course (Masai, NPTEL, Coursera) won't issue an NOC. What do I do?",
    answer:
      'The internship is open only to candidates currently enrolled in a full-time degree programme at a recognised college or university. Online-only courses — Masai Institute, NPTEL/MOOC enrolments, Coursera, Udacity, bootcamps, and similar — do not by themselves make a candidate eligible.',
    summary:
      'Online-only courses do not qualify; must be enrolled in a full-time degree programme.',
    categoryName: 'NOC',
    tags: ['noc', 'eligibility', 'online'],
  },
  {
    title: 'My HOD wants written confirmation before signing my NOC. What do I show them?',
    answer:
      'Use the tentative offer letter route: log in to samagama.in and open your profile, upload a brief self-declaration, and a tentative offer letter on Vicharanashala letterhead is issued to your dashboard immediately. Hand the tentative offer letter to your HOD/college official — it serves as the written confirmation they need to sign your NOC.',
    summary:
      'Upload self-declaration on dashboard → instant tentative offer letter to show your HOD.',
    categoryName: 'NOC',
    tags: ['noc', 'offer-letter', 'dashboard'],
  },
  {
    title: 'Can Prof. Sudarshan Iyengar or an IIT Ropar faculty member sign my NOC?',
    answer:
      'No. Your NOC must be signed by an authorised signatory at the institution where you are enrolled as a student. Sudarshan Iyengar is a faculty member at IIT Ropar and cannot sign your NOC in a personal capacity. An online-only certification course (even if offered jointly with an IIT) does not meet the eligibility requirement on its own.',
    summary:
      "No — NOC must be from your own institution's authorised signatory, not IIT Ropar faculty.",
    categoryName: 'NOC',
    tags: ['noc', 'signature', 'iit-ropar'],
  },

  // ── Section 4: Selection, Offer Letter, and Certificate ──────────────────────
  {
    title: 'How do I know I am selected?',
    answer:
      'If you can see your yellow VINS result panel on samagama.in, you are selected. There is no separate selection step or confirmation email.',
    summary: 'Yellow VINS panel on samagama.in = selected. No separate confirmation email.',
    categoryName: 'Selection & Offer',
    tags: ['selection', 'dashboard'],
  },
  {
    title: 'How do I opt into VINS?',
    answer:
      'Tell Yaksha in the chat: "I want to take up the online internship without stipend." Yaksha will confirm. Opting in is the selection — no separate confirmation email is sent at that stage.',
    summary: 'Tell Yaksha "I want to take up the online internship without stipend" to opt in.',
    categoryName: 'Selection & Offer',
    tags: ['selection', 'yaksha', 'online'],
  },
  {
    title: 'When do I get the offer letter?',
    answer:
      'There are two paths:\n\n' +
      'Path 1 — Formal offer letter (default): issued once your signed NOC has been verified (typically 1 hour to 1 working day after upload) AND you have confirmed your internship start and end dates on the dashboard.\n\n' +
      'Path 2 — Tentative offer letter (faster): upload a self-declaration on your profile instead. A tentative offer letter is issued immediately, and the formal offer letter follows once your NOC clears verification.\n\n' +
      'The offer letter lives on your dashboard at samagama.in, not in your email. You will receive a notification email from no-reply@vicharanashala.ai when it is ready.',
    summary:
      'Formal: after NOC verification + dates confirmed. Tentative: upload self-declaration for immediate issue. Both live on your dashboard.',
    categoryName: 'Selection & Offer',
    tags: ['offer-letter', 'noc', 'dashboard', 'dates'],
  },
  {
    title: 'Will I get a certificate?',
    answer:
      'Yes — every intern who completes the internship gets a certificate from Vicharanashala, IIT Ropar. Candidates who drop out mid-way do not get a certificate.',
    summary: 'Yes, upon completion. No certificate for mid-way dropouts.',
    categoryName: 'Certificates',
    tags: ['certificate', 'completion'],
  },
  {
    title: 'How do I confirm my internship dates?',
    answer:
      'Log in to samagama.in. On the dashboard, you will see a yellow card titled "Confirm your internship dates". The two date pickers pre-fill with sensible defaults for the current cohort. Your end must be on or before 31 December 2026. Order doesn\'t matter — you can save your dates before or after uploading your NOC.',
    summary: 'Dashboard → yellow "Confirm your internship dates" card; end by 31 Dec 2026.',
    categoryName: 'Selection & Offer',
    tags: ['dates', 'dashboard', 'deadline'],
  },
  {
    title: 'I am a minor/major in AI student at IIT Ropar — can I join?',
    answer:
      'Minor/Major in AI course from IIT Ropar is a certification course and there will be a different track of internship equivalent to them. Kindly write to us separately for this. You should be a registered student in a UG/PG programme with some university.',
    summary:
      'IIT Ropar AI minor/major has a separate track; write to us separately. Must be UG/PG registered.',
    categoryName: 'Selection & Offer',
    tags: ['eligibility', 'iit-ropar'],
  },
  {
    title: 'How do I accept the offer letter?',
    answer:
      'Reply to the offer-letter email from no-reply@vicharanashala.ai. In the body, paste the following acceptance statement exactly as printed, with your full name inserted and a date added:\n\n"I, [Full Name], confirm that I have read, understood, and accepted all terms, conditions, and obligations set out in this offer letter and in the program FAQ at samagama.in. I formally accept the offer of Summer Internship 2026."\n\nCopy-paste this sentence as-is. Do not paraphrase. The reply must reach us within 5 days of the offer letter being sent. Use Reply All.',
    summary:
      "Reply to offer email within 5 days using the exact acceptance statement (copy-paste, don't paraphrase).",
    categoryName: 'Selection & Offer',
    tags: ['offer-letter', 'email', 'policy'],
  },
  {
    title: 'What if I reply to the offer letter without using the exact acceptance format?',
    answer:
      'The offer is withdrawn, effective immediately, with no further correspondence. The withdrawal is final. Non-compliant examples include paraphrasing, a bare "I accept", missing the date, or missing the FAQ-reference clause.',
    summary:
      'Offer withdrawn immediately and permanently for any deviation from the exact acceptance format.',
    categoryName: 'Selection & Offer',
    tags: ['offer-letter', 'email', 'policy'],
  },
  {
    title:
      "I received a withdrawal email because I didn't accept the offer letter correctly. Can it be reversed?",
    answer:
      'Once withdrawn, the offer cannot be reversed. Please read the FAQ carefully and follow the process precisely.',
    summary: 'Withdrawn offers are final and cannot be reversed.',
    categoryName: 'Selection & Offer',
    tags: ['offer-letter', 'policy'],
  },
  {
    title: "What happens after I send my acceptance? My dashboard doesn't update.",
    answer:
      'The dashboard does not display a live acceptance status. Once your correctly formatted reply is received, processing happens on the admin side. You will receive a follow-up communication. Allow 24–48 hours.',
    summary: "Dashboard doesn't show live acceptance status; allow 24–48 hours for follow-up.",
    categoryName: 'Selection & Offer',
    tags: ['offer-letter', 'dashboard'],
  },
  {
    title: 'How do I change my internship dates before the offer letter is issued?',
    answer:
      'Edit the dates on the "Confirm your internship dates" card on your dashboard anytime before the offer letter is generated.',
    summary:
      'Edit via the "Confirm your internship dates" dashboard card before offer letter is generated.',
    categoryName: 'Selection & Offer',
    tags: ['dates', 'dashboard', 'offer-letter'],
  },
  {
    title: 'When and how do I get the Zoom link for the kickoff meeting?',
    answer:
      "The Zoom link for the kickoff meeting (orientation) is sent via email to your registered email address, typically 24–48 hours before the meeting. Check your spam/promotions folder if you don't see it.",
    summary: 'Zoom link sent by email 24–48 hours before kickoff; check spam if not received.',
    categoryName: 'Selection & Offer',
    tags: ['kickoff', 'orientation', 'email'],
  },
  {
    title: 'How to proceed if NOC is not available and my internship start date is approaching?',
    answer:
      'Upload a self-declaration on your profile to receive a tentative offer letter immediately. Pursue your NOC in parallel and upload it as soon as it is available. The formal offer letter will be issued automatically once the NOC is verified.',
    summary:
      'Upload self-declaration for tentative offer letter; formal offer letter follows after NOC verification.',
    categoryName: 'Selection & Offer',
    tags: ['noc', 'offer-letter', 'start-date', 'dashboard'],
  },
  {
    title: 'When does my internship actually begin? Will I receive a notification?',
    answer:
      'Your internship begins on your confirmed start date. There is no automated "start day" notification — your dashboard will reflect your active internship status. You are expected to be ready and working from that date.',
    summary:
      'Starts on your confirmed date; no automated notification — check dashboard for active status.',
    categoryName: 'Selection & Offer',
    tags: ['start-date', 'dashboard'],
  },
  {
    title: 'Can I switch from VINS (online) to VISE (offline) after being selected?',
    answer:
      'No. Once selected for VINS, switching to VISE (or vice versa) is not permitted for this cycle.',
    summary: 'No switching between VINS (online) and VISE (offline) once selected.',
    categoryName: 'Selection & Offer',
    tags: ['online', 'offline', 'policy'],
  },
  {
    title: 'Can I change my internship dates after the offer letter has been issued?',
    answer:
      'Date changes after offer letter issuance require a fresh NOC matching the new dates and admin approval. Reach out via Yaksha chat on your dashboard.',
    summary:
      'Date changes after offer letter need a new NOC and admin approval; contact via Yaksha.',
    categoryName: 'Selection & Offer',
    tags: ['dates', 'noc', 'offer-letter', 'yaksha'],
  },

  // ── Section 5: Work, Mentorship, and Projects ─────────────────────────────────
  {
    title: 'What will I work on during the internship?',
    answer:
      'Real open-source projects under a Vicharanashala mentor. The specific project is assigned based on your profile and team composition. Details are shared at the kickoff/orientation stage.',
    summary: 'Real open-source project assigned at kickoff based on your profile and team.',
    categoryName: 'Internship Guidelines',
    tags: ['project', 'mentor', 'kickoff'],
  },
  {
    title: 'How many hours per day is the internship?',
    answer:
      'Six to ten hours a day, sometimes more during intense phases. This is a full-attention internship.',
    summary: '6–10 hours per day; full-attention commitment required.',
    categoryName: 'Internship Guidelines',
    tags: ['policy', 'attendance'],
  },
  {
    title: 'Who is my mentor?',
    answer:
      'A Vicharanashala scholar or senior researcher assigned to your project. Mentor details are shared during or shortly after the orientation/kickoff.',
    summary: 'Vicharanashala scholar or senior researcher; details shared at/after kickoff.',
    categoryName: 'Internship Guidelines',
    tags: ['mentor', 'kickoff'],
  },
  {
    title: 'Is there a stipend for VINS?',
    answer:
      'No. VINS is free and has no stipend. (VISE — the offline track — has different terms.)',
    summary: 'VINS has no stipend; it is free to participate.',
    categoryName: 'Stipend',
    tags: ['stipend', 'online', 'offline'],
  },
  {
    title: 'Do I need my own laptop? Should I preload any software?',
    answer:
      'Yes, you need your own laptop. Specific software requirements are shared at orientation. In general: have Python, Git, and a working terminal environment set up before you start.',
    summary: 'Own laptop required; have Python, Git, and a terminal ready before start.',
    categoryName: 'Internship Guidelines',
    tags: ['orientation', 'policy'],
  },
  {
    title: 'I am using a different email on GitHub / Zoom / the learning platform. Is that okay?',
    answer:
      'Ideally use the same email as your Samagama registration. If you must use a different one, inform your mentor and the admin team via Yaksha chat so your activity can be tracked correctly.',
    summary:
      'Use your Samagama email where possible; if different, notify mentor and admin via Yaksha.',
    categoryName: 'Internship Guidelines',
    tags: ['email', 'yaksha', 'mentor'],
  },
  {
    title: 'Why has my mentor not been assigned yet or contacted me on day 1?',
    answer:
      'Mentor assignments are finalised after team formation (which happens during the first days of Bronze). If you are past team formation and still have no mentor contact, raise it via Yaksha chat on your dashboard.',
    summary:
      'Mentors assigned after team formation in Bronze; contact Yaksha if still unassigned after that.',
    categoryName: 'Internship Guidelines',
    tags: ['mentor', 'team-formation', 'yaksha', 'phase'],
  },

  // ── Section 6: Code of Conduct ────────────────────────────────────────────────
  {
    title: 'Are unofficial WhatsApp groups or Telegram channels for the cohort allowed?',
    answer:
      'Unofficial cohort-wide channels that purport to act on behalf of Vicharanashala or the wider internship cohort are not permitted. A four-person team thread for project coordination is fine. Any group that claims to speak for or represent the programme is not.',
    summary:
      'Small team threads fine; cohort-wide unofficial groups claiming to represent the programme are not permitted.',
    categoryName: 'Internship Guidelines',
    tags: ['conduct', 'policy', 'cohort', 'team-formation'],
  },

  // ── Section 7: Interviews ─────────────────────────────────────────────────────
  {
    title: 'My interview is not marked as complete on the dashboard — what do I do?',
    answer:
      'Contact the team via Yaksha chat on your dashboard. Do not assume the interview was not recorded — dashboard updates can take time. Provide your interview slot details in the message.',
    summary: 'Contact via Yaksha with slot details; dashboard updates can lag.',
    categoryName: 'Internship Guidelines',
    tags: ['interview', 'yaksha', 'dashboard'],
  },

  // ── Section 8: Certificate ────────────────────────────────────────────────────
  {
    title: 'Does Vicharanashala send a grade report to my university for internship credit?',
    answer:
      'No. Vicharanashala issues a completion certificate but does not send grade reports or evaluations to universities. If your university requires additional documentation for credit transfer, you will need to coordinate that separately.',
    summary:
      'No grade reports sent; certificate only. Coordinate credit transfer with your university separately.',
    categoryName: 'Certificates',
    tags: ['certificate', 'completion'],
  },
  {
    title: 'Does the certificate say whether it was online or offline?',
    answer:
      'Yes. The certificate reflects the mode of the internship — online (VINS) or offline (VISE) — as applicable.',
    summary: 'Certificate specifies VINS (online) or VISE (offline).',
    categoryName: 'Certificates',
    tags: ['certificate', 'online', 'offline'],
  },
  {
    title: 'Will the completion certificate be a physical hardcopy or an e-certificate?',
    answer: 'An e-certificate is issued. There is no physical hardcopy by default.',
    summary: 'E-certificate only; no physical hardcopy.',
    categoryName: 'Certificates',
    tags: ['certificate', 'completion'],
  },
  {
    title: 'Is there a WhatsApp group for candidates during the internship?',
    answer:
      'There is no official Vicharanashala WhatsApp group for the full cohort. Official communication happens via email and Yaksha chat on samagama.in.',
    summary: 'No official WhatsApp group; use email and Yaksha chat on samagama.in.',
    categoryName: 'Internship Guidelines',
    tags: ['conduct', 'yaksha', 'cohort'],
  },

  // ── Section 9: Rosetta ────────────────────────────────────────────────────────
  {
    title: 'What is Rosetta?',
    answer:
      'Rosetta is your personal internship journal — a structured, daily reflective log you maintain throughout the internship. It is named after the Rosetta Stone: something that helps translate experience into understanding.',
    summary: 'Rosetta is your daily reflective internship journal for structured learning.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal'],
  },
  {
    title: 'Why does the Rosetta journal exist? Is it just busywork?',
    answer:
      'It is not busywork. The thinking routines embedded in Rosetta are a core part of the Vicharanashala pedagogy. Consistent reflection accelerates learning, improves problem-solving, and makes your work legible — to yourself first, and to your mentor.',
    summary:
      'Core pedagogy tool; consistent reflection accelerates learning and benefits mentor communication.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal', 'mentor'],
  },
  {
    title: 'What is a "thinking routine" in Rosetta?',
    answer:
      'A short, structured prompt that directs your attention to a specific aspect of your learning or work — for example, "what surprised me today", "what I would do differently", or "what I still don\'t understand". Think of it as cognitive scaffolding.',
    summary:
      "Short structured prompts guiding your reflection — e.g., what surprised you, what you'd do differently.",
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal'],
  },
  {
    title: 'How do I get my Rosetta journal?',
    answer:
      'Your Rosetta journal is provided to you as part of your onboarding materials, shared at or shortly after the orientation/kickoff session.',
    summary: 'Provided at/after orientation as part of onboarding materials.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal', 'kickoff', 'orientation'],
  },
  {
    title: 'How do I use Rosetta day to day?',
    answer:
      "At the end of each working day, open your journal and respond to the day's prompts. Keep it brief and honest. The point is consistent, genuine reflection — not a polished essay.",
    summary:
      'Fill in prompts at end of each working day; brief and honest is better than polished.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal'],
  },
  {
    title: 'How long should each Rosetta entry be?',
    answer:
      'There is no minimum or maximum. Write enough to genuinely address the prompt — typically a few sentences to a short paragraph per prompt. Quality of reflection matters more than length.',
    summary: 'No length requirement; a few sentences to a short paragraph per prompt is typical.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal'],
  },
  {
    title: 'What is the one rule for the Rosetta journal?',
    answer:
      'Write it yourself. No AI tools, no copy-paste from the internet, no asking a friend. The journal is only useful if it represents your actual thinking.',
    summary: 'Write it yourself — no AI tools, no copy-paste, no asking others.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal', 'policy'],
  },
  {
    title: 'Can I use ChatGPT or any AI tool to write my Rosetta entries?',
    answer:
      "No. Using AI to write your journal entries defeats the entire purpose and is a violation of the internship's academic integrity expectations.",
    summary: 'No AI tools for Rosetta entries — violates academic integrity.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal', 'policy', 'conduct'],
  },
  {
    title: 'What if I miss a day in my Rosetta journal?',
    answer:
      'Write a brief catch-up entry noting that you missed a day and why. Patterns of missed days without explanation are noted and may affect your evaluation.',
    summary: 'Write a catch-up note for missed days; unexplained patterns may affect evaluation.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal', 'attendance'],
  },
  {
    title: 'Will my mentor read my Rosetta journal?',
    answer:
      'Your mentor may review your journal periodically. It is one of the signals they use to understand how you are progressing and where you need support.',
    summary: 'Yes, mentors may review periodically to track your progress.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal', 'mentor'],
  },
  {
    title: 'Can Rosetta prompts change mid-internship?',
    answer:
      "Yes. Prompts may be updated to reflect the phase of the internship or to address emerging themes in the cohort's work. Updates will be communicated.",
    summary: 'Yes, prompts may update mid-internship; changes will be communicated.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal', 'cohort'],
  },
  {
    title: 'How do I submit my Rosetta journal at the end of the internship?',
    answer:
      'Submission instructions are shared as part of the end-of-internship checklist. The journal is typically submitted digitally via your dashboard.',
    summary: 'Submitted digitally via dashboard; instructions in end-of-internship checklist.',
    categoryName: 'Rosetta',
    tags: ['rosetta', 'journal', 'submission', 'dashboard'],
  },
  {
    title:
      "My college needs written confirmation that the internship won't clash with classes. What do I share?",
    answer:
      'The offer letter (tentative or formal) on Vicharanashala letterhead serves as the official documentation. If your college needs additional assurance, you may also point them to the public programme page at samagama.in/internship.',
    summary:
      'Provide the offer letter from dashboard; also point to samagama.in/internship if needed.',
    categoryName: 'Rosetta',
    tags: ['offer-letter', 'policy'],
  },

  // ── Section 10: Phase 1 — Coursework, Vibe LMS, and Live Sessions ────────────
  {
    title: "I've previously interned with VLED — am I exempt from Phase 1 coursework?",
    answer:
      'Exemptions from Phase 1 coursework are assessed on a case-by-case basis by your mentor. Raise it at your first mentor check-in with specifics of what you have already covered.',
    summary: 'Exemptions are case-by-case; raise with your mentor at first check-in.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'phase', 'mentor'],
  },
  {
    title: 'How do I register for the AI Fundamentals course on ViBe?',
    answer:
      'An invite link is sent to your registered email address during onboarding. Use that link to register on the Vibe platform. If you have not received the invite, check spam and then raise it via Yaksha chat.',
    summary: 'Use invite link sent to your email during onboarding; check spam if not received.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'email', 'yaksha'],
  },
  {
    title: 'I registered on ViBe with a different email than my Samagama email. Is that OK?',
    answer:
      'It can cause tracking issues. Inform the admin team via Yaksha chat immediately so they can reconcile your accounts.',
    summary: 'Causes tracking issues; notify admin via Yaksha immediately to reconcile.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'email', 'yaksha'],
  },
  {
    title: "Are live sessions mandatory if I'm on the viva route?",
    answer:
      'The viva route exempts you from the Vibe course assessments, not from live sessions. Live sessions attendance expectations are communicated by your mentor at the start of Phase 1.',
    summary:
      'Viva route skips Vibe assessments only; live sessions still apply per mentor guidance.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'phase', 'mentor', 'attendance'],
  },
  {
    title: 'Where do I find the daily live-session schedule?',
    answer: 'The schedule is shared via email and on your dashboard. Check both regularly.',
    summary: 'Schedule shared via email and dashboard; check both regularly.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'dashboard', 'email'],
  },

  // ── Section 11: Yaksha Chat ───────────────────────────────────────────────────
  {
    title: "I'm unable to type in the Yaksha chat — what should I do?",
    answer:
      'Try the following in order:\n1. Refresh the page.\n2. Clear your browser cache and reload.\n3. Try a different browser (Chrome or Firefox on desktop are preferred).\n4. If none of the above work, report the issue via the Flag option if visible, or email the support address listed on the dashboard.',
    summary: 'Refresh → clear cache → try Chrome/Firefox → flag or email support.',
    categoryName: 'Technical Issues',
    tags: ['yaksha', 'bug', 'login'],
  },

  // ── Section 12: ViBe Platform ─────────────────────────────────────────────────
  {
    title: 'How do I log in to ViBe?',
    answer:
      'Use the invite link sent to your registered email. Log in with the credentials you set during registration. Do not create a new account manually — use the invite link.',
    summary: 'Use the invite link from your email; do not create a new account manually.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'login', 'email'],
  },
  {
    title: 'ViBe shows "No course enrolled" after accepting the invite. What do I do?',
    answer:
      'This is usually a propagation delay. Wait 15–30 minutes and refresh. If it persists after an hour, raise it via Yaksha chat with your registered email and the invite link you used.',
    summary: 'Wait 15–30 min and refresh; if persists after 1 hour, contact Yaksha.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'bug', 'yaksha'],
  },
  {
    title: 'Why are ViBe videos stuck or repeating?',
    answer:
      'Common causes: switching tabs (which the proctoring system detects), browser compatibility issues, or slow internet. See the full troubleshooting guide for video issues.',
    summary:
      'Usually caused by tab switching, browser issues, or slow internet; see troubleshooting steps.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'video', 'proctoring', 'bug'],
  },
  {
    title: 'Can I use a mobile or tablet for ViBe?',
    answer:
      'ViBe is designed for desktop/laptop use. Mobile and tablet use is not recommended and may cause tracking or proctoring issues.',
    summary: 'Desktop/laptop only; mobile/tablet not recommended due to proctoring issues.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring'],
  },
  {
    title:
      "I'm experiencing video issues (stuck, looping, skipping) on ViBe. How do I troubleshoot?",
    answer:
      'Try in order:\n1. Stay on the ViBe tab — do not switch tabs or minimise the window.\n2. Use Chrome or Firefox on a desktop/laptop.\n3. Clear browser cache, then reload.\n4. Check your internet connection stability.\n5. Disable browser extensions (especially ad-blockers or privacy extensions).\n6. If the issue persists, use the Flag option on ViBe to report the specific video/quiz, or raise via Yaksha chat.',
    summary:
      'Stay on tab → Chrome/Firefox desktop → clear cache → check internet → disable extensions → Flag or Yaksha.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'video', 'bug', 'proctoring'],
  },
  {
    title:
      'I completed all ViBe videos and quizzes but my progress shows less than 100%. What do I do?',
    answer:
      'Progress updates can lag. Wait a few hours and refresh. If still not resolved, use the Flag option on ViBe or raise via Yaksha chat with your registered email and a screenshot.',
    summary: 'Wait a few hours; if unresolved, flag on ViBe or contact Yaksha with screenshot.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'video', 'bug', 'yaksha'],
  },
  {
    title: 'I am unhappy with the ViBe content or platform. Can I request an exception or bypass?',
    answer:
      'No exceptions or bypasses are available. Feedback on content quality can be submitted via the Flag option.',
    summary: 'No exceptions or bypasses; submit content feedback via the Flag option.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'policy'],
  },
  {
    title: "Is the ViBe consent form compulsory? What if I don't want to grant camera access?",
    answer:
      'The consent form is compulsory for participation in the ViBe course as part of this internship. Camera access is required for the proctoring system.',
    summary: 'Consent form is compulsory; camera access required for proctoring.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring', 'policy'],
  },
  {
    title: 'What are penalty scores on ViBe, and how do they affect my performance?',
    answer:
      'Penalty scores are issued when the proctoring system detects behaviour that violates learning integrity rules (tab-switching, multiple faces, no face detected, etc.). They are factored into your Phase 1 evaluation. Minimise penalties by following study environment guidelines.',
    summary: 'Penalties for tab-switching, multiple faces, etc.; factored into Phase 1 evaluation.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring', 'phase'],
  },
  {
    title: 'When should I use the Flag option on ViBe, and when should I contact support?',
    answer:
      'Use Flag for content issues (incorrect questions, broken videos, platform bugs). Contact support via Yaksha chat for account issues, access problems, or anything that requires a human to intervene.',
    summary: 'Flag = content/platform bugs; Yaksha = account issues, access problems.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'bug', 'yaksha'],
  },
  {
    title: 'What is Linear Progression on ViBe?',
    answer:
      'Linear Progression means you must complete each video/quiz in sequence before the next one unlocks. You cannot skip ahead.',
    summary: 'Must complete each video/quiz in order before the next unlocks; no skipping.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'video', 'quiz'],
  },
  {
    title: 'Can I use the left navigation panel to jump ahead to a later video on ViBe?',
    answer:
      'No. Under Linear Progression, the navigation panel shows you where you are but does not allow jumping ahead to locked content.',
    summary: 'Navigation panel is read-only; cannot jump ahead to locked content.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'video'],
  },
  {
    title: 'I am seeing a red "Access Restricted" banner on ViBe. Is this a bug?',
    answer:
      'No — it is intentional. "Access Restricted" appears when you attempt to access content before completing the prerequisite. Complete the prior video and/or quiz fully (including achieving the pass threshold if a quiz is involved), then proceed. If you believe you have completed the prerequisite and the banner persists, use the Flag option or Yaksha chat.',
    summary:
      'Not a bug; complete the prerequisite video/quiz to unlock. Use Flag or Yaksha if it persists incorrectly.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'bug', 'video', 'quiz'],
  },
  {
    title: 'Why does ViBe sometimes make me re-watch a clip after a quiz?',
    answer:
      'If you score below the pass threshold on a quiz, the system loops you back to the relevant video section so you can review the material before re-attempting the quiz. This is by design.',
    summary:
      'Scoring below pass threshold on a quiz loops you back to review the video — by design.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'quiz', 'video'],
  },
  {
    title: 'What kinds of quiz questions will I see on ViBe?',
    answer:
      'Multiple-choice, true/false, and occasionally short conceptual questions embedded between video segments. Questions are drawn directly from the video content.',
    summary: 'MCQ, true/false, and short conceptual questions drawn from video content.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'quiz'],
  },
  {
    title: 'What does the "quiet helper" on ViBe actually do?',
    answer:
      'The quiet helper is a low-visibility overlay that gives you real-time, unobtrusive feedback when the proctoring system detects a potential issue (e.g., face not visible). It nudges you to correct the issue before a penalty is logged.',
    summary:
      'Real-time subtle overlay that warns you of proctoring issues before a penalty is issued.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring'],
  },
  {
    title: "Does ViBe record continuous video of me while I'm learning?",
    answer:
      'ViBe takes periodic snapshots for proctoring — it does not record continuous video. Snapshots are reviewed if a violation is flagged.',
    summary: 'Periodic snapshots only, not continuous video; reviewed only on flagged violations.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring'],
  },
  {
    title: 'What is the most common avoidable mistake on ViBe?',
    answer:
      'Switching to another tab or application during a ViBe session. The proctoring system registers this and issues a penalty. Keep the ViBe tab in focus at all times during a session.',
    summary: 'Tab-switching is the #1 avoidable mistake — always keep ViBe tab in focus.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring'],
  },
  {
    title: "Why does ViBe keep pausing or restarting even when I'm paying attention?",
    answer:
      'The most likely cause is a brief moment where your face was not visible to the camera (looking down at notes, moving away from the screen, etc.). Keep your face visible and centred in the camera view throughout the session.',
    summary:
      'Face must stay visible and centred in camera; looking away briefly can trigger a pause.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring'],
  },
  {
    title: 'Can I read quiz questions aloud or mutter to myself while watching on ViBe?',
    answer:
      'Yes — speaking to yourself is fine and does not trigger proctoring flags. Just ensure you remain the only person visible on camera.',
    summary: 'Muttering to yourself is fine; just stay as the only visible person.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring'],
  },
  {
    title: "Can I study with a friend on camera since we're learning together on ViBe?",
    answer:
      'No. Multiple faces visible to the camera will trigger a proctoring flag. Study individually, even if you are in the same room as a friend.',
    summary: 'Multiple faces triggers a proctoring flag; study alone on camera.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring', 'conduct'],
  },
  {
    title: 'Will I lose my ViBe progress if I clear my browser or reinstall it?',
    answer:
      'No — your progress is stored server-side, not in your browser. Clearing browser cache or reinstalling does not affect your course progress. You may need to log in again.',
    summary: 'Progress is server-side; clearing cache or reinstalling browser has no effect.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'bug', 'login'],
  },
  {
    title: 'Is there a recommended daily learning rhythm on ViBe?',
    answer:
      'Complete one to two module segments per day rather than marathon sessions. This gives the system time to sync your progress and reduces the risk of proctoring fatigue.',
    summary: '1–2 module segments per day recommended; avoid marathon sessions.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'attendance'],
  },
  {
    title: 'What should my study environment look like before starting a ViBe session?',
    answer:
      'Single, well-lit room — no other people in camera view. Face clearly visible and centred in the webcam. ViBe tab as the only active tab (or at least in foreground). Stable internet connection. Headphones preferred to reduce audio distraction flags. Phone face-down and notifications silenced.',
    summary:
      'Well-lit room, alone on camera, ViBe tab in focus, stable internet, headphones, phone silenced.',
    categoryName: 'ViBe Platform',
    tags: ['vibe', 'proctoring'],
  },

  // ── Section 13: Team Formation ────────────────────────────────────────────────
  {
    title: 'Is team formation compulsory?',
    answer: 'Yes. Team formation is a mandatory part of the Phase 1 — Phase 2 transition.',
    summary: 'Mandatory part of the Phase 1 to Phase 2 transition.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'phase'],
  },
  {
    title: 'What is the size of a team?',
    answer: 'Teams are typically four members.',
    summary: 'Typically 4 members per team.',
    categoryName: 'Team Formation',
    tags: ['team-formation'],
  },
  {
    title: 'How are teams formed?',
    answer:
      'During a structured team formation activity at the start of the internship, you connect with other interns and self-organise into teams of four. The activity is facilitated — you are not left to find teammates entirely on your own.',
    summary: 'Facilitated self-organise activity at start of internship; groups of four.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'cohort'],
  },
  {
    title: "I started on May 15/16 but couldn't form a team during the activity. What happens now?",
    answer:
      'Raise it immediately via Yaksha chat on your dashboard. Admin will either assign you to an existing team with an opening or wait for the next formation window.',
    summary:
      'Contact Yaksha immediately; admin will assign you to a team or next formation window.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'yaksha', 'dashboard'],
  },
  {
    title: 'There was a typo in our email addresses during team formation. Can we fix it?',
    answer:
      'Yes — raise it immediately via Yaksha chat before teams are finalised. Corrections after finalisation are harder to process.',
    summary: 'Raise via Yaksha before finalisation; corrections are harder after.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'yaksha', 'email'],
  },
  {
    title: 'I formed a team with only two members. Will it be considered?',
    answer:
      'No. Teams must have the required number of members. A two-member team is not valid. You will need to find additional teammates before finalisation.',
    summary: 'Two-member teams are invalid; find additional teammates before finalisation.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'policy'],
  },
  {
    title: 'What if a team member leaves or becomes ineligible during Phase 1?',
    answer:
      'Report it to your mentor/admin via Yaksha chat immediately. The team will be adjusted accordingly.',
    summary: 'Report to mentor/admin via Yaksha immediately; team will be adjusted.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'yaksha', 'phase', 'mentor'],
  },
  {
    title: 'Can I form a team with someone from my own college?',
    answer:
      'This is discouraged but not prohibited. The programme benefits from cross-institutional teams. If you have no alternative, it is allowed.',
    summary: 'Discouraged but allowed if no alternative; cross-institutional teams are preferred.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'policy'],
  },
  {
    title: 'Can we change our team name after submission?',
    answer: 'No. Team names are locked after submission.',
    summary: 'Team names are locked after submission; no changes allowed.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'policy'],
  },
  {
    title: 'What if multiple teams choose the same team name?',
    answer: 'Admin will contact the teams involved and ask one to choose a different name.',
    summary: 'Admin contacts teams with duplicate names and asks one to change.',
    categoryName: 'Team Formation',
    tags: ['team-formation'],
  },
  {
    title: 'What should I do if I face issues within my team?',
    answer: 'Raise it with your mentor first. If unresolved, escalate via Yaksha chat to admin.',
    summary: 'Raise with mentor first; escalate to admin via Yaksha if unresolved.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'mentor', 'yaksha'],
  },
  {
    title: 'How will I know who my mentor is after team formation?',
    answer:
      'Mentor details are shared via email and on your dashboard after team assignments are finalised.',
    summary: 'Mentor details sent via email and dashboard after team assignments are finalised.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'mentor', 'email', 'dashboard'],
  },
  {
    title: 'When will I know my team details?',
    answer:
      'Team details are communicated via email after the team formation and assignment process is complete — typically within a few days of the formation activity.',
    summary: 'Communicated via email typically within a few days of the formation activity.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'email'],
  },
  {
    title: 'I received a team list email but my name is not included. What should I do?',
    answer:
      'Contact admin immediately via Yaksha chat with your registered email and the email you received, so the discrepancy can be corrected.',
    summary: 'Contact Yaksha immediately with both your registered email and the received email.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'yaksha', 'email'],
  },
  {
    title:
      'We selected Project X as our top priority but were assigned Project Y. Can we change it?',
    answer:
      'Project assignments are final. The assignment process balances multiple factors across all teams and cannot accommodate individual reassignment requests.',
    summary: 'Project assignments are final; no individual reassignments.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'project', 'policy'],
  },
  {
    title: 'I just started the internship. Can I form my own team now?',
    answer:
      'Team formation happens at defined windows during Phase 1. If you have just started, check your dashboard and Yaksha chat for the current status and next steps.',
    summary:
      'Team formation happens at defined Phase 1 windows; check dashboard and Yaksha for status.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'phase', 'dashboard', 'yaksha'],
  },
  {
    title: 'When do team activities begin?',
    answer:
      'Team activities (Phase 2 / Silver) begin after Phase 1 / Bronze is complete and teams have been assigned and oriented.',
    summary: 'Phase 2 (Silver) begins after Phase 1 (Bronze) is complete and teams are assigned.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'phase'],
  },
  {
    title: 'Can I request a specific teammate after teams are assigned?',
    answer: 'No. Team assignments are final and requests for changes are not entertained.',
    summary: 'Team assignments are final; no teammate change requests.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'policy'],
  },
  {
    title: 'What happens if a team member is inactive or not contributing?',
    answer:
      'You should report the issue to your mentor/scholar early. Prolonged inactivity may lead to administrative intervention.',
    summary: 'Report to mentor early; prolonged inactivity may lead to admin intervention.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'mentor', 'conduct'],
  },
  {
    title: 'Can I switch teams if there are conflicts?',
    answer:
      'Team switches are not allowed except in exceptional, admin-approved cases involving serious concerns.',
    summary: 'No team switches except in exceptional admin-approved cases.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'policy'],
  },
  {
    title: 'Will team performance affect individual evaluation?',
    answer:
      'Yes. While some components may be individual, team deliverables are a key part of evaluation.',
    summary:
      'Yes — team deliverables are a key part of evaluation alongside individual components.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'policy', 'submission'],
  },
  {
    title: 'How will communication happen within teams?',
    answer:
      'Teams are expected to self-organize internal team coordination (e.g., a small WhatsApp/email thread limited to the four teammates). Official programme updates continue via email and Yaksha chat on samagama.in.',
    summary: 'Self-organize internally (small team chat); official comms via email and Yaksha.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'conduct'],
  },
  {
    title: 'What if I miss the team allocation email?',
    answer:
      'All communication is sent via registered email. You are responsible for checking regularly, including spam folders.',
    summary: 'Your responsibility to monitor registered email including spam folders.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'email'],
  },
  {
    title: 'Can a team be dissolved and reformed after finalisation?',
    answer: 'No. Once finalized, teams are locked and cannot be dissolved.',
    summary: 'Teams are permanently locked after finalisation.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'policy'],
  },
  {
    title: 'What happens if I drop out of the internship after team formation?',
    answer:
      'Your team will be adjusted accordingly, and the remaining members may continue as a team of three or receive a replacement.',
    summary: 'Team adjusted; remaining members continue as three or get a replacement.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'policy'],
  },
  {
    title: 'Will we get time to get to know our teammates before Phase 2?',
    answer:
      'Yes. There is typically a buffer period before Phase 2 where teams can connect and prepare.',
    summary: 'Yes, a buffer period before Phase 2 allows teams to connect.',
    categoryName: 'Team Formation',
    tags: ['team-formation', 'phase'],
  },
];

async function seed(): Promise<void> {
  await connectDatabase();

  // Migration: rename legacy "General" category to "Other"
  const legacy = await CategoryModel.findOne({ slug: 'general' });
  if (legacy) {
    legacy.name = 'Other';
    legacy.slug = 'other';
    await legacy.save();
    logger.info('Renamed legacy "General" category to "Other"');
  }

  // Categories
  const categoriesByName = new Map<string, string>();
  for (const name of FAQ_CATEGORIES) {
    const slug = slugify(name);
    const cat = await CategoryModel.findOneAndUpdate(
      { slug },
      { name, slug, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    categoriesByName.set(name, cat.id);
  }
  logger.info({ count: categoriesByName.size }, 'Categories seeded');

  // Tags
  const tagsByName = new Map<string, string>();
  for (const name of TAG_NAMES) {
    const slug = slugify(name);
    const tag = await TagModel.findOneAndUpdate(
      { slug },
      { name, slug, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    tagsByName.set(name, tag.id);
  }
  logger.info({ count: tagsByName.size }, 'Tags seeded');

  // FAQs
  for (const seedFaq of SEED_FAQS) {
    const categoryId = categoriesByName.get(seedFaq.categoryName);
    if (!categoryId) {
      logger.warn({ category: seedFaq.categoryName }, 'Skipping FAQ: missing category');
      continue;
    }
    const tagIds = seedFaq.tags
      .map((t) => tagsByName.get(t))
      .filter((id): id is string => Boolean(id));

    await FaqModel.findOneAndUpdate(
      { title: seedFaq.title },
      {
        $set: {
          title: seedFaq.title,
          answer: seedFaq.answer,
          summary: seedFaq.summary,
          categories: [categoryId],
          tags: tagIds,
          status: 'published',
          publishedAt: new Date(),
        },
        $setOnInsert: {
          slug: `${slugify(seedFaq.title)}-${Date.now().toString(36)}`,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  logger.info({ count: SEED_FAQS.length }, 'FAQs seeded');

  await disconnectDatabase();
  logger.info('FAQ seed complete.');
}

seed().catch(async (err) => {
  logger.error({ err }, 'Failed to seed FAQs');
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
