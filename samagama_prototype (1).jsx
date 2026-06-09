import { useState, useEffect } from 'react';
import {
  Home,
  BookOpen,
  HelpCircle,
  Users,
  Settings,
  Bell,
  Search,
  Moon,
  Sun,
  ChevronRight,
  Flag,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  LayoutDashboard,
  MessageSquare,
  Bot,
  Clock,
  Eye,
  Edit,
  Send,
  X,
  Menu,
  ThumbsUp,
  ThumbsDown,
  GitMerge,
  Archive,
  Layers,
  MessageCircle,
  Bookmark,
  Hash,
  Shield,
  Star,
} from 'lucide-react';

const T = {
  light: {
    bg: '#f0f4f8',
    sidebar: '#0f2744',
    sidebarHover: 'rgba(255,255,255,0.08)',
    sidebarActive: 'rgba(8,145,178,0.35)',
    sidebarText: 'rgba(255,255,255,0.65)',
    sidebarActiveText: '#7dd3fc',
    sidebarBorder: 'rgba(255,255,255,0.1)',
    topbar: '#ffffff',
    card: '#ffffff',
    text: '#0f172a',
    textMuted: '#64748b',
    border: '#e2e8f0',
    accent: '#0891b2',
    accentBg: '#e0f2fe',
    accentText: '#0e7490',
    success: '#059669',
    successBg: '#d1fae5',
    warning: '#d97706',
    warningBg: '#fef3c7',
    danger: '#dc2626',
    dangerBg: '#fee2e2',
    pill: '#f1f5f9',
    pillText: '#475569',
    input: '#f8fafc',
    shadow: '0 1px 3px rgba(0,0,0,0.08)',
  },
  dark: {
    bg: '#0b1628',
    sidebar: '#060e1c',
    sidebarHover: 'rgba(255,255,255,0.06)',
    sidebarActive: 'rgba(8,145,178,0.3)',
    sidebarText: 'rgba(255,255,255,0.55)',
    sidebarActiveText: '#7dd3fc',
    sidebarBorder: 'rgba(255,255,255,0.07)',
    topbar: '#131e30',
    card: '#131e30',
    text: '#f1f5f9',
    textMuted: '#94a3b8',
    border: '#1e3048',
    accent: '#0891b2',
    accentBg: '#0c3047',
    accentText: '#38bdf8',
    success: '#10b981',
    successBg: '#042f1a',
    warning: '#f59e0b',
    warningBg: '#2d1a00',
    danger: '#f87171',
    dangerBg: '#2d0a0a',
    pill: '#1e3048',
    pillText: '#94a3b8',
    input: '#0b1628',
    shadow: '0 1px 4px rgba(0,0,0,0.3)',
  },
};

const CATS = [
  'NOC',
  'Technical Issues',
  'Login & Access',
  'Certificates',
  'Attendance',
  'Stipend',
  'Deadlines',
  'Project Submission',
  'Internship Guidelines',
  'General',
];

const FAQS = [
  {
    id: 1,
    title: 'How do I download my NOC certificate?',
    cat: 'NOC',
    tags: ['noc', 'certificate', 'download'],
    status: 'Published',
    views: 342,
    helpful: 89,
    updated: '2 days ago',
    answer:
      'Log in to the portal, navigate to Documents, and click on NOC Certificate to download it as a PDF.',
  },
  {
    id: 2,
    title: 'Login issues after password reset',
    cat: 'Login & Access',
    tags: ['login', 'password'],
    status: 'Published',
    views: 218,
    helpful: 76,
    updated: '5 days ago',
    answer:
      'Clear your browser cache, use the latest password, and ensure third-party cookies are enabled.',
  },
  {
    id: 3,
    title: 'How to mark attendance for remote days?',
    cat: 'Attendance',
    tags: ['attendance', 'remote', 'wfh'],
    status: 'Published',
    views: 189,
    helpful: 92,
    updated: '1 week ago',
    answer: 'Use the Remote Attendance button under Attendance > Mark Today before 10 AM.',
  },
  {
    id: 4,
    title: 'Certificate of completion — when is it issued?',
    cat: 'Certificates',
    tags: ['certificate', 'completion'],
    status: 'Published',
    views: 156,
    helpful: 81,
    updated: '3 days ago',
    answer: 'Certificates are issued within 7 working days of your internship end date.',
  },
  {
    id: 5,
    title: 'Stipend disbursement schedule for Q2',
    cat: 'Stipend',
    tags: ['stipend', 'payment'],
    status: 'Published',
    views: 134,
    helpful: 88,
    updated: '1 day ago',
    answer: "Stipends are processed on the 5th of each month for the previous month's work.",
  },
  {
    id: 6,
    title: 'How to submit the final project report?',
    cat: 'Project Submission',
    tags: ['project', 'submission'],
    status: 'Outdated',
    views: 98,
    helpful: 45,
    updated: '3 weeks ago',
    answer: 'Submit via Projects > Final Report before the deadline indicated on your dashboard.',
  },
];

const QUESTIONS = [
  {
    id: 1,
    title: 'Can I use a personal laptop for remote work?',
    cat: 'Internship Guidelines',
    tags: ['remote', 'equipment'],
    status: 'Open',
    answers: 3,
    date: '2h ago',
    author: 'Priya S.',
  },
  {
    id: 2,
    title: "NOC still shows 'Pending' after internship ended?",
    cat: 'NOC',
    tags: ['noc', 'bug'],
    status: 'Resolved',
    answers: 5,
    date: '1 day ago',
    author: 'Rahul M.',
  },
  {
    id: 3,
    title: 'Attendance not reflecting after manual correction?',
    cat: 'Attendance',
    tags: ['attendance', 'bug'],
    status: 'Open',
    answers: 1,
    date: '3h ago',
    author: 'Anjali K.',
  },
  {
    id: 4,
    title: 'How many leaves are allowed per month?',
    cat: 'Attendance',
    tags: ['leave', 'policy'],
    status: 'Answered',
    answers: 7,
    date: '2 days ago',
    author: 'Vikram T.',
  },
  {
    id: 5,
    title: 'Stipend deducted for sick leave — is this correct?',
    cat: 'Stipend',
    tags: ['stipend', 'leave'],
    status: 'Open',
    answers: 2,
    date: '4h ago',
    author: 'Sneha P.',
  },
];

const PENDING = [
  {
    id: 1,
    q: 'Can I use a personal laptop for remote work?',
    a: 'Yes, personal laptops are allowed provided you have VPN access and follow IT security guidelines shared during onboarding.',
    by: 'Kiran D.',
    date: '2h ago',
  },
  {
    id: 2,
    q: 'How many leaves are allowed per month?',
    a: 'You get 2 casual leaves per month. Sick leaves beyond 2 consecutive days require a medical certificate.',
    by: 'Meera V.',
    date: '5h ago',
  },
  {
    id: 3,
    q: 'Stipend deducted for sick leave — is this correct?',
    a: 'According to the offer letter, sick leaves beyond 2 days per quarter are deducted at the daily rate.',
    by: 'Arjun S.',
    date: '1d ago',
  },
];

const FLAGGED = [
  {
    id: 1,
    title: 'Certificate of completion — when is it issued?',
    reason: 'Outdated',
    flags: 8,
    note: 'Process changed — now takes 10 business days',
    date: '1d ago',
  },
  {
    id: 2,
    title: 'How to submit the final project report?',
    reason: 'Incorrect',
    flags: 5,
    note: 'Submission link in portal has changed',
    date: '3d ago',
  },
  {
    id: 3,
    title: 'Office timing for summer cohort',
    reason: 'Outdated',
    flags: 12,
    note: 'New timings: 9:30 AM – 6:30 PM',
    date: '2d ago',
  },
];

const DUPES = [
  {
    id: 1,
    n: 'How to get internship completion document?',
    e: 'Certificate of completion — when is it issued?',
    sim: 87,
  },
  {
    id: 2,
    n: 'NOC download — where to find it?',
    e: 'How do I download my NOC certificate?',
    sim: 92,
  },
  {
    id: 3,
    n: 'Mark WFH attendance — process?',
    e: 'How to mark attendance for remote days?',
    sim: 78,
  },
];

const ALL_USERS = [
  { id: 1, name: 'Priya Sharma', email: 'priya.s@samagama.in', role: 'Student', status: 'Active' },
  { id: 2, name: 'Rahul Menon', email: 'rahul.m@samagama.in', role: 'Student', status: 'Active' },
  {
    id: 3,
    name: 'Dr. Asha Kumar',
    email: 'asha.k@samagama.in',
    role: 'Moderator',
    status: 'Active',
  },
  {
    id: 4,
    name: 'Vikram Tiwari',
    email: 'vikram.t@samagama.in',
    role: 'Student',
    status: 'Inactive',
  },
  { id: 5, name: 'Admin User', email: 'admin@samagama.in', role: 'Admin', status: 'Active' },
];

const NAV = {
  student: [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'faqs', label: 'Browse FAQs', icon: BookOpen },
    { id: 'ask', label: 'Ask a Question', icon: HelpCircle },
    { id: 'community', label: 'Community Q&A', icon: MessageCircle },
    { id: 'my-q', label: 'My Questions', icon: Bookmark },
    { id: 'chatbot', label: 'Yaksha Chatbot', icon: Bot },
    { id: 'recent', label: 'Recently Viewed', icon: Clock },
  ],
  moderator: [
    { id: 'mod-home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'pending', label: 'Pending Answers', icon: MessageSquare, badge: 3 },
    { id: 'flagged', label: 'Flagged FAQs', icon: Flag, badge: 3 },
    { id: 'unresolved', label: 'Unresolved Questions', icon: HelpCircle, badge: 5 },
    { id: 'dupes', label: 'Duplicate Candidates', icon: GitMerge, badge: 3 },
    { id: 'faqs', label: 'Browse FAQs', icon: BookOpen },
  ],
  admin: [
    { id: 'admin-home', label: 'Overview', icon: LayoutDashboard },
    { id: 'faq-mgmt', label: 'FAQ Management', icon: BookOpen },
    { id: 'categories', label: 'Categories', icon: Layers },
    { id: 'tags', label: 'Tags', icon: Hash },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'mod-q', label: 'Moderation Queue', icon: Shield, badge: 7 },
    { id: 'bot-feedback', label: 'Chatbot Feedback', icon: Bot },
    { id: 'settings', label: 'Settings', icon: Settings },
  ],
};

const DEFAULT_SCREEN = { student: 'home', moderator: 'mod-home', admin: 'admin-home' };
const USER_NAME = { student: 'Priya Sharma', moderator: 'Dr. Asha Kumar', admin: 'Admin User' };
const USER_INITIAL = { student: 'P', moderator: 'A', admin: 'A' };

// --- Reusable UI ---
function Badge({ label, color = 'default', t }) {
  const colors = {
    default: { bg: t.pill, text: t.pillText },
    accent: { bg: t.accentBg, text: t.accentText },
    success: { bg: t.successBg, text: t.success },
    warning: { bg: t.warningBg, text: t.warning },
    danger: { bg: t.dangerBg, text: t.danger },
  };
  const c = colors[color] || colors.default;
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 20,
        background: c.bg,
        color: c.text,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function Btn({ children, variant = 'primary', size = 'md', onClick, disabled, style: s = {} }) {
  const base = {
    fontFamily: 'inherit',
    cursor: disabled ? 'not-allowed' : 'pointer',
    borderRadius: 8,
    fontWeight: 500,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    border: 'none',
    transition: 'opacity 0.15s',
    opacity: disabled ? 0.5 : 1,
    ...s,
  };
  const sizes = {
    sm: { fontSize: 12, padding: '5px 12px' },
    md: { fontSize: 13, padding: '8px 16px' },
    lg: { fontSize: 14, padding: '10px 20px' },
  };
  const variants = {
    primary: { background: '#0891b2', color: 'white' },
    ghost: {
      background: 'transparent',
      color: 'inherit',
      border: '1px solid currentColor',
      opacity: 0.6,
    },
    danger: { background: '#fee2e2', color: '#dc2626' },
    success: { background: '#d1fae5', color: '#059669' },
    warning: { background: '#fef3c7', color: '#d97706' },
  };
  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{ ...base, ...sizes[size], ...variants[variant] }}
    >
      {children}
    </button>
  );
}

function Card({ children, t, style: s = {} }) {
  return (
    <div
      style={{
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: '18px 20px',
        boxShadow: t.shadow,
        ...s,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, sub, action, t }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 16,
      }}
    >
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, color: t.text }}>{title}</div>
        {sub && <div style={{ fontSize: 13, color: t.textMuted, marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function FAQCard({ faq, t }) {
  const statusColor = {
    Published: 'success',
    Outdated: 'warning',
    Archived: 'default',
    Draft: 'danger',
  };
  return (
    <Card t={t} style={{ cursor: 'pointer', padding: '14px 18px' }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>
            {faq.title}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Badge label={faq.cat} color="accent" t={t} />
            {faq.tags.map((tag) => (
              <Badge key={tag} label={`#${tag}`} t={t} />
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <Badge label={faq.status} color={statusColor[faq.status]} t={t} />
          <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <Eye size={11} />
              {faq.views}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <ThumbsUp size={11} />
              {faq.helpful}%
            </span>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted }}>{faq.updated}</div>
        </div>
      </div>
    </Card>
  );
}

function QuestionCard({ q, t }) {
  const statusColor = {
    Open: 'accent',
    Resolved: 'success',
    Answered: 'warning',
    Duplicate: 'default',
  };
  return (
    <Card t={t} style={{ cursor: 'pointer', padding: '14px 18px' }}>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6 }}>
            {q.title}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Badge label={q.cat} color="accent" t={t} />
            {q.tags.map((tag) => (
              <Badge key={tag} label={`#${tag}`} t={t} />
            ))}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <Badge label={q.status} color={statusColor[q.status]} t={t} />
          <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <MessageSquare size={11} />
              {q.answers}
            </span>
            <span>{q.date}</span>
          </div>
          <div style={{ fontSize: 11, color: t.textMuted }}>by {q.author}</div>
        </div>
      </div>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, color, sub, t }) {
  return (
    <Card t={t} style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: color + '22',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={20} color={color} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: t.text }}>{value}</div>
          <div style={{ fontSize: 12, color: t.textMuted }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color, marginTop: 1 }}>{sub}</div>}
        </div>
      </div>
    </Card>
  );
}

function AnswerReviewCard({ item, t }) {
  return (
    <Card t={t} style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4 }}>Answer on:</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 10 }}>{item.q}</div>
      <div
        style={{
          background: t.input,
          border: `1px solid ${t.border}`,
          borderLeft: `3px solid ${t.accent}`,
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          fontSize: 13,
          color: t.text,
          lineHeight: 1.6,
        }}
      >
        {item.a}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: t.textMuted }}>
          by {item.by} · {item.date}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Btn variant="success" size="sm" onClick={() => {}}>
            <CheckCircle size={13} />
            Approve
          </Btn>
          <Btn variant="danger" size="sm" onClick={() => {}}>
            <XCircle size={13} />
            Reject
          </Btn>
          <Btn variant="ghost" size="sm" onClick={() => {}}>
            Request Changes
          </Btn>
        </div>
      </div>
    </Card>
  );
}

// --- Screens ---

function StudentHome({ t, setScreen }) {
  return (
    <div>
      <div
        style={{
          background: `linear-gradient(135deg, #0891b2, #0f2744)`,
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 24,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -40,
            width: 200,
            height: 200,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -20,
            right: 60,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.07)',
          }}
        />
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 3 }}>Welcome back,</div>
        <div style={{ fontSize: 26, fontWeight: 700, marginBottom: 6 }}>Priya Sharma 👋</div>
        <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 20 }}>
          Samagama Internship Portal · Spring 2025 Cohort
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            ['Browse FAQs', 'faqs'],
            ['Ask a Question', 'ask'],
            ['Chat with Yaksha', 'chatbot'],
          ].map(([l, s]) => (
            <button
              key={s}
              onClick={() => setScreen(s)}
              style={{
                background: s === 'ask' ? 'white' : 'rgba(255,255,255,0.18)',
                border: s === 'ask' ? 'none' : '1px solid rgba(255,255,255,0.3)',
                color: s === 'ask' ? '#0891b2' : 'white',
                borderRadius: 8,
                padding: '7px 16px',
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: s === 'ask' ? 600 : 500,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}
      >
        <StatCard
          label="FAQs Available"
          value="162"
          icon={BookOpen}
          color="#0891b2"
          sub="+4 this week"
          t={t}
        />
        <StatCard
          label="Open Questions"
          value="28"
          icon={MessageCircle}
          color="#d97706"
          sub="3 need answers"
          t={t}
        />
        <StatCard
          label="My Questions"
          value="3"
          icon={Bookmark}
          color="#059669"
          sub="1 resolved"
          t={t}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <SectionHeader
          title="Recently Updated FAQs"
          t={t}
          action={
            <button
              onClick={() => setScreen('faqs')}
              style={{
                fontSize: 13,
                color: t.accent,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'inherit',
              }}
            >
              View all <ChevronRight size={14} />
            </button>
          }
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.slice(0, 3).map((f) => (
            <FAQCard key={f.id} faq={f} t={t} />
          ))}
        </div>
      </div>

      <div>
        <SectionHeader
          title="Recent Community Questions"
          t={t}
          action={
            <button
              onClick={() => setScreen('community')}
              style={{
                fontSize: 13,
                color: t.accent,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: 'inherit',
              }}
            >
              View all <ChevronRight size={14} />
            </button>
          }
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {QUESTIONS.slice(0, 3).map((q) => (
            <QuestionCard key={q.id} q={q} t={t} />
          ))}
        </div>
      </div>
    </div>
  );
}

function FAQsScreen({ t }) {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('All');
  const [status, setStatus] = useState('All');
  const filtered = FAQS.filter(
    (f) =>
      (cat === 'All' || f.cat === cat) &&
      (status === 'All' || f.status === status) &&
      (!search || f.title.toLowerCase().includes(search.toLowerCase())),
  );
  return (
    <div>
      <SectionHeader title="Browse FAQs" sub={`${FAQS.length} knowledge articles`} t={t} />
      <Card t={t} style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: t.input,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: '8px 12px',
            }}
          >
            <Search size={15} color={t.textMuted} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search FAQs by title or keyword..."
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                color: t.text,
                fontSize: 14,
                flex: 1,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            style={{
              background: t.input,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: '8px 12px',
              color: t.text,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              outline: 'none',
            }}
          >
            {['All', 'Published', 'Outdated', 'Archived'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {['All', ...CATS.slice(0, 7)].map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              style={{
                fontSize: 12,
                padding: '5px 13px',
                borderRadius: 20,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 500,
                background: cat === c ? t.accent : t.pill,
                color: cat === c ? 'white' : t.pillText,
                transition: 'all 0.15s',
              }}
            >
              {c}
            </button>
          ))}
          <button
            style={{
              fontSize: 12,
              padding: '5px 13px',
              borderRadius: 20,
              border: `1px dashed ${t.border}`,
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: t.textMuted,
              background: 'none',
            }}
          >
            +3 more
          </button>
        </div>
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {filtered.length === 0 ? (
          <Card t={t} style={{ textAlign: 'center', padding: 40 }}>
            <BookOpen size={36} color={t.border} style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 4 }}>
              No FAQs found
            </div>
            <div style={{ fontSize: 13, color: t.textMuted }}>
              Try a different search term or ask a new question
            </div>
          </Card>
        ) : (
          filtered.map((f) => <FAQCard key={f.id} faq={f} t={t} />)
        )}
      </div>
    </div>
  );
}

function AskScreen({ t }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');

  return (
    <div>
      <SectionHeader
        title="Ask a Question"
        sub="We'll check existing answers before posting"
        t={t}
      />
      <div
        style={{
          display: 'flex',
          gap: 0,
          marginBottom: 20,
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {['1. Write', '2. Check Existing', '3. Submit'].map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              padding: '10px 8px',
              textAlign: 'center',
              fontSize: 13,
              fontWeight: step === i + 1 ? 600 : 400,
              background: step === i + 1 ? t.accent : step > i + 1 ? t.accentBg : 'transparent',
              color: step === i + 1 ? 'white' : step > i + 1 ? t.accentText : t.textMuted,
              borderRight: i < 2 ? `1px solid ${t.border}` : 'none',
              cursor: step > i + 1 ? 'pointer' : 'default',
              transition: 'all 0.2s',
            }}
            onClick={() => step > i + 1 && setStep(i + 1)}
          >
            {s}
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card t={t}>
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: t.text,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Question Title *
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. How do I mark attendance for work from home?"
              style={{
                width: '100%',
                background: t.input,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: '10px 12px',
                color: t.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: t.text,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Description
            </label>
            <textarea
              rows={4}
              placeholder="Describe your issue in detail..."
              style={{
                width: '100%',
                background: t.input,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: '10px 12px',
                color: t.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: t.text,
                display: 'block',
                marginBottom: 6,
              }}
            >
              Category
            </label>
            <select
              style={{
                width: '100%',
                background: t.input,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: '10px 12px',
                color: t.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <Btn onClick={() => setStep(2)} disabled={title.length < 5}>
            Check Existing Answers →
          </Btn>
        </Card>
      )}

      {step === 2 && (
        <div>
          <div
            style={{
              background: t.warningBg,
              border: `1px solid ${t.warning}40`,
              borderRadius: 10,
              padding: 14,
              marginBottom: 16,
              display: 'flex',
              gap: 10,
            }}
          >
            <AlertTriangle size={18} color={t.warning} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.warning, marginBottom: 2 }}>
                Possibly related answers found
              </div>
              <div style={{ fontSize: 13, color: t.textMuted }}>
                Check if any of these solves your issue before submitting.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {FAQS.slice(0, 2).map((f) => (
              <FAQCard key={f.id} faq={f} t={t} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Btn variant="ghost" onClick={() => setStep(1)}>
              ← Edit Question
            </Btn>
            <Btn onClick={() => setStep(3)}>None solved my issue — Submit →</Btn>
          </div>
        </div>
      )}

      {step === 3 && (
        <Card t={t} style={{ textAlign: 'center', padding: 48 }}>
          <div
            style={{
              width: 64,
              height: 64,
              background: t.successBg,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <CheckCircle size={28} color={t.success} />
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 8 }}>
            Question Submitted!
          </div>
          <div style={{ fontSize: 14, color: t.textMuted, marginBottom: 24 }}>
            Your question is live in the community feed. Peers and moderators will respond soon.
          </div>
          <Btn onClick={() => setStep(1)}>Ask Another Question</Btn>
        </Card>
      )}
    </div>
  );
}

function CommunityScreen({ t }) {
  const [filter, setFilter] = useState('All');
  const list = filter === 'All' ? QUESTIONS : QUESTIONS.filter((q) => q.status === filter);
  return (
    <div>
      <SectionHeader
        title="Community Q&A"
        sub="Student questions · Peer answers · Moderator approved"
        t={t}
      />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['All', 'Open', 'Answered', 'Resolved'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              fontSize: 13,
              padding: '6px 14px',
              borderRadius: 8,
              border: `1px solid ${filter === f ? t.accent : t.border}`,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
              background: filter === f ? t.accent : t.card,
              color: filter === f ? 'white' : t.textMuted,
            }}
          >
            {f}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((q) => (
          <QuestionCard key={q.id} q={q} t={t} />
        ))}
      </div>
    </div>
  );
}

function MyQsScreen({ t }) {
  return (
    <div>
      <SectionHeader title="My Questions" sub="Questions you've submitted" t={t} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {QUESTIONS.slice(0, 3).map((q) => (
          <QuestionCard key={q.id} q={q} t={t} />
        ))}
      </div>
    </div>
  );
}

function ChatbotScreen({ t }) {
  const [msgs, setMsgs] = useState([
    {
      role: 'bot',
      text: "Hello! I'm Yaksha, your Samagama internship assistant. Ask me anything about attendance, NOC, certificates, stipend, or internship guidelines.",
      src: [],
    },
    { role: 'user', text: 'When will I get my NOC?', src: [] },
    {
      role: 'bot',
      text: "Your NOC can be downloaded directly from the portal once your internship ends. Go to Documents → NOC Certificate. If you see 'Pending' status after completion, flag the FAQ or contact your coordinator.",
      src: ['FAQ: How do I download my NOC certificate?'],
    },
  ]);
  const [input, setInput] = useState('');

  const send = () => {
    if (!input.trim()) return;
    const q = input;
    setInput('');
    setMsgs((m) => [
      ...m,
      { role: 'user', text: q, src: [] },
      { role: 'bot', text: 'Searching the approved FAQ knowledge base for your query...', src: [] },
    ]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: t.text, marginBottom: 2 }}>
          Yaksha Chatbot
        </div>
        <div
          style={{
            fontSize: 13,
            color: t.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981' }} />{' '}
          RAG-powered · Answers grounded in approved FAQs
        </div>
      </div>
      <div
        style={{
          flex: 1,
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 16,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          marginBottom: 12,
        }}
      >
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 8,
            }}
          >
            {m.role === 'bot' && (
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: t.accent,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Bot size={15} color="white" />
              </div>
            )}
            <div style={{ maxWidth: '70%' }}>
              <div
                style={{
                  background: m.role === 'user' ? t.accent : t.input,
                  color: m.role === 'user' ? 'white' : t.text,
                  borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '4px 12px 12px 12px',
                  padding: '10px 14px',
                  fontSize: 14,
                  lineHeight: 1.55,
                }}
              >
                {m.text}
              </div>
              {m.src && m.src.length > 0 && (
                <div style={{ marginTop: 5, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {m.src.map((s, j) => (
                    <div
                      key={j}
                      style={{
                        fontSize: 11,
                        color: t.accent,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        cursor: 'pointer',
                      }}
                    >
                      <BookOpen size={11} />
                      {s}
                    </div>
                  ))}
                </div>
              )}
              {m.role === 'bot' && (
                <div style={{ marginTop: 5, display: 'flex', gap: 10 }}>
                  <button
                    style={{
                      fontSize: 11,
                      color: t.success,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontFamily: 'inherit',
                    }}
                  >
                    <ThumbsUp size={11} />
                    Helpful
                  </button>
                  <button
                    style={{
                      fontSize: 11,
                      color: t.danger,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      fontFamily: 'inherit',
                    }}
                  >
                    <ThumbsDown size={11} />
                    Not helpful
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          background: t.card,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: '10px 12px',
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask Yaksha about your internship..."
          style={{
            flex: 1,
            background: 'none',
            border: 'none',
            outline: 'none',
            color: t.text,
            fontSize: 14,
            fontFamily: 'inherit',
          }}
        />
        <Btn size="sm" onClick={send}>
          <Send size={13} />
          Send
        </Btn>
      </div>
    </div>
  );
}

function RecentScreen({ t }) {
  return (
    <div>
      <SectionHeader title="Recently Viewed" sub="Your browsing history" t={t} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {FAQS.map((f) => (
          <FAQCard key={f.id} faq={f} t={t} />
        ))}
      </div>
    </div>
  );
}

function ModHomeScreen({ t, setScreen }) {
  const items = [
    {
      label: 'Pending Answers',
      value: 3,
      icon: MessageSquare,
      color: '#d97706',
      screen: 'pending',
    },
    { label: 'Flagged FAQs', value: 3, icon: Flag, color: '#dc2626', screen: 'flagged' },
    {
      label: 'Unresolved Questions',
      value: 5,
      icon: HelpCircle,
      color: '#7c3aed',
      screen: 'unresolved',
    },
    { label: 'Duplicate Candidates', value: 3, icon: GitMerge, color: '#0891b2', screen: 'dupes' },
  ];
  return (
    <div>
      <SectionHeader title="Moderation Dashboard" sub="Items requiring your attention" t={t} />
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14, marginBottom: 28 }}
      >
        {items.map((s) => (
          <Card
            t={t}
            key={s.label}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}
            onClick={() => setScreen(s.screen)}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: s.color + '22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <s.icon size={22} color={s.color} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: t.textMuted }}>{s.label}</div>
            </div>
            <ChevronRight size={16} color={t.textMuted} />
          </Card>
        ))}
      </div>
      <SectionHeader title="Latest Pending Answers" t={t} />
      {PENDING.map((a) => (
        <AnswerReviewCard key={a.id} item={a} t={t} />
      ))}
    </div>
  );
}

function PendingScreen({ t }) {
  return (
    <div>
      <SectionHeader title="Pending Answers" sub="Review community answers before approval" t={t} />
      {PENDING.map((a) => (
        <AnswerReviewCard key={a.id} item={a} t={t} />
      ))}
    </div>
  );
}

function FlaggedScreen({ t }) {
  return (
    <div>
      <SectionHeader title="Flagged FAQs" sub={`${FLAGGED.length} items need review`} t={t} />
      {FLAGGED.map((f) => (
        <Card t={t} key={f.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 5 }}>
                {f.title}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Badge
                  label={f.reason}
                  color={f.reason === 'Outdated' ? 'warning' : 'danger'}
                  t={t}
                />
                <span style={{ fontSize: 11, color: t.textMuted }}>{f.flags} flags</span>
              </div>
            </div>
            <span style={{ fontSize: 11, color: t.textMuted }}>{f.date}</span>
          </div>
          <div
            style={{
              fontSize: 13,
              color: t.textMuted,
              background: t.input,
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
              lineHeight: 1.5,
            }}
          >
            <span style={{ fontWeight: 600, color: t.text }}>User note: </span>
            {f.note}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn variant="success" size="sm">
              Mark Resolved
            </Btn>
            <Btn size="sm">Suggest Edit</Btn>
            <Btn variant="ghost" size="sm">
              Dismiss
            </Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

function UnresolvedScreen({ t }) {
  const open = QUESTIONS.filter((q) => q.status === 'Open');
  return (
    <div>
      <SectionHeader
        title="Unresolved Questions"
        sub={`${open.length} questions need attention`}
        t={t}
      />
      {open.map((q) => (
        <Card t={t} key={q.id} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 5 }}>
                {q.title}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {q.tags.map((tag) => (
                  <Badge key={tag} label={`#${tag}`} t={t} />
                ))}
              </div>
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, textAlign: 'right' }}>
              <div>{q.date}</div>
              <div>by {q.author}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm">Add Answer</Btn>
            <Btn variant="success" size="sm">
              Mark Resolved
            </Btn>
            <Btn variant="ghost" size="sm">
              Mark Duplicate
            </Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

function DupesScreen({ t }) {
  return (
    <div>
      <SectionHeader
        title="Duplicate Candidates"
        sub="High-similarity FAQ pairs flagged by semantic search"
        t={t}
      />
      {DUPES.map((d) => (
        <Card t={t} key={d.id} style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'stretch' }}>
            <div
              style={{
                flex: 1,
                background: t.input,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: t.textMuted,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '.5px',
                }}
              >
                New Submission
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{d.n}</div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                flexDirection: 'column',
                justifyContent: 'center',
                gap: 4,
                padding: '0 8px',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  background: d.sim >= 80 ? t.dangerBg : t.warningBg,
                  color: d.sim >= 80 ? t.danger : t.warning,
                  borderRadius: 8,
                  padding: '6px 12px',
                }}
              >
                {d.sim}%
              </div>
              <div style={{ fontSize: 10, color: t.textMuted }}>similar</div>
            </div>
            <div
              style={{
                flex: 1,
                background: t.input,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: 12,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: t.textMuted,
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '.5px',
                }}
              >
                Existing FAQ
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{d.e}</div>
            </div>
          </div>
          {d.sim >= 80 && (
            <div
              style={{
                fontSize: 12,
                color: t.danger,
                background: t.dangerBg,
                borderRadius: 6,
                padding: '6px 10px',
                marginBottom: 10,
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              <AlertTriangle size={12} /> Strong duplicate — merge strongly recommended
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn size="sm">
              <GitMerge size={13} />
              Merge into Existing
            </Btn>
            <Btn variant="ghost" size="sm">
              Allow with Justification
            </Btn>
          </div>
        </Card>
      ))}
    </div>
  );
}

function AdminHomeScreen({ t }) {
  const metrics = [
    { label: 'Total FAQs', value: 162, icon: BookOpen, color: '#0891b2', sub: '+4 this week' },
    { label: 'Open Questions', value: 28, icon: HelpCircle, color: '#7c3aed', sub: '+3 today' },
    { label: 'Pending Moderation', value: 7, icon: Shield, color: '#d97706', sub: 'Action needed' },
    { label: 'Flagged Items', value: 15, icon: Flag, color: '#dc2626', sub: '3 high priority' },
    {
      label: 'Chatbot Helpful',
      value: '78%',
      icon: Bot,
      color: '#059669',
      sub: '+2% vs last week',
    },
    {
      label: 'Duplicate Candidates',
      value: 6,
      icon: GitMerge,
      color: '#ea580c',
      sub: '2 critical',
    },
  ];
  const cats = [
    { c: 'NOC', n: 28 },
    { c: 'Technical', n: 24 },
    { c: 'Attendance', n: 22 },
    { c: 'Certificates', n: 19 },
    { c: 'Login', n: 16 },
    { c: 'Stipend', n: 15 },
  ];
  const max = Math.max(...cats.map((c) => c.n));

  return (
    <div>
      <SectionHeader title="Admin Overview" sub="Portal health at a glance" t={t} />
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 24 }}
      >
        {metrics.map((m) => (
          <StatCard key={m.label} {...m} t={t} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14 }}>
        <Card t={t}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 16 }}>
            FAQs by Category
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cats.map((c) => (
              <div key={c.c} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 12, color: t.textMuted, width: 80, flexShrink: 0 }}>
                  {c.c}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    background: t.input,
                    borderRadius: 4,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${(c.n / max) * 100}%`,
                      background: t.accent,
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: t.text,
                    width: 28,
                    textAlign: 'right',
                  }}
                >
                  {c.n}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card t={t}>
          <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14 }}>
            Top Flagged FAQs
          </div>
          {FLAGGED.map((f, i) => (
            <div
              key={f.id}
              style={{
                padding: '10px 0',
                borderBottom: i < FLAGGED.length - 1 ? `1px solid ${t.border}` : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontSize: 13, color: t.text, fontWeight: 500 }}>
                  {f.title.substring(0, 38)}…
                </div>
                <div style={{ fontSize: 11, color: t.textMuted }}>{f.reason}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: t.danger }}>{f.flags}</span>
                <Btn size="sm">Review</Btn>
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function FAQMgmtScreen({ t }) {
  return (
    <div>
      <SectionHeader
        title="FAQ Management"
        sub="Create, edit, and manage all knowledge articles"
        t={t}
        action={
          <Btn>
            <Plus size={14} />
            New FAQ
          </Btn>
        }
      />
      <div
        style={{
          background: t.warningBg,
          border: `1px solid ${t.warning}40`,
          borderRadius: 10,
          padding: 12,
          marginBottom: 16,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
        }}
      >
        <AlertTriangle size={16} color={t.warning} />
        <div style={{ fontSize: 13, color: t.warning, flex: 1 }}>
          6 duplicate candidates detected. Review before adding new FAQs.
        </div>
        <Btn variant="warning" size="sm">
          Review Now
        </Btn>
      </div>
      <Card t={t} style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 0.9fr 0.5fr',
            padding: '10px 18px',
            background: t.input,
            borderBottom: `1px solid ${t.border}`,
            fontSize: 11,
            fontWeight: 700,
            color: t.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '.5px',
            gap: 12,
          }}
        >
          {['Title', 'Category', 'Status', 'Updated', 'Actions'].map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
        {FAQS.map((f, i) => (
          <div
            key={f.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 0.9fr 0.5fr',
              padding: '13px 18px',
              borderBottom: i < FAQS.length - 1 ? `1px solid ${t.border}` : 'none',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, color: t.text }}>{f.title}</div>
            <div style={{ fontSize: 12, color: t.accentText }}>{f.cat}</div>
            <div>
              <Badge
                label={f.status}
                color={
                  f.status === 'Published'
                    ? 'success'
                    : f.status === 'Outdated'
                      ? 'warning'
                      : 'default'
                }
                t={t}
              />
            </div>
            <div style={{ fontSize: 11, color: t.textMuted }}>{f.updated}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={{
                  background: t.pill,
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  color: t.text,
                }}
              >
                <Edit size={12} />
              </button>
              <button
                style={{
                  background: t.dangerBg,
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 8px',
                  cursor: 'pointer',
                  color: t.danger,
                }}
              >
                <Archive size={12} />
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function CategoriesScreen({ t }) {
  const counts = [28, 24, 22, 19, 16, 15, 13, 12, 10, 8];
  return (
    <div>
      <SectionHeader
        title="Category Management"
        sub="Manage FAQ categories"
        t={t}
        action={
          <Btn>
            <Plus size={14} />
            Add Category
          </Btn>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
        {CATS.map((c, i) => (
          <Card
            t={t}
            key={c}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{c}</div>
              <div style={{ fontSize: 12, color: t.textMuted }}>{counts[i]} FAQs</div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                style={{
                  background: t.pill,
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 8px',
                  cursor: 'pointer',
                  color: t.text,
                }}
              >
                <Edit size={12} />
              </button>
              <button
                style={{
                  background: t.dangerBg,
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 8px',
                  cursor: 'pointer',
                  color: t.danger,
                }}
              >
                <Archive size={12} />
              </button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function TagsScreen({ t }) {
  const tags = [
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
    'technical',
    'bug',
    'policy',
    'deduction',
    'equipment',
    'guidelines',
    'completion',
    'cohort',
  ];
  return (
    <div>
      <SectionHeader
        title="Tag Management"
        sub="Manage FAQ keywords and tags"
        t={t}
        action={
          <Btn>
            <Plus size={14} />
            New Tag
          </Btn>
        }
      />
      <Card t={t}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: t.input,
                border: `1px solid ${t.border}`,
                borderRadius: 8,
                padding: '6px 10px',
              }}
            >
              <span style={{ fontSize: 13, color: t.accentText, fontWeight: 500 }}>#{tag}</span>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: t.textMuted,
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function UsersScreen({ t }) {
  const roleColor = { Student: 'accent', Moderator: 'warning', Admin: 'danger' };
  return (
    <div>
      <SectionHeader
        title="User Management"
        sub="Manage roles and access"
        t={t}
        action={
          <Btn>
            <Plus size={14} />
            Add User
          </Btn>
        }
      />
      <Card t={t} style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1.8fr 0.8fr 0.8fr 0.4fr',
            padding: '10px 18px',
            background: t.input,
            borderBottom: `1px solid ${t.border}`,
            fontSize: 11,
            fontWeight: 700,
            color: t.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '.5px',
            gap: 12,
          }}
        >
          {['Name', 'Email', 'Role', 'Status', ''].map((h, i) => (
            <div key={i}>{h}</div>
          ))}
        </div>
        {ALL_USERS.map((u, i) => (
          <div
            key={u.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1.8fr 0.8fr 0.8fr 0.4fr',
              padding: '13px 18px',
              borderBottom: i < ALL_USERS.length - 1 ? `1px solid ${t.border}` : 'none',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{u.name}</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>{u.email}</div>
            <div>
              <Badge label={u.role} color={roleColor[u.role]} t={t} />
            </div>
            <div>
              <Badge label={u.status} color={u.status === 'Active' ? 'success' : 'default'} t={t} />
            </div>
            <button
              style={{
                background: t.pill,
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                cursor: 'pointer',
                color: t.text,
              }}
            >
              <Edit size={12} />
            </button>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ModQScreen({ t }) {
  return (
    <div>
      <SectionHeader title="Moderation Queue" sub="All pending items across the platform" t={t} />
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12, marginBottom: 24 }}
      >
        {[
          { l: 'Pending Answers', v: 3, c: t.warning },
          { l: 'Flagged FAQs', v: 3, c: t.danger },
          { l: 'FAQ Conversion Candidates', v: 2, c: t.accent },
          { l: 'Awaiting Admin Publish', v: 4, c: '#7c3aed' },
        ].map((s) => (
          <Card
            t={t}
            key={s.l}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{s.l}</div>
            <span style={{ fontSize: 22, fontWeight: 700, color: s.c }}>{s.v}</span>
          </Card>
        ))}
      </div>
      <SectionHeader title="Pending Answers" t={t} />
      {PENDING.map((a) => (
        <AnswerReviewCard key={a.id} item={a} t={t} />
      ))}
    </div>
  );
}

function BotFeedbackScreen({ t }) {
  return (
    <div>
      <SectionHeader
        title="Chatbot Feedback"
        sub="Monitor Yaksha's performance and accuracy"
        t={t}
      />
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 20 }}
      >
        {[
          { l: 'Helpful Responses', v: '78%', icon: ThumbsUp, c: t.success },
          { l: 'Unhelpful Reported', v: '22%', icon: ThumbsDown, c: t.danger },
          { l: 'Avg. Sources Cited', v: '2.4', icon: BookOpen, c: t.accent },
        ].map((s) => (
          <Card t={t} key={s.l} style={{ textAlign: 'center', padding: '20px 16px' }}>
            <s.icon size={22} color={s.c} style={{ margin: '0 auto 8px' }} />
            <div style={{ fontSize: 24, fontWeight: 700, color: t.text }}>{s.v}</div>
            <div style={{ fontSize: 12, color: t.textMuted }}>{s.l}</div>
          </Card>
        ))}
      </div>
      <Card t={t}>
        <div style={{ fontSize: 15, fontWeight: 600, color: t.text, marginBottom: 14 }}>
          Queries with No Source Found
        </div>
        {[
          'How to appeal NOC rejection?',
          'Leave policy for national holidays?',
          'Can internship be extended?',
        ].map((q, i, arr) => (
          <div
            key={q}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : 'none',
            }}
          >
            <div style={{ fontSize: 13, color: t.text }}>{q}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Badge label="No Source" color="danger" t={t} />
              <Btn size="sm">
                <Plus size={12} />
                Create FAQ
              </Btn>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function SettingsScreen({ t }) {
  const [threshold, setThreshold] = useState(80);
  const [provider, setProvider] = useState('gemini');
  return (
    <div>
      <SectionHeader title="Settings" sub="Configure system behavior" t={t} />
      {[
        {
          title: 'Duplicate Detection',
          icon: GitMerge,
          content: (
            <div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 14 }}>
                Configure the similarity threshold for warnings. Higher = stricter duplicate
                detection.
              </div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 8 }}>
                  Similarity Threshold: <span style={{ color: t.accent }}>{threshold}%</span>
                </div>
                <input
                  type="range"
                  min={50}
                  max={100}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  style={{ width: '100%', accentColor: t.accent }}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 11,
                    color: t.textMuted,
                    marginTop: 4,
                  }}
                >
                  <span>50% — lenient</span>
                  <span>100% — strict</span>
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: t.textMuted,
                  background: t.input,
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                Warn at ≥{threshold - 20}% · Require justification at ≥{threshold}%
              </div>
            </div>
          ),
        },
        {
          title: 'LLM Provider',
          icon: Bot,
          content: (
            <div>
              <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 12 }}>
                Select the model provider for chatbot answer generation.
              </div>
              {[
                ['gemini', 'Gemini API (Free Tier)', 'Production-ready · requires API key', ''],
                [
                  'mock',
                  'Mock Provider (Development)',
                  'Returns dummy answers for local testing',
                  '',
                ],
                [
                  'local-llama',
                  'Local Llama (Phase 2)',
                  'Requires institution-hosted model server',
                  'Phase 2',
                ],
              ].map(([val, label, desc, badge]) => (
                <label
                  key={val}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    background: provider === val ? t.accentBg : t.input,
                    border: `1px solid ${provider === val ? t.accent : t.border}`,
                    borderRadius: 8,
                    marginBottom: 8,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    checked={provider === val}
                    onChange={() => setProvider(val)}
                    style={{ accentColor: t.accent }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text }}>{label}</div>
                    <div style={{ fontSize: 11, color: t.textMuted }}>{desc}</div>
                  </div>
                  {badge && <Badge label={badge} t={t} />}
                </label>
              ))}
            </div>
          ),
        },
      ].map((s) => (
        <Card t={t} key={s.title} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <s.icon size={18} color={t.accent} />
            <div style={{ fontSize: 15, fontWeight: 600, color: t.text }}>{s.title}</div>
          </div>
          {s.content}
        </Card>
      ))}
    </div>
  );
}

// --- Screen Router ---
function Screen({ id, t, setScreen }) {
  const map = {
    home: <StudentHome t={t} setScreen={setScreen} />,
    faqs: <FAQsScreen t={t} />,
    ask: <AskScreen t={t} />,
    community: <CommunityScreen t={t} />,
    'my-q': <MyQsScreen t={t} />,
    chatbot: <ChatbotScreen t={t} />,
    recent: <RecentScreen t={t} />,
    'mod-home': <ModHomeScreen t={t} setScreen={setScreen} />,
    pending: <PendingScreen t={t} />,
    flagged: <FlaggedScreen t={t} />,
    unresolved: <UnresolvedScreen t={t} />,
    dupes: <DupesScreen t={t} />,
    'admin-home': <AdminHomeScreen t={t} />,
    'faq-mgmt': <FAQMgmtScreen t={t} />,
    categories: <CategoriesScreen t={t} />,
    tags: <TagsScreen t={t} />,
    users: <UsersScreen t={t} />,
    'mod-q': <ModQScreen t={t} />,
    'bot-feedback': <BotFeedbackScreen t={t} />,
    settings: <SettingsScreen t={t} />,
  };
  return (
    map[id] || (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          gap: 12,
        }}
      >
        <div
          style={{
            width: 60,
            height: 60,
            background: t.accentBg,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Layers size={26} color={t.accent} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: t.text }}>Coming Soon</div>
        <div style={{ fontSize: 13, color: t.textMuted }}>Part of the implementation roadmap</div>
      </div>
    )
  );
}

// --- Main App ---
export default function App() {
  const [theme, setTheme] = useState('light');
  const [role, setRole] = useState('student');
  const [screen, setScreen] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const t = T[theme];
  const nav = NAV[role];

  useEffect(() => {
    if (!document.querySelector('link[data-sp-font]')) {
      const l = document.createElement('link');
      l.href =
        'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap';
      l.rel = 'stylesheet';
      l.dataset.spFont = 'true';
      document.head.appendChild(l);
    }
  }, []);

  const handleRole = (r) => {
    setRole(r);
    setScreen(DEFAULT_SCREEN[r]);
  };

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        background: t.bg,
        overflow: 'hidden',
      }}
    >
      {/* Sidebar */}
      <div
        style={{
          width: sidebarOpen ? 236 : 60,
          background: t.sidebar,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}
      >
        {/* Branding */}
        <div
          style={{
            padding: sidebarOpen ? '18px 18px 14px' : '16px 12px',
            borderBottom: `1px solid ${t.sidebarBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarOpen ? 'space-between' : 'center',
            gap: 8,
          }}
        >
          {sidebarOpen && (
            <div>
              <div
                style={{ fontSize: 17, fontWeight: 800, color: 'white', letterSpacing: '-0.5px' }}
              >
                Samagama
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
                Internship Portal
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: 7,
              padding: 7,
              cursor: 'pointer',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Role switcher */}
        {sidebarOpen && (
          <div style={{ padding: '12px 12px 8px' }}>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.35)',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                marginBottom: 6,
                paddingLeft: 3,
              }}
            >
              Prototype · View as
            </div>
            <div
              style={{
                display: 'flex',
                background: 'rgba(0,0,0,0.25)',
                borderRadius: 8,
                padding: 3,
                gap: 2,
              }}
            >
              {[
                ['student', 'Student'],
                ['moderator', 'Mod'],
                ['admin', 'Admin'],
              ].map(([r, l]) => (
                <button
                  key={r}
                  onClick={() => handleRole(r)}
                  style={{
                    flex: 1,
                    background: role === r ? 'rgba(255,255,255,0.16)' : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    padding: '5px 3px',
                    color: role === r ? 'white' : 'rgba(255,255,255,0.45)',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: role === r ? 600 : 400,
                    transition: 'all 0.15s',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '6px 10px', overflowY: 'auto' }}>
          {nav.map((item) => {
            const active = screen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: sidebarOpen ? 10 : 0,
                  justifyContent: sidebarOpen ? 'flex-start' : 'center',
                  padding: sidebarOpen ? '9px 10px' : '9px',
                  borderRadius: 8,
                  marginBottom: 2,
                  background: active ? t.sidebarActive : t.sidebarHover,
                  border: 'none',
                  cursor: 'pointer',
                  color: active ? t.sidebarActiveText : t.sidebarText,
                  fontFamily: 'inherit',
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  transition: 'all 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = t.sidebarHover;
                }}
              >
                <item.icon size={16} style={{ flexShrink: 0 }} />
                {sidebarOpen && (
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.label}
                  </span>
                )}
                {sidebarOpen && item.badge && (
                  <span
                    style={{
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: 10,
                      padding: '1px 6px',
                      fontSize: 10,
                      fontWeight: 700,
                      minWidth: 18,
                      textAlign: 'center',
                    }}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* User */}
        {sidebarOpen && (
          <div
            style={{
              padding: '12px 14px',
              borderTop: `1px solid ${t.sidebarBorder}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: t.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 13,
                fontWeight: 700,
                color: 'white',
              }}
            >
              {USER_INITIAL[role]}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'white',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {USER_NAME[role]}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.4)',
                  textTransform: 'capitalize',
                }}
              >
                {role}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Topbar */}
        <div
          style={{
            background: t.topbar,
            borderBottom: `1px solid ${t.border}`,
            padding: '0 20px',
            height: 54,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            boxShadow: `0 1px 0 ${t.border}`,
          }}
        >
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: t.input,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: '7px 12px',
              maxWidth: 300,
            }}
          >
            <Search size={14} color={t.textMuted} />
            <input
              placeholder="Quick search..."
              style={{
                border: 'none',
                background: 'none',
                outline: 'none',
                color: t.text,
                fontSize: 13,
                flex: 1,
                fontFamily: 'inherit',
              }}
            />
          </div>
          <div style={{ flex: 1 }} />
          <button
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: t.textMuted,
              position: 'relative',
              padding: 6,
            }}
          >
            <Bell size={18} color={t.textMuted} />
            <div
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#ef4444',
              }}
            />
          </button>
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            style={{
              background: t.pill,
              border: `1px solid ${t.border}`,
              borderRadius: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              color: t.pillText,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            {theme === 'light' ? (
              <>
                <Moon size={14} />
                Dark
              </>
            ) : (
              <>
                <Sun size={14} />
                Light
              </>
            )}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          <Screen id={screen} t={t} setScreen={setScreen} />
        </div>
      </div>
    </div>
  );
}
