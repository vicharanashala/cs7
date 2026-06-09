import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUp,
  Award,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Clock,
  Flame,
  Folder,
  HelpCircle,
  MessageSquare,
  MoreHorizontal,
  Search,
  Sparkles,
  ThumbsUp,
  Trophy,
  User,
  X,
} from 'lucide-react';
import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { PublicNotification } from '@samagama/shared';
import { effectiveRole } from '@samagama/shared';
import { useAuth } from '../features/auth/AuthProvider';
import { useStudentDashboard, useLeaderboard, useLeaderboardRange } from '../features/stats/queries';
import type {
  StudentDashboardStats,
  LeaderboardRow,
  LeaderboardGap,
  LeaderboardResponse,
} from '../features/stats/api';
import { useNotifications } from '../features/notifications/queries';
import { useFaqList } from '../features/faq/queries';
import { FaqCard } from '../features/faq/FaqCard';
import { useQuestions } from '../features/qna/queries';

type ContentTab = 'recent-added-faqs' | 'recent-updated-faqs' | 'recent-questions';

export function HomePage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div>
      {/* Welcome banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 60%, #4c1d95 100%)',
          borderRadius: 20,
          padding: '28px 32px',
          marginBottom: 24,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(124,58,237,0.22)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -50,
            right: 120,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
          }}
        />
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            marginBottom: 4,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Welcome back
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>
          {user.name} 👋
        </div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Samagama Internship Portal · <strong>Signed in as {user.role}</strong>
        </div>
      </div>

      {/* Trainee roles land on the dashboard of the role they impersonate. */}
      {effectiveRole(user.role) === 'student' ? (
        <StudentHome />
      ) : effectiveRole(user.role) === 'moderator' ? (
        <Navigate to="/moderation" replace />
      ) : (
        <Navigate to="/admin" replace />
      )}
    </div>
  );
}

// ─── Student dashboard ────────────────────────────────────────────────────────

function StudentHome() {
  const { data, isLoading, isError, refetch } = useStudentDashboard();

  if (isError) {
    return (
      <DashboardError onRetry={() => void refetch()} />
    );
  }

  return (
    <>
      <StatCardRow data={data} loading={isLoading} />

      {/* Recent activity + Open community Q&A */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <RecentActivityCard />
        <CommunityInsightsCard community={data?.community} loading={isLoading} />
      </div>

      <ContributionSnapshot contribution={data?.contribution} loading={isLoading} />

      <ContentTabs />

      <LeaderboardSection />
    </>
  );
}

/** Smooth-scrolls the home page to the leaderboard section (used by the Spurti points card). */
function scrollToLeaderboard() {
  document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="mod-card mod-card-red"
      style={{
        padding: 32,
        marginBottom: 24,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <AlertTriangle size={28} color="var(--color-danger)" />
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
        Couldn't load your dashboard
      </div>
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
        Something went wrong while fetching your stats.
      </div>
      <button
        onClick={onRetry}
        style={{
          marginTop: 4,
          padding: '8px 18px',
          borderRadius: 10,
          border: 'none',
          background: 'var(--color-danger)',
          color: 'white',
          fontWeight: 700,
          fontSize: 13,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ─── Top stat cards ───────────────────────────────────────────────────────────

interface StatCardConfig {
  key: string;
  cardClass: string;
  icon: LucideIcon;
  accent: string;
  accentBg: string;
  value: number | undefined;
  label: string;
  footer: React.ReactNode;
  to: string;
}

function StatCardRow({
  data,
  loading,
}: {
  data: StudentDashboardStats | undefined;
  loading: boolean;
}) {
  const navigate = useNavigate();

  const cards: StatCardConfig[] = [
    {
      key: 'asked',
      cardClass: 'mod-card-purple',
      icon: HelpCircle,
      accent: 'var(--color-purple)',
      accentBg: 'var(--color-purple-bg)',
      value: data?.questionsAsked.total,
      label: 'Questions asked',
      footer: <Delta value={data?.questionsAsked.thisWeek} />,
      to: '/my-questions',
    },
    {
      key: 'pending',
      cardClass: 'mod-card-orange',
      icon: Clock,
      accent: 'var(--color-warning)',
      accentBg: 'var(--color-warning-bg)',
      value: data?.pending,
      label: 'Pending',
      footer: <span style={{ color: 'var(--color-warning)' }}>Awaiting response</span>,
      to: '/my-questions',
    },
    {
      key: 'answered',
      cardClass: 'mod-card-green',
      icon: CheckCircle2,
      accent: 'var(--color-success)',
      accentBg: 'var(--color-success-bg)',
      value: data?.answered.total,
      label: 'Answered',
      footer: <Delta value={data?.answered.thisWeek} />,
      to: '/my-questions',
    },
    {
      key: 'points',
      cardClass: 'mod-card-purple',
      icon: Sparkles,
      accent: 'var(--color-purple)',
      accentBg: 'var(--color-purple-bg)',
      value: data?.spurtiPoints,
      label: 'Spurti points',
      footer: (
        <span
          style={{
            color: 'var(--color-primary-text)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
          }}
        >
          View ranking <ChevronRight size={12} />
        </span>
      ),
      to: '#leaderboard',
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}
    >
      {cards.map((c) => (
        <StatCard
          key={c.key}
          config={c}
          loading={loading}
          onClick={() => (c.to === '#leaderboard' ? scrollToLeaderboard() : navigate(c.to))}
        />
      ))}
    </div>
  );
}

function StatCard({
  config,
  loading,
  onClick,
}: {
  config: StatCardConfig;
  loading: boolean;
  onClick: () => void;
}) {
  const { icon: Icon, accent, accentBg, value, label, footer } = config;
  return (
    <div
      className={`mod-card ${config.cardClass} interactive`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      style={{
        padding: '20px 20px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
        minHeight: 150,
        cursor: 'pointer',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: accentBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={22} color={accent} strokeWidth={2.4} />
        </div>
        <ChevronRight size={16} color={accent} style={{ opacity: 0.45 }} />
      </div>
      <div
        style={{
          fontSize: 38,
          fontWeight: 800,
          color: 'var(--color-text)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginTop: 4,
        }}
      >
        {loading || value === undefined ? '…' : value}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>{footer}</div>
    </div>
  );
}

function Delta({ value }: { value: number | undefined }) {
  if (value === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>;
  if (value <= 0) {
    return <span style={{ color: 'var(--color-text-muted)' }}>No change this week</span>;
  }
  return (
    <span
      style={{ color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: 2 }}
    >
      <ArrowUp size={12} strokeWidth={3} />
      {value} this week
    </span>
  );
}

// ─── Recent activity ──────────────────────────────────────────────────────────

function RecentActivityCard() {
  const navigate = useNavigate();
  const { data: notifications, isLoading, isError } = useNotifications();
  const items = (notifications ?? []).slice(0, 5);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <PanelHeader
        title="Recent activity"
        action={
          <ViewAll onClick={() => navigate('/my-questions')} label="View all" />
        }
      />
      <div style={{ padding: '4px 0' }}>
        {isLoading ? (
          <ActivitySkeleton />
        ) : isError ? (
          <PanelMessage text="Couldn't load recent activity." />
        ) : items.length === 0 ? (
          <PanelMessage text="No activity yet — ask or answer a question to get started." />
        ) : (
          items.map((n, i) => (
            <ActivityRow key={n.id} n={n} last={i === items.length - 1} navigate={navigate} />
          ))
        )}
      </div>
    </div>
  );
}

function activityVisual(type: PublicNotification['type']): { icon: LucideIcon; color: string } {
  switch (type) {
    case 'answer_approved':
    case 'question_answered':
      return { icon: CheckCircle2, color: 'var(--color-success)' };
    case 'answer_rejected':
      return { icon: AlertTriangle, color: 'var(--color-danger)' };
    case 'flag_reviewed':
      return { icon: Award, color: 'var(--color-warning)' };
    default:
      return { icon: Sparkles, color: 'var(--color-purple)' };
  }
}

function ActivityRow({
  n,
  last,
  navigate,
}: {
  n: PublicNotification;
  last: boolean;
  navigate: (to: string) => void;
}) {
  const { icon: Icon, color } = activityVisual(n.type);
  const clickable = Boolean(n.relatedId);
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? () => navigate(`/community/${n.relatedId}`) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigate(`/community/${n.relatedId}`);
              }
            }
          : undefined
      }
      style={{
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        padding: '14px 20px',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
        cursor: clickable ? 'pointer' : 'default',
        outline: 'none',
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: `color-mix(in srgb, ${color} 14%, transparent)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon size={17} color={color} strokeWidth={2.4} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: 'var(--color-text)',
            lineHeight: 1.4,
            marginBottom: 2,
          }}
        >
          {n.title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{timeAgo(n.createdAt)}</div>
      </div>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '14px 20px' }}
        >
          <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div
              className="skeleton"
              style={{ height: 12, width: '70%', borderRadius: 6, marginBottom: 8 }}
            />
            <div className="skeleton" style={{ height: 10, width: '30%', borderRadius: 6 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Open community Q&A insights ──────────────────────────────────────────────

function CommunityInsightsCard({
  community,
  loading,
}: {
  community: StudentDashboardStats['community'] | undefined;
  loading: boolean;
}) {
  const navigate = useNavigate();

  const rows = [
    {
      key: 'active',
      value: community?.activeLastHour,
      label: 'Active in last 1 hour',
      sub: 'Fresh community activity',
      subColor: 'var(--color-success)',
      icon: Flame,
      color: 'var(--color-success)',
      to: '/community?idle=last24h',
    },
    {
      key: 'idle3',
      value: community?.idleOver3Days,
      label: 'Idle > 3 days',
      sub: 'Needs attention',
      subColor: 'var(--color-warning)',
      icon: Clock,
      color: 'var(--color-warning)',
      to: '/community?idle=over3days',
    },
    {
      key: 'idle7',
      value: community?.idleOver1Week,
      label: 'Idle > 1 week',
      sub: 'Follow up required',
      subColor: 'var(--color-danger)',
      icon: AlertTriangle,
      color: 'var(--color-danger)',
      to: '/community?idle=over1week',
    },
  ];

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <PanelHeader
        title="Open community Q&A"
        action={
          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>
            {loading || community === undefined ? '…' : community.totalOpen}
          </span>
        }
        onClick={() => navigate('/community')}
      />
      <div>
        {rows.map((r, i) => {
          const Icon = r.icon;
          return (
            <button
              key={r.key}
              onClick={() => navigate(r.to)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: i < rows.length - 1 ? '1px solid var(--color-border)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `color-mix(in srgb, ${r.color} 14%, transparent)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon size={19} color={r.color} strokeWidth={2.4} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    lineHeight: 1,
                    marginBottom: 3,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {loading || r.value === undefined ? '…' : r.value}
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
                  {r.label}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: r.subColor }}>{r.sub}</div>
              </div>
              <ChevronRight size={18} color="var(--color-text-muted)" style={{ opacity: 0.5 }} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Contribution snapshot ────────────────────────────────────────────────────

function ContributionSnapshot({
  contribution,
  loading,
}: {
  contribution: StudentDashboardStats['contribution'] | undefined;
  loading: boolean;
}) {
  const items = [
    {
      key: 'accepted',
      value: contribution?.acceptedAnswers,
      label: 'Accepted answers',
      sub: 'On your questions',
      icon: CheckCircle2,
      color: 'var(--color-success)',
    },
    {
      key: 'given',
      value: contribution?.answersGiven,
      label: 'Answers given',
      sub: 'To the community',
      icon: MessageSquare,
      color: 'var(--color-primary)',
    },
    {
      key: 'upvotes',
      value: contribution?.upvotesReceived,
      label: 'Upvotes received',
      sub: 'On your answers',
      icon: ThumbsUp,
      color: 'var(--color-purple)',
    },
    {
      key: 'rate',
      value: contribution?.responseRate,
      suffix: '%',
      label: 'Response rate',
      sub: 'Questions answered',
      icon: BarChart3,
      color: 'var(--color-warning)',
    },
  ];

  return (
    <div className="card" style={{ padding: '24px 24px 28px', marginBottom: 24 }}>
      <div
        style={{
          fontSize: 19,
          fontWeight: 800,
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
          marginBottom: 24,
        }}
      >
        Your contribution snapshot
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 20,
        }}
      >
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div
              key={it.key}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: `color-mix(in srgb, ${it.color} 14%, transparent)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 8,
                }}
              >
                <Icon size={28} color={it.color} strokeWidth={2.2} />
              </div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.03em',
                  lineHeight: 1,
                }}
              >
                {loading || it.value === undefined ? '…' : `${it.value}${it.suffix ?? ''}`}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
                {it.label}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{it.sub}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Shared panel bits ────────────────────────────────────────────────────────

function PanelHeader({
  title,
  action,
  onClick,
}: {
  title: string;
  action?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 20px',
        borderBottom: '1px solid var(--color-border)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
        }}
      >
        {title}
      </div>
      {action}
    </div>
  );
}

function PanelMessage({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '28px 20px',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--color-text-muted)',
      }}
    >
      {text}
    </div>
  );
}

// ─── Knowledge feed (unchanged) ───────────────────────────────────────────────

function ContentTabs() {
  const [tab, setTab] = useState<ContentTab>('recent-added-faqs');

  return (
    <div>
      {/* Tab header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--color-card)',
            boxShadow: '0 2px 8px rgba(59,130,246,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Knowledge Feed
        </span>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(
          [
            ['recent-added-faqs', 'Recently Added FAQs'],
            ['recent-updated-faqs', 'Recently Updated FAQs'],
            ['recent-questions', 'Recent Community Questions'],
          ] as [ContentTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: '8px 18px',
              borderRadius: 10,
              border: `1.5px solid ${tab === id ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: tab === id ? 'var(--color-primary)' : 'var(--color-card)',
              color: tab === id ? 'white' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'recent-added-faqs' && <RecentFaqsList sort="added" />}
      {tab === 'recent-updated-faqs' && <RecentFaqsList sort="recent" />}
      {tab === 'recent-questions' && <RecentQuestionsList />}
    </div>
  );
}

function RecentFaqsList({ sort }: { sort: 'added' | 'recent' }) {
  const navigate = useNavigate();
  const { data, isLoading } = useFaqList({ sort, pageSize: 5 });
  // Single-expand: matches Browse FAQs accordion behaviour
  const [openId, setOpenId] = useState<string | null>(null);
  const toggleFaq = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  if (isLoading)
    return (
      <div
        className="mod-card mod-card-blue"
        style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}
      >
        Loading…
      </div>
    );
  if (!data || data.items.length === 0)
    return (
      <div className="mod-card mod-card-blue" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No FAQs yet.</div>
      </div>
    );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 10 }}>
        {data.items.slice(0, 5).map((faq) => (
          <FaqCard
            key={faq.id}
            faq={faq}
            role="student"
            expanded={openId === faq.id}
            onToggle={() => toggleFaq(faq.id)}
          />
        ))}
      </div>
      <ViewAll onClick={() => navigate('/faqs')} />
    </>
  );
}

function RecentQuestionsList() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuestions({ type: 'community' });

  if (isLoading)
    return (
      <div
        className="mod-card mod-card-green"
        style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}
      >
        Loading…
      </div>
    );
  if (!data || data.length === 0)
    return (
      <div className="mod-card mod-card-green" style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          No community questions yet.
        </div>
      </div>
    );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {data.slice(0, 5).map((q) => {
          const qText =
            !q.description ||
            q.description.trim() === '' ||
            q.description.trim().toLowerCase() === q.title.trim().toLowerCase()
              ? q.title
              : q.description;
          const smIcon = q.status === 'open' ? <Circle size={12} /> : <CheckCircle2 size={12} />;
          const smColor = q.status === 'open' ? 'var(--color-primary)' : 'var(--color-success)';
          const smLabel = q.status.charAt(0).toUpperCase() + q.status.slice(1);
          const hrsSince = Math.floor((Date.now() - new Date(q.updatedAt).getTime()) / 3600000);
          const ago =
            hrsSince < 1
              ? 'just now'
              : hrsSince < 24
                ? `${hrsSince}hr${hrsSince === 1 ? '' : 's'} ago`
                : `${Math.floor(hrsSince / 24)}d ago`;
          return (
            <div
              key={q.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/community/${q.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(`/community/${q.id}`);
                }
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.boxShadow = 'var(--shadow-md)';
                el.style.borderColor = 'var(--color-primary)';
                el.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.boxShadow = 'none';
                el.style.borderColor = 'var(--color-border)';
                el.style.transform = 'none';
              }}
              style={{
                background: 'var(--color-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 12,
                padding: '14px 18px',
                cursor: 'pointer',
                transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.15s',
                outline: 'none',
                userSelect: 'none',
              }}
              onFocus={(e) => {
                (e.currentTarget as HTMLElement).style.outline = '2px solid var(--color-primary)';
              }}
              onBlur={(e) => {
                (e.currentTarget as HTMLElement).style.outline = 'none';
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  lineHeight: 1.5,
                  marginBottom: 10,
                  color: 'var(--color-text)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {qText}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 4 }}>
                {q.category && (
                  <>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        color: 'var(--color-primary)',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      <Folder size={12} />
                      <span>{q.category.name}</span>
                    </span>
                    <span style={{ margin: '0 8px', color: 'var(--color-border)' }}>|</span>
                  </>
                )}
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: smColor,
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {smIcon}
                  <span>{smLabel}</span>
                </span>
                <span style={{ margin: '0 8px', color: 'var(--color-border)' }}>|</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--color-text-muted)',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <MessageSquare size={12} />
                  <span>
                    {q.answerCount} response{q.answerCount === 1 ? '' : 's'}
                  </span>
                </span>
                <span style={{ margin: '0 8px', color: 'var(--color-border)' }}>|</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--color-text-muted)',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <User size={12} />
                  <span>by {q.author.name}</span>
                </span>
                <span style={{ margin: '0 8px', color: 'var(--color-border)' }}>|</span>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    color: 'var(--color-text-muted)',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  <Clock size={12} />
                  <span>{ago}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <ViewAll onClick={() => navigate('/community')} />
    </>
  );
}

// ─── Leaderboard / Ranking (Kaggle-style) ─────────────────────────────────────
//
// All data is live from /api/stats/leaderboard. Default view shows the top 5, the current
// user's own rank (only when they're outside the visible head/tail), and the bottom 2. The
// search box queries the full ranked cohort server-side by rank #, name, or student ID. The
// query hook polls every 30s so rankings update automatically as Spurti Points change.

function LeaderboardSection() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce so a request fires once the user pauses typing, not on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(id);
  }, [input]);

  const { data, isLoading, isError, refetch } = useLeaderboard(search);
  const searching = search.length > 0;

  return (
    <div id="leaderboard" style={{ marginTop: 28, scrollMarginTop: 16 }}>
      {/* Heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--color-card)',
            boxShadow: '0 2px 8px rgba(245,158,11,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Trophy size={16} color="#f59e0b" />
        </div>
        <div>
          <div
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
            }}
          >
            Leaderboard
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
            Ranked by Spurti Points
            {data ? ` · ${data.totalStudents} student${data.totalStudents === 1 ? '' : 's'}` : ''}
          </div>
        </div>
      </div>

      {/* Search */}
      <LeaderboardSearch value={input} onChange={setInput} onClear={() => setInput('')} />

      <div
        className="card"
        style={{ overflow: 'hidden', border: '1.5px solid var(--color-border)', padding: 0 }}
      >
        <LeaderboardColumnHeader />
        {isError ? (
          <LeaderboardMessage text="Couldn't load the leaderboard." onRetry={() => void refetch()} />
        ) : isLoading || !data ? (
          <LeaderboardSkeleton />
        ) : searching ? (
          // While a new query loads, `data` may still be the prior payload (placeholderData) whose
          // `search` is null — show a skeleton until the matching search response arrives.
          data.search ? (
            <SearchResultRows
              rows={data.search.results}
              currentUserId={user?.id}
              query={search}
            />
          ) : (
            <LeaderboardSkeleton />
          )
        ) : (
          <DefaultLeaderboard data={data} currentUserId={user?.id} />
        )}
      </div>
    </div>
  );
}

function LeaderboardSearch({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div style={{ position: 'relative', marginBottom: 14 }}>
      <Search
        size={16}
        color="var(--color-text-muted)"
        style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search by rank, name, or student ID…"
        aria-label="Search leaderboard"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '11px 38px 11px 40px',
          borderRadius: 12,
          border: '1.5px solid var(--color-border)',
          background: 'var(--color-card)',
          color: 'var(--color-text)',
          fontSize: 13.5,
          fontFamily: 'inherit',
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-primary)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }}
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          style={{
            position: 'absolute',
            right: 10,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            color: 'var(--color-text-muted)',
          }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

function LeaderboardColumnHeader() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-input)',
      }}
    >
      <span style={{ ...lbHeaderCellStyle, width: 36, textAlign: 'center', flexShrink: 0 }}>Rank</span>
      <span style={{ width: 34, flexShrink: 0 }} aria-hidden />
      <span style={{ ...lbHeaderCellStyle, flex: 1, minWidth: 0 }}>Participant</span>
      <span style={{ ...lbHeaderCellStyle, textAlign: 'right', flexShrink: 0 }}>Points</span>
    </div>
  );
}

const lbHeaderCellStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

function DefaultLeaderboard({
  data,
  currentUserId,
}: {
  data: LeaderboardResponse;
  currentUserId?: string;
}) {
  // The #1 score anchors every score bar so widths stay comparable across collapsed sections.
  const maxScore = Math.max(data.full?.[0]?.spurtiPoints ?? data.top[0]?.spurtiPoints ?? 0, 1);

  // Small cohort: the server returned everyone — render plainly, no collapsed gaps.
  if (data.full) {
    return (
      <>
        {data.full.map((r) => (
          <LeaderboardRow
            key={r.userId}
            row={r}
            maxScore={maxScore}
            me={r.userId === currentUserId}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {data.top.map((r) => (
        <LeaderboardRow key={r.userId} row={r} maxScore={maxScore} me={r.userId === currentUserId} />
      ))}

      {data.gapTop && (
        <LeaderboardGapRow gap={data.gapTop} maxScore={maxScore} currentUserId={currentUserId} />
      )}

      {data.me && (
        <>
          <LeaderboardDivider label="Your Rank" />
          <LeaderboardRow row={data.me} maxScore={maxScore} me />
        </>
      )}

      {data.gapBottom && (
        <LeaderboardGapRow gap={data.gapBottom} maxScore={maxScore} currentUserId={currentUserId} />
      )}

      {data.bottom.map((r) => (
        <LeaderboardRow key={r.userId} row={r} maxScore={maxScore} me={r.userId === currentUserId} />
      ))}
    </>
  );
}

// Collapsed range of ranks rendered as one expandable row (e.g. "Ranks 6–156 · View 151 more").
// Expanding lazily fetches just that slice via /api/stats/leaderboard/range.
function LeaderboardGapRow({
  gap,
  maxScore,
  currentUserId,
}: {
  gap: LeaderboardGap;
  maxScore: number;
  currentUserId?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data, isLoading, isError, refetch } = useLeaderboardRange(
    gap.fromRank,
    gap.toRank,
    expanded,
  );

  return (
    <>
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          background: 'var(--color-input)',
          border: 'none',
          borderTop: '2px dashed var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 36,
            display: 'flex',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'var(--color-text-muted)',
          }}
        >
          <MoreHorizontal size={18} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--color-text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            Ranks {gap.fromRank}–{gap.toRank}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 1 }}>
            {gap.count} student{gap.count === 1 ? '' : 's'} hidden
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 12px',
            borderRadius: 999,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-card)',
            color: 'var(--color-primary-text)',
            fontSize: 12,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {expanded ? 'Collapse' : `View ${gap.count} more`}
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </button>

      {expanded && (
        <div style={{ animation: 'pageIn 0.2s ease-out' }}>
          {isError ? (
            <LeaderboardMessage text="Couldn't load these ranks." onRetry={() => void refetch()} />
          ) : isLoading || !data ? (
            <LeaderboardSkeleton />
          ) : (
            data.rows.map((r) => (
              <LeaderboardRow
                key={r.userId}
                row={r}
                maxScore={maxScore}
                me={r.userId === currentUserId}
              />
            ))
          )}
        </div>
      )}
    </>
  );
}

function SearchResultRows({
  rows,
  currentUserId,
  query,
}: {
  rows: LeaderboardRow[];
  currentUserId?: string;
  query: string;
}) {
  if (rows.length === 0) {
    return (
      <LeaderboardMessage text={`No students match “${query}”. Try a name, rank number, or student ID.`} />
    );
  }
  const maxScore = Math.max(...rows.map((r) => r.spurtiPoints), 1);
  return (
    <>
      {rows.map((r) => (
        <LeaderboardRow key={r.userId} row={r} maxScore={maxScore} me={r.userId === currentUserId} />
      ))}
    </>
  );
}

function LeaderboardRow({
  row,
  maxScore,
  me,
}: {
  row: LeaderboardRow;
  maxScore: number;
  me: boolean;
}) {
  const pct = Math.max((row.spurtiPoints / maxScore) * 100, 2);
  const barFill = me
    ? 'var(--color-gradient-hero)'
    : row.rank === 1
      ? 'linear-gradient(90deg, color-mix(in srgb, var(--color-rank-gold) 70%, white), var(--color-rank-gold))'
      : row.rank === 2
        ? 'linear-gradient(90deg, var(--color-rank-silver), color-mix(in srgb, var(--color-rank-silver) 70%, black))'
        : row.rank === 3
          ? 'linear-gradient(90deg, var(--color-rank-bronze), color-mix(in srgb, var(--color-rank-bronze) 70%, black))'
          : 'linear-gradient(90deg, var(--color-primary), var(--color-info))';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-border)',
        background: me ? 'rgba(139,92,246,0.06)' : 'transparent',
        borderLeft: me ? '3px solid var(--color-purple)' : '3px solid transparent',
      }}
    >
      {/* Rank */}
      <div style={{ width: 36, textAlign: 'center', flexShrink: 0 }}>
        {row.rank <= 3 ? (
          <span style={{ fontSize: 20, lineHeight: 1 }}>{medalFor(row.rank)}</span>
        ) : (
          <span
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--color-text-muted)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            #{row.rank}
          </span>
        )}
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          flexShrink: 0,
          background: me ? 'var(--color-gradient-hero)' : rankAvatarBg(row.rank),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 800,
          color: 'white',
        }}
      >
        {row.name.charAt(0).toUpperCase()}
      </div>

      {/* Name + meta + score bar */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: me ? 700 : 600,
            color: me ? 'var(--color-purple)' : 'var(--color-text)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {me ? `${row.name} (You)` : row.name}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
          {row.studentId} · {row.approvedAnswers} approved
        </div>
        <div
          style={{
            marginTop: 6,
            height: 6,
            borderRadius: 4,
            background: 'var(--color-border)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${pct}%`,
              borderRadius: 4,
              background: barFill,
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Points */}
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 800,
            color: me ? 'var(--color-purple)' : 'var(--color-text)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          {row.spurtiPoints}
        </div>
        <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 2 }}>
          pts
        </div>
      </div>
    </div>
  );
}

function LeaderboardDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        background: 'var(--color-input)',
        borderTop: '2px dashed var(--color-border)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 800,
          color: 'var(--color-purple)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <div className="skeleton" style={{ width: 20, height: 14, borderRadius: 4 }} />
          <div className="skeleton" style={{ width: 34, height: 34, borderRadius: '50%' }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 6, marginBottom: 8 }} />
            <div className="skeleton" style={{ height: 6, width: '80%', borderRadius: 4 }} />
          </div>
          <div className="skeleton" style={{ width: 32, height: 16, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

function LeaderboardMessage({ text, onRetry }: { text: string; onRetry?: () => void }) {
  return (
    <div
      style={{
        padding: '28px 20px',
        textAlign: 'center',
        fontSize: 13,
        color: 'var(--color-text-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <div>{text}</div>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            padding: '7px 16px',
            borderRadius: 10,
            border: '1.5px solid var(--color-border)',
            background: 'var(--color-card)',
            color: 'var(--color-text)',
            fontWeight: 700,
            fontSize: 12.5,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}

function rankAvatarBg(rank: number): string {
  if (rank === 1)
    return 'linear-gradient(135deg, color-mix(in srgb, var(--color-rank-gold) 50%, white), var(--color-rank-gold))';
  if (rank === 2)
    return 'linear-gradient(135deg, color-mix(in srgb, var(--color-rank-silver) 40%, white), var(--color-rank-silver))';
  if (rank === 3)
    return 'linear-gradient(135deg, color-mix(in srgb, var(--color-rank-bronze) 40%, white), var(--color-rank-bronze))';
  // Rank 4+ : solid purple so the white initial stays legible in both themes.
  return 'linear-gradient(135deg, var(--color-primary), var(--color-purple))';
}

function medalFor(rank: number): string {
  return rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
}

function ViewAll({ onClick, label = 'View all' }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        color: 'var(--color-primary)',
        fontSize: 13,
        fontFamily: 'inherit',
        fontWeight: 600,
        padding: 0,
      }}
    >
      {label} <ChevronRight size={14} />
    </button>
  );
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
