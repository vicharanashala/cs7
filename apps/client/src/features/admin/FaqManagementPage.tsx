// Shared FAQ Management — admins and moderators see exactly the same surface (Dashboard Spec).
// Tabs: FAQs (default) | Categories | Tags.
//
// The three summary cards (Helpful / Unhelpful / Flagged FAQs) are fully data-driven:
//   - rates + published total + flag counts come from useModeratorStats (getModeratorDashboardStats)
//   - the 7-day trend lines come from useVotesTrend (daily helpful/unhelpful/flagged vote counts)
// Nothing is hardcoded; the cards render loading/empty states from the live payloads.
import { useState, type ReactNode } from 'react';
import { useFaqStats, useModeratorStats, useVotesTrend } from '../faq/queries';
import { FaqsAdminTab } from './tabs/FaqsAdminTab';
import { CategoriesAdminTab } from './tabs/CategoriesAdminTab';
import { TagsAdminTab } from './tabs/TagsAdminTab';
import { SectionHeader } from '../../components/ui/SectionHeader';

type Tab = 'faqs' | 'categories' | 'tags';

export function FaqManagementPage() {
  const [tab, setTab] = useState<Tab>('faqs');
  const { data: stats } = useFaqStats();
  const { data: modStats, isLoading: modLoading } = useModeratorStats();
  const { data: trend } = useVotesTrend();

  // Per-series 7-day points + matching weekday labels (derived from the real dates).
  const labels = trend?.map((d) => weekday(d.date));
  const helpfulPoints = trend?.map((d) => d.helpful);
  const unhelpfulPoints = trend?.map((d) => d.unhelpful);
  const flaggedPoints = trend?.map((d) => d.flagged);
  const last = <T,>(arr?: T[]): T | undefined => (arr && arr.length ? arr[arr.length - 1] : undefined);

  return (
    <div>
      <SectionHeader title="FAQ Management" sub="Shared knowledge base — admins and moderators." />

      {/* ── 3 summary cards ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 20,
          marginBottom: 24,
        }}
      >
        {/* Helpful FAQs */}
        <StatCard
          accent="var(--color-success)"
          cardBg="var(--color-success-bg)"
          icon={<ThumbsUpIcon color="var(--color-success)" />}
          title="Helpful FAQs"
          subtitle="Making a positive impact"
        >
          <RateRing
            color="var(--color-success)"
            percentage={num(modLoading, modStats?.helpfulFaqs.percentage)}
            caption="Helpful rate"
            publishedTotal={modStats?.helpfulFaqs.publishedTotal}
            loading={modLoading}
            votes={last(helpfulPoints) ?? 0}
          />
          <TrendCard color="var(--color-success)" points={helpfulPoints} labels={labels} />
        </StatCard>

        {/* Unhelpful FAQs */}
        <StatCard
          accent="var(--color-danger)"
          cardBg="var(--color-danger-bg)"
          icon={<ThumbsDownIcon color="var(--color-danger)" />}
          title="Unhelpful FAQs"
          subtitle="Needs improvement"
        >
          <RateRing
            color="var(--color-danger)"
            percentage={num(modLoading, modStats?.unhelpfulFaqs.percentage)}
            caption="Unhelpful rate"
            publishedTotal={modStats?.unhelpfulFaqs.publishedTotal}
            loading={modLoading}
            votes={last(unhelpfulPoints) ?? 0}
          />
          <TrendCard color="var(--color-danger)" points={unhelpfulPoints} labels={labels} />
        </StatCard>

        {/* Flagged FAQs */}
        <StatCard
          accent="var(--color-warning)"
          cardBg="var(--color-warning-bg)"
          icon={<FlagIcon color="var(--color-warning)" />}
          title="Flagged FAQs"
          subtitle="Requires attention"
        >
          <FlaggedStat
            total={modStats?.flaggedFaqs.total}
            today={modStats?.flaggedFaqs.today}
            thisWeek={modStats?.flaggedFaqs.thisWeek}
            loading={modLoading}
          />
          <TrendCard color="var(--color-warning)" points={flaggedPoints} labels={labels} flagged />
        </StatCard>
      </div>

      {/* ── Tab bar ── */}
      <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <TabButton active={tab === 'faqs'} onClick={() => setTab('faqs')}>
          FAQs
        </TabButton>
        <TabButton active={tab === 'categories'} onClick={() => setTab('categories')}>
          Categories
        </TabButton>
        <TabButton active={tab === 'tags'} onClick={() => setTab('tags')}>
          Tags
        </TabButton>
      </div>

      {tab === 'faqs' && <FaqsAdminTab flaggedCount={stats?.flaggedCount ?? 0} />}
      {tab === 'categories' && <CategoriesAdminTab />}
      {tab === 'tags' && <TagsAdminTab />}
    </div>
  );
}

// ─── StatCard shell ────────────────────────────────────────────────────────────

function StatCard({
  accent,
  cardBg,
  icon,
  title,
  subtitle,
  children,
}: {
  accent: string;
  cardBg: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 24,
        background: cardBg,
        padding: '22px 24px 24px',
        boxShadow: '0 2px 16px rgba(0,0,0,0.05)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Header — round tinted icon + title/subtitle + overflow menu */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: `color-mix(in srgb, ${accent} 16%, transparent)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
            {subtitle}
          </div>
        </div>
        <span
          aria-hidden
          style={{ color: 'var(--color-text-muted)', fontSize: 18, lineHeight: 1, letterSpacing: 1 }}
        >
          ···
        </span>
      </div>

      {children}
    </div>
  );
}

// ─── RateRing — donut with % + caption centered, right column with total + pill ──

function RateRing({
  color,
  percentage,
  caption,
  publishedTotal,
  loading,
  votes,
}: {
  color: string;
  percentage: number;
  caption: string;
  publishedTotal?: number;
  loading: boolean;
  votes: number;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      <Donut size={120} stroke={11} percentage={percentage} color={color}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 900,
            color: 'var(--color-text)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {loading ? '—' : `${percentage}%`}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>{caption}</div>
      </Donut>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, color: 'var(--color-text-muted)', lineHeight: 1.35 }}>
          Across{' '}
          <strong style={{ color: 'var(--color-text)', fontWeight: 800 }}>
            {loading ? '—' : (publishedTotal ?? 0)}
          </strong>
          <br />
          published FAQs
        </div>
        <VotesPill color={color} votes={votes} />
      </div>
    </div>
  );
}

// ─── FlaggedStat — donut with count centered, two stacked pills on the right ─────

function FlaggedStat({
  total,
  today,
  thisWeek,
  loading,
}: {
  total?: number;
  today?: number;
  thisWeek?: number;
  loading: boolean;
}) {
  const color = 'var(--color-warning)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
      {/* Decorative full gradient ring — flagged has no rate, so the ring is a visual frame. */}
      <Donut size={120} stroke={11} percentage={100} color={color} gradient>
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: 'var(--color-text)',
            letterSpacing: '-0.04em',
            lineHeight: 1,
          }}
        >
          {loading ? '—' : (total ?? 0)}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)', marginTop: 4 }}>
          Total flagged
        </div>
        <div style={{ fontSize: 9, color, fontWeight: 600, marginTop: 1 }}>Open or under review</div>
      </Donut>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CountPill color={color} icon={<FlagIcon color={color} size={14} />}>
          <strong style={{ fontWeight: 800 }}>{loading ? '—' : (today ?? 0)}</strong> flagged today
        </CountPill>
        <CountPill color={color} icon={<CalendarIcon color={color} />}>
          <strong style={{ fontWeight: 800 }}>{loading ? '—' : (thisWeek ?? 0)}</strong> this week
        </CountPill>
      </div>
    </div>
  );
}

// ─── Donut ring ──────────────────────────────────────────────────────────────--

function Donut({
  size,
  stroke,
  percentage,
  color,
  gradient,
  children,
}: {
  size: number;
  stroke: number;
  percentage: number;
  color: string;
  gradient?: boolean;
  children: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(Math.max(percentage, 0) / 100, 1) * circ;
  const gradId = `donut-grad-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {gradient && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.45" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
        )}
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={`color-mix(in srgb, ${color} 22%, transparent)`}
          strokeWidth={stroke}
        />
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke={gradient ? `url(#${gradId})` : color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${c} ${c})`}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '0 8px',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ─── Pills ──────────────────────────────────────────────────────────────────--

function VotesPill({ color, votes }: { color: string; votes: number }) {
  return (
    <div
      style={{
        marginTop: 12,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: '7px 12px',
        fontSize: 13,
        fontWeight: 700,
        color,
      }}
    >
      <TrendUpIcon color={color} />
      {votes} votes today
    </div>
  );
}

function CountPill({
  color,
  icon,
  children,
}: {
  color: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 12,
        padding: '10px 14px',
        fontSize: 13,
        fontWeight: 600,
        color,
      }}
    >
      {icon}
      <span>{children}</span>
    </div>
  );
}

// ─── TrendCard — white box, sparkline (or empty state) + weekday axis + min/max ──

function TrendCard({
  color,
  points,
  labels,
  flagged,
}: {
  color: string;
  points?: number[];
  labels?: string[];
  flagged?: boolean;
}) {
  const vals = normalize(points);
  const max = Math.max(...vals);
  const min = Math.min(...vals);
  const dayLabels = normalizeLabels(labels);
  const empty = flagged && max === 0;

  return (
    <div
      style={{
        borderRadius: 16,
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        padding: '14px 16px 12px',
      }}
    >
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 10 }}>
        Trend (last 7 days)
      </div>

      {empty ? (
        <EmptyFlagTrend color={color} labels={dayLabels} />
      ) : (
        <Sparkline color={color} vals={vals} />
      )}

      {/* Weekday axis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        {dayLabels.map((label, i) => (
          <span key={i} style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {label}
          </span>
        ))}
      </div>

      {/* Min / Max */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>Min: {min}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>Max: {max}</span>
      </div>
    </div>
  );
}

function Sparkline({ color, vals }: { color: string; vals: number[] }) {
  const W = 320;
  const H = 96;
  const maxVal = Math.max(...vals, 1);
  const ys = vals.map((v) => H * 0.92 - (v / maxVal) * (H * 0.82));
  const xs = vals.map((_, i) => 6 + i * ((W - 12) / (vals.length - 1)));

  const path = ys.reduce((acc, y, i) => {
    const x = xs[i]!;
    if (i === 0) return `M ${x} ${y}`;
    const px = xs[i - 1]!;
    const py = ys[i - 1]!;
    const cx = px + (x - px) / 2;
    return `${acc} C ${cx} ${py} ${cx} ${y} ${x} ${y}`;
  }, '');
  const gradId = `spark-${color.replace(/[^a-z0-9]/gi, '')}`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z`} fill={`url(#${gradId})`} />
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {ys.map((y, i) => (
        <circle key={i} cx={xs[i]} cy={y} r={i === ys.length - 1 ? 4.5 : 3.5} fill={color} />
      ))}
    </svg>
  );
}

function EmptyFlagTrend({ color, labels }: { color: string; labels: string[] }) {
  const W = 320;
  const H = 96;
  const y = H - 14;
  const xs = labels.map((_, i) => 6 + i * ((W - 12) / (labels.length - 1)));
  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          paddingBottom: 18,
          textAlign: 'center',
        }}
      >
        <ShieldCheckIcon color="var(--color-success)" />
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-success)' }}>
          No flags in the last 7 days
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Great work! Keep it up.</div>
      </div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <line x1={xs[0]} y1={y} x2={xs[xs.length - 1]} y2={y} stroke={color} strokeWidth="2" />
        {xs.map((x, i) => (
          <circle key={i} cx={x} cy={y} r="3.5" fill={color} />
        ))}
      </svg>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────--

function num(loading: boolean, n: number | undefined): number {
  return loading ? 0 : (n ?? 0);
}

/** Coerce a points array to exactly 7 numbers (pad/truncate). */
function normalize(points?: number[]): number[] {
  const vals = (points && points.length > 0 ? points : [0, 0, 0, 0, 0, 0, 0]).slice(-7);
  while (vals.length < 7) vals.unshift(0);
  return vals;
}

/** Weekday labels matching the 7 points — fall back to the trailing 7 days. */
function normalizeLabels(labels?: string[]): string[] {
  if (labels && labels.length >= 7) return labels.slice(-7);
  const out: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    out.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
  }
  return out;
}

function weekday(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      style={{
        fontSize: 13,
        fontWeight: 500,
        padding: '6px 16px',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-primary)' : 'var(--color-card)',
        color: active ? 'white' : 'var(--color-text-muted)',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

// ─── SVG icon components ──────────────────────────────────────────────────────

function ThumbsUpIcon({ color = 'var(--color-success)' }: { color?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
      <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
    </svg>
  );
}

function ThumbsDownIcon({ color = 'var(--color-danger)' }: { color?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
      <path d="M17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17" />
    </svg>
  );
}

function FlagIcon({ color = 'var(--color-warning)', size = 22 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function CalendarIcon({ color = 'var(--color-warning)' }: { color?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function TrendUpIcon({ color }: { color: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function ShieldCheckIcon({ color }: { color: string }) {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}
