// Shared Moderation Queue card grid.
// Used by both ModerationOverviewPage (Moderator Dashboard) and AdminOverviewPage (Admin Dashboard).
import { useModeratorStats } from '../faq/queries';

export function ModerationQueueCards() {
  const { data, isLoading } = useModeratorStats();
  const v = (n: number | undefined) => (isLoading ? '…' : (n ?? 0));

  return (
    <>
      {/* ── Row 1: Personal + Community ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Personal Questions */}
        <div className="mod-card mod-card-blue">
          <CardHeader
            icon={<PersonIcon />}
            iconBg="var(--color-primary-bg)"
            title="Personal Questions"
          />
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px 20px' }}>
            <PersonalCircle />
            <div style={{ flex: 1, paddingLeft: 16 }}>
              <MetricRow
                icon={<UsersIcon color="var(--color-primary)" />}
                iconBg="var(--color-primary-bg)"
                value={v(data?.personal.total)}
                label="Total personal questions"
                sub="All time, all students"
                subColor="var(--color-primary)"
              />
              <MetricRow
                icon={<HelpIcon color="var(--color-danger)" />}
                iconBg="var(--color-danger-bg)"
                value={v(data?.personal.unanswered)}
                label="Unanswered"
                sub="Awaiting moderator response"
                subColor="var(--color-danger)"
              />
              <MetricRow
                icon={<CalIcon color="var(--color-primary)" />}
                iconBg="var(--color-primary-bg)"
                value={v(data?.personal.today)}
                label="Posted today"
                sub="New questions since midnight"
                subColor="var(--color-primary)"
                last
              />
            </div>
          </div>
        </div>

        {/* Community Questions */}
        <div className="mod-card mod-card-green">
          <CardHeader
            icon={<ChatIcon color="var(--color-success)" />}
            iconBg="var(--color-success-bg)"
            title="Community Questions"
          />
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px 20px' }}>
            <CommunityRing
              answered={typeof data?.community.answered === 'number' ? data.community.answered : 0}
              total={typeof data?.community.total === 'number' ? data.community.total : 0}
            />
            <div style={{ flex: 1, paddingLeft: 16 }}>
              <MetricRow
                icon={<BarIcon color="var(--color-success)" />}
                iconBg="var(--color-success-bg)"
                value={v(data?.community.total)}
                label="Total (all-time)"
                sub="Answered + unanswered"
                subColor="var(--color-success)"
              />
              <MetricRow
                icon={<CheckIcon color="var(--color-success)" />}
                iconBg="var(--color-success-bg)"
                value={v(data?.community.answered)}
                label="Answered by peers"
                sub="Has at least one answer"
                subColor="var(--color-success)"
              />
              <MetricRow
                icon={<HelpIcon color="var(--color-danger)" />}
                iconBg="var(--color-danger-bg)"
                value={v(data?.community.unanswered)}
                label="Unanswered"
                sub="No peer answer yet"
                subColor="var(--color-danger)"
                last
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: Community Today + FAQs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Community Questions Today */}
        <div className="mod-card mod-card-orange">
          <CardHeader
            icon={<CalCheckIcon color="var(--color-warning)" />}
            iconBg="var(--color-warning-bg)"
            title="Community Questions Today"
          />
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px 20px' }}>
            <Calendar3D />
            <div style={{ flex: 1, paddingLeft: 16 }}>
              <MetricRow
                icon={<CalIcon color="var(--color-warning)" />}
                iconBg="var(--color-warning-bg)"
                value={v(data?.communityToday.total)}
                label="Posted today"
                sub="Total since midnight"
                subColor="var(--color-warning)"
              />
              <MetricRow
                icon={<CheckIcon color="var(--color-success)" />}
                iconBg="var(--color-success-bg)"
                value={v(data?.communityToday.answered)}
                label="Answered today"
                sub="Received a peer answer today"
                subColor="var(--color-success)"
              />
              <MetricRow
                icon={<ClockIcon color="var(--color-danger)" />}
                iconBg="var(--color-danger-bg)"
                value={v(data?.communityToday.unanswered)}
                label="Unanswered today"
                sub="Still waiting for a reply"
                subColor="var(--color-danger)"
                last
              />
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="mod-card mod-card-purple">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '18px 20px 0 20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--color-purple-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOpenIcon color="var(--color-purple)" />
              </div>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.01em',
                }}
              >
                FAQs
              </span>
            </div>
            <FaqDocIllustration />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3,1fr)',
              gap: 10,
              padding: '10px 16px 18px',
            }}
          >
            <FaqSubCard
              icon={<BookOpenIcon color="var(--color-purple)" size={20} />}
              value={v(data?.faqs.total)}
              label="Total FAQs"
              sub="All statuses in the system"
            />
            <FaqSubCard
              icon={<CalPlusIcon color="var(--color-purple)" />}
              value={v(data?.faqs.today)}
              label="Added today"
              sub="Created since midnight"
            />
            <FaqSubCard
              icon={<TrendIcon color="var(--color-purple)" />}
              value={v(data?.faqs.thisWeek)}
              label="Added this week"
              sub="Created in the last 7 days"
            />
          </div>
        </div>
      </div>

      {/* ── Flagged FAQs — full width ── */}
      <div className="mod-card mod-card-red">
        <CardHeader
          icon={<FlagIcon color="var(--color-danger)" />}
          iconBg="var(--color-danger-bg)"
          title="Flagged FAQs"
        />
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3,1fr)',
            padding: '4px 24px 24px',
          }}
        >
          <FlaggedPanel
            icon={<AlertCircleIcon color="var(--color-danger)" />}
            iconBg="var(--color-danger-bg)"
            value={v(data?.flaggedFaqs.total)}
            label="Total flagged"
            sub="Open or under review flags"
            subColor="var(--color-danger)"
          />
          <FlaggedPanel
            icon={<TriangleAlertIcon color="var(--color-warning)" />}
            iconBg="var(--color-warning-bg)"
            value={v(data?.flaggedFaqs.today)}
            label="Flagged today"
            sub="New flags since midnight"
            subColor="var(--color-warning)"
          />
          <FlaggedPanel
            icon={<ClockIcon color="var(--color-warning)" />}
            iconBg="var(--color-warning-bg)"
            value={v(data?.flaggedFaqs.thisWeek)}
            label="Flagged this week"
            sub="Flags in the last 7 days"
            subColor="var(--color-warning)"
          />
        </div>
      </div>
    </>
  );
}

// ─── Shared card header ───────────────────────────────────────────────────────

function CardHeader({
  icon,
  iconBg,
  title,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 0' }}>
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 16,
          fontWeight: 800,
          color: 'var(--color-text)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </span>
    </div>
  );
}

// ─── Metric row ───────────────────────────────────────────────────────────────

function MetricRow({
  icon,
  iconBg,
  value,
  label,
  sub,
  subColor,
  last,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number | string;
  label: string;
  sub: string;
  subColor: string;
  last?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 0',
        borderBottom: last ? 'none' : '1px solid var(--color-border)',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.03em',
              lineHeight: 1,
            }}
          >
            {value}
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 500 }}>
            {label}
          </span>
        </div>
        <div style={{ fontSize: 11, color: subColor, fontWeight: 600, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

// ─── FAQ sub-card ─────────────────────────────────────────────────────────────

function FaqSubCard({
  icon,
  value,
  label,
  sub,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  sub: string;
}) {
  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 14,
        padding: '14px 12px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 11,
          background: 'var(--color-purple-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {icon}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: 'var(--color-text)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>{label}</div>
      <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{sub}</div>
    </div>
  );
}

// ─── Flagged panel ────────────────────────────────────────────────────────────

function FlaggedPanel({
  icon,
  iconBg,
  value,
  label,
  sub,
  subColor,
}: {
  icon: React.ReactNode;
  iconBg: string;
  value: number | string;
  label: string;
  sub: string;
  subColor: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 4px' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: 32,
            fontWeight: 900,
            color: 'var(--color-text)',
            letterSpacing: '-0.05em',
            lineHeight: 1,
          }}
        >
          {value}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginTop: 3 }}>
          {label}
        </div>
        <div style={{ fontSize: 11, color: subColor, fontWeight: 500, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

// ─── Personal Questions illustration ─────────────────────────────────────────

function PersonalCircle() {
  return (
    <div
      style={{
        width: 110,
        height: 110,
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: 'var(--color-primary-bg)',
          opacity: 0.5,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 14,
          borderRadius: '50%',
          background: 'var(--color-primary-bg)',
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 28,
          borderRadius: '50%',
          background: 'var(--color-primary-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="30"
          height="30"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>
    </div>
  );
}

// ─── Community ring illustration ──────────────────────────────────────────────

function CommunityRing({ answered, total }: { answered: number; total: number }) {
  const pct = total > 0 ? answered / total : 0;
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;

  return (
    <div
      style={{
        width: 110,
        height: 110,
        flexShrink: 0,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 6,
          left: 14,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--color-success)',
          opacity: 0.3,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 10,
          left: 8,
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: 'var(--color-success)',
          opacity: 0.2,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 6,
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: 'var(--color-success)',
          opacity: 0.25,
        }}
      />
      <svg width="110" height="110" viewBox="0 0 110 110" style={{ position: 'absolute' }}>
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke="var(--color-success-bg)"
          strokeWidth="10"
        />
        <circle
          cx="55"
          cy="55"
          r={r}
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="10"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 55 55)"
        />
      </svg>
      <div
        style={{
          width: 46,
          height: 46,
          borderRadius: '50%',
          background: 'var(--color-success-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-success)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </div>
    </div>
  );
}

// ─── 3D Calendar illustration ─────────────────────────────────────────────────

function Calendar3D() {
  return (
    <div style={{ width: 120, height: 116, flexShrink: 0, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 80,
          height: 10,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.10)',
          filter: 'blur(4px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 4,
          width: 88,
          height: 96,
          borderRadius: 16,
          background: 'white',
          boxShadow: '0 8px 24px rgba(249,115,22,0.18), 0 2px 8px rgba(0,0,0,0.08)',
        }}
      >
        <div
          style={{
            height: 30,
            background: 'linear-gradient(135deg,#fb923c,#f97316)',
            borderRadius: '16px 16px 0 0',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: 22,
              width: 10,
              height: 16,
              borderRadius: 5,
              background: '#c2410c',
              border: '2px solid #f97316',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -6,
              left: 56,
              width: 10,
              height: 16,
              borderRadius: 5,
              background: '#c2410c',
              border: '2px solid #f97316',
            }}
          />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4,1fr)',
            gap: 5,
            padding: '10px 10px 8px',
          }}
        >
          {[
            '#c4b5fd',
            '#fed7aa',
            '#bbf7d0',
            '#bfdbfe',
            '#bfdbfe',
            '#c4b5fd',
            '#fed7aa',
            '#bbf7d0',
            '#bbf7d0',
            '#bfdbfe',
            '#c4b5fd',
            'transparent',
          ].map((bg, i) => (
            <div key={i} style={{ height: 12, borderRadius: 3, background: bg }} />
          ))}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 2,
          right: 2,
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: 'white',
          boxShadow: '0 4px 14px rgba(249,115,22,0.22), 0 1px 4px rgba(0,0,0,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
          <circle cx="13" cy="13" r="11" stroke="#fed7aa" strokeWidth="2" fill="white" />
          <circle cx="13" cy="13" r="2" fill="#f97316" />
          <line
            x1="13"
            y1="13"
            x2="13"
            y2="6"
            stroke="#f97316"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="13"
            y1="13"
            x2="19"
            y2="17"
            stroke="#fb923c"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

// ─── FAQ document illustration ────────────────────────────────────────────────

function FaqDocIllustration() {
  return (
    <div style={{ position: 'relative', width: 120, height: 90, flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: 10,
          fontSize: 14,
          color: 'var(--color-purple)',
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        +
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 6,
          fontSize: 10,
          color: 'var(--color-purple)',
          fontWeight: 800,
          lineHeight: 1,
          opacity: 0.6,
        }}
      >
        +
      </div>
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 0,
          width: 72,
          height: 76,
          borderRadius: 12,
          background: 'var(--color-purple-bg)',
          transform: 'rotate(7deg)',
          boxShadow: '0 4px 10px rgba(124,58,237,0.1)',
        }}
      >
        <div style={{ margin: '12px 10px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[80, 55, 70].map((w, i) => (
            <div
              key={i}
              style={{
                width: `${w}%`,
                height: 4,
                borderRadius: 2,
                background: 'rgba(124,58,237,0.25)',
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 0,
          right: 14,
          width: 72,
          height: 76,
          borderRadius: 12,
          background: 'var(--color-purple-bg)',
          boxShadow: '0 6px 18px rgba(124,58,237,0.14)',
        }}
      >
        <div style={{ margin: '12px 10px 0', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {[70, 50, 62, 40].map((w, i) => (
            <div
              key={i}
              style={{
                width: `${w}%`,
                height: 4,
                borderRadius: 2,
                background: 'rgba(124,58,237,0.25)',
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 22,
          right: 2,
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'var(--color-purple)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 900,
          color: 'white',
          lineHeight: 1,
          boxShadow: '0 4px 12px rgba(124,58,237,0.4)',
        }}
      >
        ?
      </div>
    </div>
  );
}

// ─── SVG icon components ──────────────────────────────────────────────────────

function PersonIcon({ color = 'var(--color-primary)' }: { color?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function ChatIcon({ color = 'var(--color-success)' }: { color?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function UsersIcon({ color = 'var(--color-primary)' }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function HelpIcon({ color = 'var(--color-danger)' }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function CalIcon({ color = 'var(--color-primary)' }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
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
function CalCheckIcon({ color = 'var(--color-warning)' }: { color?: string }) {
  return (
    <svg
      width="18"
      height="18"
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
      <polyline points="9 16 11 18 15 14" />
    </svg>
  );
}
function BarIcon({ color = 'var(--color-success)' }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
function CheckIcon({ color = 'var(--color-success)' }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function ClockIcon({ color = 'var(--color-danger)' }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function BookOpenIcon({
  color = 'var(--color-purple)',
  size = 18,
}: {
  color?: string;
  size?: number;
}) {
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
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
function CalPlusIcon({ color = 'var(--color-purple)' }: { color?: string }) {
  return (
    <svg
      width="20"
      height="20"
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
      <line x1="12" y1="15" x2="12" y2="19" />
      <line x1="10" y1="17" x2="14" y2="17" />
    </svg>
  );
}
function TrendIcon({ color = 'var(--color-purple)' }: { color?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
function FlagIcon({ color = 'var(--color-danger)' }: { color?: string }) {
  return (
    <svg
      width="18"
      height="18"
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
function AlertCircleIcon({ color = 'var(--color-danger)' }: { color?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function TriangleAlertIcon({ color = 'var(--color-warning)' }: { color?: string }) {
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
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
