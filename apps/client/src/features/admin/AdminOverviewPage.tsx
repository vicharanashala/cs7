// Admin Dashboard — a fully data-driven control surface mirroring the design spec:
// Action Required, Today's Overview, Performance Overview (trend cards + sparklines),
// Moderation Queue, Platform Health, Top Categories by Activity, and Recent Activity.
//
// Every number, list, percentage, and chart comes from a single consolidated snapshot
// (GET /api/stats/admin-dashboard) fetched via useAdminDashboard, which polls every 30s
// and refetches on focus — so the whole page stays consistent and near-real-time without
// a manual refresh. There are no hardcoded metrics; sections render from config arrays.
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  Headphones,
  HelpCircle,
  MessageSquare,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import type {
  AdminDashboard,
  MetricDelta,
  ModerationQueueItem,
  RateDelta,
  RecentActivityItem,
  TopCategory,
  TrendCard,
  TrendPoint,
} from '../stats/api';
import { useAdminDashboard } from '../stats/queries';

export function AdminOverviewPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useAdminDashboard();

  if (isError) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <AlertTriangle size={28} color="var(--color-danger)" style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
          Couldn’t load the dashboard
        </div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '6px 0 16px' }}>
          Something went wrong fetching the latest metrics.
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="btn btn-primary"
          style={{ cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 40 }}>
      <ActionRequiredSection data={data} loading={isLoading} navigate={navigate} />
      <TodayOverviewSection data={data} loading={isLoading} navigate={navigate} />
      <PerformanceSection data={data} loading={isLoading} />
      <PlatformHealthSection health={data?.platformHealth} loading={isLoading} />
      <BottomGrid data={data} loading={isLoading} navigate={navigate} />
    </div>
  );
}

type Nav = ReturnType<typeof useNavigate>;

// ─── Section 1: Action Required ────────────────────────────────────────────────

function ActionRequiredSection({
  data,
  loading,
  navigate,
}: {
  data?: AdminDashboard;
  loading: boolean;
  navigate: Nav;
}) {
  const ar = data?.actionRequired;
  const cards: {
    value?: number;
    title: string;
    icon: LucideIcon;
    tint: 'blue' | 'green' | 'orange' | 'purple' | 'red';
    color: string;
    bg: string;
    cta: string;
    to: string;
  }[] = [
    {
      value: ar?.pendingModeration,
      title: 'Pending Moderation',
      icon: Clock,
      tint: 'red',
      color: 'var(--color-danger)',
      bg: 'var(--color-danger-bg)',
      cta: 'View queue',
      to: '/moderation/unresolved',
    },
    {
      value: ar?.flaggedContent,
      title: 'Flagged Content',
      icon: Flag,
      tint: 'orange',
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-bg)',
      cta: 'Review now',
      to: '/admin/faqs',
    },
    {
      value: ar?.unansweredQuestions,
      title: 'Unanswered Questions',
      icon: HelpCircle,
      tint: 'purple',
      color: 'var(--color-purple)',
      bg: 'var(--color-purple-bg)',
      cta: 'View questions',
      to: '/moderation/unresolved',
    },
    {
      value: ar?.faqReviewsPending,
      title: 'FAQ Reviews Pending',
      icon: FileText,
      tint: 'blue',
      color: 'var(--color-info)',
      bg: 'var(--color-info-bg)',
      cta: 'Review FAQs',
      to: '/admin/faq-quality',
    },
  ];

  return (
    <section>
      <SectionLabel title="Action Required" />
      <CardStrip>
        {cards.map((c) => (
          <StatTile
            key={c.title}
            tint={c.tint}
            icon={c.icon}
            color={c.color}
            accentBg={c.bg}
            value={c.value ?? 0}
            label={c.title}
            loading={loading}
            onClick={() => navigate(c.to)}
            footer={
              <span
                style={{
                  color: c.color,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                {c.cta} <ChevronRight size={13} />
              </span>
            }
          />
        ))}
      </CardStrip>
    </section>
  );
}

// ─── Section 2: Today's Overview ───────────────────────────────────────────────

function TodayOverviewSection({
  data,
  loading,
  navigate,
}: {
  data?: AdminDashboard;
  loading: boolean;
  navigate: Nav;
}) {
  const t = data?.todayOverview;
  const cards: {
    metric?: MetricDelta;
    label: string;
    icon: LucideIcon;
    tint: 'blue' | 'green' | 'orange' | 'purple' | 'red';
    color: string;
    bg: string;
  }[] = [
    {
      metric: t?.questions,
      label: 'Questions Today',
      icon: MessageSquare,
      tint: 'green',
      color: 'var(--color-success)',
      bg: 'var(--color-success-bg)',
    },
    {
      metric: t?.answers,
      label: 'Answers Today',
      icon: Headphones,
      tint: 'blue',
      color: 'var(--color-info)',
      bg: 'var(--color-info-bg)',
    },
    {
      metric: t?.newFaqs,
      label: 'New FAQs',
      icon: BookOpen,
      tint: 'purple',
      color: 'var(--color-purple)',
      bg: 'var(--color-purple-bg)',
    },
    {
      metric: t?.activeStudents,
      label: 'Active Students',
      icon: Users,
      tint: 'orange',
      color: 'var(--color-warning)',
      bg: 'var(--color-warning-bg)',
    },
  ];

  return (
    <section>
      <SectionLabel
        title="Today's Overview"
        action={
          <LinkButton onClick={() => navigate('/admin/faq-quality')}>
            View detailed analytics
          </LinkButton>
        }
      />
      <CardStrip>
        {cards.map((c) => (
          <StatTile
            key={c.label}
            tint={c.tint}
            icon={c.icon}
            color={c.color}
            accentBg={c.bg}
            value={c.metric?.count ?? 0}
            label={c.label}
            loading={loading}
            footer={
              !loading && c.metric ? (
                <Delta pct={c.metric.deltaPct} suffix="vs yesterday" />
              ) : (
                <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              )
            }
          />
        ))}
      </CardStrip>
    </section>
  );
}

// ─── Section 3: Performance Overview ───────────────────────────────────────────

function PerformanceSection({ data, loading }: { data?: AdminDashboard; loading: boolean }) {
  const p = data?.performance;
  const cards: {
    card?: TrendCard;
    title: string;
    range: string;
    sub: string;
    deltaSuffix: string;
    color: string;
    isTime?: boolean;
    goodDown?: boolean;
  }[] = [
    {
      card: p?.questionsTrend,
      title: 'Questions Trend',
      range: 'Last 7 days',
      sub: 'Total Questions',
      deltaSuffix: 'vs previous 7 days',
      color: 'var(--color-purple)',
    },
    {
      card: p?.answersTrend,
      title: 'Answers Trend',
      range: 'Last 7 days',
      sub: 'Total Answers',
      deltaSuffix: 'vs previous 7 days',
      color: 'var(--color-success)',
    },
    {
      card: p?.faqsCreated,
      title: 'FAQs Created',
      range: 'Last 30 days',
      sub: 'New FAQs',
      deltaSuffix: 'vs previous 30 days',
      color: 'var(--color-primary)',
    },
    {
      card: p?.avgResponseTime,
      title: 'Average Response Time',
      range: 'Last 7 days',
      sub: 'Average time',
      deltaSuffix: 'vs previous 7 days',
      color: 'var(--color-purple)',
      isTime: true,
      goodDown: true,
    },
  ];

  return (
    <section>
      <SectionLabel title="Performance Overview" />
      <CardStrip>
        {cards.map((c) => (
          <Card key={c.title} style={{ padding: '18px 20px 14px' }}>
            <div
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 7,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: c.color,
                    flexShrink: 0,
                  }}
                />
                {c.title}
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{c.range}</span>
            </div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: 'var(--color-text)',
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                margin: '8px 0 2px',
              }}
            >
              {loading ? '—' : c.isTime ? `${c.card?.total ?? 0} hrs` : (c.card?.total ?? 0)}
            </div>
            <div style={cardSubStyle}>{c.sub}</div>
            {!loading && c.card && (
              <Delta pct={c.card.deltaPct} suffix={c.deltaSuffix} goodDown={c.goodDown} />
            )}
            <div style={{ marginTop: 14 }}>
              <Sparkline series={c.card?.series ?? []} color={c.color} loading={loading} />
            </div>
          </Card>
        ))}
      </CardStrip>
    </section>
  );
}

// ─── Bottom grid: Moderation Queue / Platform Health / Categories / Activity ────

function BottomGrid({
  data,
  loading,
  navigate,
}: {
  data?: AdminDashboard;
  loading: boolean;
  navigate: Nav;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: 20,
        alignItems: 'start',
      }}
    >
      <ModerationQueueCard queue={data?.moderationQueue} loading={loading} navigate={navigate} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <TopCategoriesCard categories={data?.topCategories} loading={loading} navigate={navigate} />
        <RecentActivityCard activity={data?.recentActivity} loading={loading} />
      </div>
    </div>
  );
}

function ModerationQueueCard({
  queue,
  loading,
  navigate,
}: {
  queue?: AdminDashboard['moderationQueue'];
  loading: boolean;
  navigate: Nav;
}) {
  const items = queue?.items ?? [];
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <CardHeaderRow
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
              Moderation Queue
            </span>
            {!loading && (queue?.count ?? 0) > 0 && <CountBadge count={queue!.count} />}
          </div>
        }
        right={<LinkButton onClick={() => navigate('/moderation/unresolved')}>View all →</LinkButton>}
      />
      {loading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyRow text="Nothing in the moderation queue. All caught up! 🎉" />
      ) : (
        items.map((item, i) => (
          <QueueRow
            key={item.id}
            item={item}
            last={i === items.length - 1}
            onClick={() => navigate('/moderation/unresolved')}
          />
        ))
      )}
      {!loading && items.length > 0 && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--color-border)' }}>
          <LinkButton onClick={() => navigate('/moderation/unresolved')}>
            View full moderation queue →
          </LinkButton>
        </div>
      )}
    </Card>
  );
}

function QueueRow({
  item,
  last,
  onClick,
}: {
  item: ModerationQueueItem;
  last: boolean;
  onClick: () => void;
}) {
  const isAnswer = item.type === 'answer';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 20px',
        background: 'transparent',
        border: 'none',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: 'var(--color-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {isAnswer ? (
          <MessageSquare size={15} color="var(--color-success)" />
        ) : (
          <HelpCircle size={15} color="var(--color-text-muted)" />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
          {isAnswer ? 'Answered' : 'Asked'} by {item.author}
        </div>
      </div>
      <Badge
        label={isAnswer ? 'Answer' : 'Question'}
        color={isAnswer ? 'var(--color-success)' : 'var(--color-purple)'}
      />
      <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
        {timeAgo(item.createdAt)}
      </span>
    </button>
  );
}

function PlatformHealthSection({
  health,
  loading,
}: {
  health?: AdminDashboard['platformHealth'];
  loading: boolean;
}) {
  const metrics: { metric?: RateDelta; label: string; goodDown?: boolean }[] = [
    { metric: health?.answerRate, label: 'Answer Rate' },
    { metric: health?.resolutionRate, label: 'Resolution Rate' },
    { metric: health?.faqCoverage, label: 'FAQ Coverage' },
    { metric: health?.flagRate, label: 'Flag Rate', goodDown: true },
  ];
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <CardHeaderRow
        left={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: 'var(--color-success)',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)' }}>
              Platform Health
            </span>
          </div>
        }
        right={<LinkButton>View all insights →</LinkButton>}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 20,
          padding: '18px 22px 22px',
        }}
      >
        {metrics.map((m) => (
          <div key={m.label}>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {m.label}
            </div>
            <div
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
              }}
            >
              {loading ? '—' : `${m.metric?.value ?? 0}%`}
            </div>
            {!loading && m.metric && (
              <Delta pct={m.metric.deltaPct} suffix="vs last 7 days" goodDown={m.goodDown} small />
            )}
            <HealthBar value={loading ? 0 : (m.metric?.value ?? 0)} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function HealthBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      style={{
        marginTop: 8,
        height: 4,
        borderRadius: 4,
        background: 'var(--color-border)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 4,
          background: 'var(--color-success)',
          transition: 'width var(--transition)',
        }}
      />
    </div>
  );
}

function TopCategoriesCard({
  categories,
  loading,
  navigate,
}: {
  categories?: TopCategory[];
  loading: boolean;
  navigate: Nav;
}) {
  const items = categories ?? [];
  const max = Math.max(1, ...items.map((c) => c.count));
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <CardHeaderRow
        left={
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            Top Categories by Activity
          </span>
        }
        right={<LinkButton onClick={() => navigate('/admin/faqs')}>View all →</LinkButton>}
      />
      <div style={{ padding: '12px 20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <ListSkeleton rows={4} bare />
        ) : items.length === 0 ? (
          <EmptyRow text="No category activity in the last 30 days." bare />
        ) : (
          items.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'var(--color-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <BookOpen size={14} color="var(--color-text-muted)" />
              </div>
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {c.name}
              </span>
              <div
                style={{
                  width: 50,
                  height: 5,
                  borderRadius: 4,
                  background: 'var(--color-border)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: `${(c.count / max) * 100}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    borderRadius: 4,
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  minWidth: 28,
                  textAlign: 'right',
                }}
              >
                {c.count}
              </span>
              <Delta pct={c.deltaPct} small bare />
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function RecentActivityCard({
  activity,
  loading,
}: {
  activity?: RecentActivityItem[];
  loading: boolean;
}) {
  const items = activity ?? [];
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <CardHeaderRow
        left={
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>
            Recent Activity
          </span>
        }
        right={<LinkButton>View full log →</LinkButton>}
      />
      <div style={{ padding: '12px 20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {loading ? (
          <ListSkeleton rows={4} bare />
        ) : items.length === 0 ? (
          <EmptyRow text="No recent activity yet." bare />
        ) : (
          items.map((a) => {
            const meta = activityMeta(a.type);
            return (
              <div key={a.id} style={{ display: 'flex', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: meta.bg,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <meta.icon size={14} color={meta.color} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: 'var(--color-text)', lineHeight: 1.4 }}>
                    {a.message}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {a.actor ? `by ${a.actor} · ` : ''}
                    {timeAgo(a.createdAt)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

// ─── Shared presentational primitives ──────────────────────────────────────────

function SectionLabel({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
      }}
    >
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)' }}>{title}</span>
      {action}
    </div>
  );
}

function CardStrip({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 20,
      }}
    >
      {children}
    </div>
  );
}

function IconChip({
  icon: Icon,
  color,
  bg,
  size = 40,
}: {
  icon: LucideIcon;
  color: string;
  bg: string;
  size?: number;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size >= 44 ? 13 : 11,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <Icon size={Math.round(size * 0.48)} color={color} strokeWidth={2.4} />
    </div>
  );
}

// Vibrant tinted stat tile mirroring the student dashboard cards: a soft color-glow
// surface, a decorative corner blob for depth, a colored icon chip, a big number, and
// a footer line. Becomes interactive (hover lift + chevron) when `onClick` is given.
function StatTile({
  tint,
  icon,
  color,
  accentBg,
  value,
  label,
  footer,
  onClick,
  loading,
}: {
  tint: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  icon: LucideIcon;
  color: string;
  accentBg: string;
  value: ReactNode;
  label: string;
  footer: ReactNode;
  onClick?: () => void;
  loading: boolean;
}) {
  return (
    <div
      className={`mod-card mod-card-${tint}${onClick ? ' interactive' : ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '20px 20px 18px',
        minHeight: 152,
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        outline: 'none',
      }}
    >
      {/* Decorative corner glow — gives the flat card an image-like sense of depth. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: -34,
          right: -28,
          width: 124,
          height: 124,
          borderRadius: '50%',
          background: `color-mix(in srgb, ${color} 13%, transparent)`,
          pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          bottom: -46,
          right: 34,
          width: 90,
          height: 90,
          borderRadius: '50%',
          background: `color-mix(in srgb, ${color} 8%, transparent)`,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
        }}
      >
        <IconChip icon={icon} color={color} bg={accentBg} size={46} />
        {onClick && <ChevronRight size={16} color={color} style={{ opacity: 0.45 }} />}
      </div>
      <div
        style={{
          position: 'relative',
          fontSize: 36,
          fontWeight: 800,
          color: 'var(--color-text)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginTop: 4,
        }}
      >
        {loading ? '…' : value}
      </div>
      <div
        style={{
          position: 'relative',
          fontSize: 14,
          fontWeight: 700,
          color: 'var(--color-text)',
          lineHeight: 1.2,
        }}
      >
        {label}
      </div>
      <div style={{ position: 'relative', fontSize: 12.5, fontWeight: 600 }}>{footer}</div>
    </div>
  );
}

function Delta({
  pct,
  suffix,
  goodDown,
  small,
  bare,
}: {
  pct: number;
  suffix?: string;
  goodDown?: boolean;
  small?: boolean;
  bare?: boolean;
}) {
  const up = pct > 0;
  const flat = pct === 0;
  // "good" direction: by default up is good (green). For metrics where lower is better
  // (response time, flag rate), down is good.
  const isGood = flat ? true : goodDown ? !up : up;
  const color = flat
    ? 'var(--color-text-muted)'
    : isGood
      ? 'var(--color-success)'
      : 'var(--color-danger)';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        marginTop: bare ? 0 : 6,
        fontSize: small ? 11 : 12,
        fontWeight: 600,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      <span>
        {up ? '↑' : flat ? '→' : '↓'} {Math.abs(pct)}%{suffix ? ` ${suffix}` : ''}
      </span>
    </div>
  );
}

function CardHeaderRow({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '18px 20px',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {left}
      {right}
    </div>
  );
}

function LinkButton({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        fontFamily: 'inherit',
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--color-primary)',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      {children}
    </button>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: 'white',
        background: 'var(--color-danger)',
        borderRadius: 999,
        minWidth: 20,
        height: 20,
        padding: '0 6px',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {count}
    </span>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 600,
        color,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
        borderRadius: 7,
        padding: '3px 9px',
      }}
    >
      {label}
    </span>
  );
}

function EmptyRow({ text, bare }: { text: string; bare?: boolean }) {
  return (
    <div
      style={{
        padding: bare ? 0 : '24px 20px',
        fontSize: 13,
        color: 'var(--color-text-muted)',
        textAlign: bare ? 'left' : 'center',
      }}
    >
      {text}
    </div>
  );
}

function ListSkeleton({ rows, bare }: { rows: number; bare?: boolean }) {
  return (
    <div style={{ padding: bare ? 0 : '8px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 14,
            margin: bare ? '0 0 14px' : '14px 20px',
            borderRadius: 6,
            background: 'var(--color-border)',
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  );
}

// ─── Sparkline (lightweight inline SVG, no chart dependency) ────────────────────

function Sparkline({
  series,
  color,
  loading,
}: {
  series: TrendPoint[];
  color: string;
  loading: boolean;
}) {
  const width = 280;
  const height = 56;
  const pad = 4;
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;

  if (loading || series.length === 0) {
    return <div style={{ height: height + 18 }} />;
  }

  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = series.length > 1 ? (width - pad * 2) / (series.length - 1) : 0;

  const points = series.map((p, i) => {
    const x = pad + i * stepX;
    const y = pad + (height - pad * 2) * (1 - (p.value - min) / range);
    return { x, y };
  });

  const line = points.map((pt, i) => `${i === 0 ? 'M' : 'L'}${pt.x},${pt.y}`).join(' ');
  const area = `${line} L${points[points.length - 1]!.x},${height} L${points[0]!.x},${height} Z`;

  // Show a handful of evenly spaced date labels so a 30-day axis doesn't crowd.
  const labelCount = Math.min(series.length, 7);
  const labelStep = Math.max(1, Math.floor((series.length - 1) / (labelCount - 1 || 1)));
  const labels = series.filter((_, i) => i % labelStep === 0 || i === series.length - 1);

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        style={{ width: '100%', height, display: 'block' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {points.map((pt, i) => (
          <circle key={i} cx={pt.x} cy={pt.y} r="2" fill={color} />
        ))}
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          fontSize: 10,
          color: 'var(--color-text-muted)',
        }}
      >
        {labels.map((p) => (
          <span key={p.date}>{formatAxisDate(p.date)}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const cardSubStyle = {
  fontSize: 12,
  color: 'var(--color-text-muted)',
  marginTop: 2,
} as const;

function activityMeta(type: RecentActivityItem['type']): {
  icon: LucideIcon;
  color: string;
  bg: string;
} {
  switch (type) {
    case 'faq':
      return { icon: FileText, color: 'var(--color-success)', bg: 'var(--color-success-bg)' };
    case 'answer':
      return { icon: MessageSquare, color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' };
    case 'flag':
      return { icon: AlertTriangle, color: 'var(--color-danger)', bg: 'var(--color-danger-bg)' };
    case 'user':
    default:
      return { icon: UserPlus, color: 'var(--color-purple)', bg: 'var(--color-purple-bg)' };
  }
}

function formatAxisDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
