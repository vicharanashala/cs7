// Premium trust/authority identity row — Twitter/X-style verification for staff roles.
import { Shield, Crown, Clock } from 'lucide-react';

type StaffRole = 'moderator' | 't-moderator' | 'admin' | 't-admin';

const STAFF_ROLES = new Set<string>(['moderator', 't-moderator', 'admin', 't-admin']);

function isStaff(role: string): role is StaffRole {
  return STAFF_ROLES.has(role);
}

// ── avatarColor ────────────────────────────────────────────────────────────────
// Values are CSS variable references so they adapt to dark/light mode automatically.
const PALETTE = [
  { bg: 'var(--avatar-blue-bg)',   fg: 'var(--avatar-blue-fg)'   },
  { bg: 'var(--avatar-pink-bg)',   fg: 'var(--avatar-pink-fg)'   },
  { bg: 'var(--avatar-green-bg)',  fg: 'var(--avatar-green-fg)'  },
  { bg: 'var(--avatar-amber-bg)',  fg: 'var(--avatar-amber-fg)'  },
  { bg: 'var(--avatar-purple-bg)', fg: 'var(--avatar-purple-fg)' },
  { bg: 'var(--avatar-red-bg)',    fg: 'var(--avatar-red-fg)'    },
  { bg: 'var(--avatar-sky-bg)',    fg: 'var(--avatar-sky-fg)'    },
  { bg: 'var(--avatar-violet-bg)', fg: 'var(--avatar-violet-fg)' },
];
function avatarColor(name: string) {
  let n = 0;
  for (let i = 0; i < name.length; i++) n += name.charCodeAt(i);
  return PALETTE[n % PALETTE.length];
}

// ── VerifiedCheckmark — overlays bottom-right of the avatar ───────────────────
function VerifiedCheckmark({ role }: { role: StaffRole }) {
  const isAdmin = role === 'admin' || role === 't-admin';
  return (
    <div
      style={{
        position: 'absolute',
        bottom: -3,
        right: -3,
        width: 13,
        height: 13,
        borderRadius: '50%',
        background: 'var(--color-info)',
        border: '1.5px solid var(--color-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: isAdmin
          ? '0 0 0 2px color-mix(in srgb, var(--color-info) 30%, transparent), 0 1px 3px rgba(0,0,0,0.2)'
          : '0 1px 3px rgba(0,0,0,0.15)',
        zIndex: 1,
      }}
    >
      {/* Inline checkmark SVG — crisp at 13 px */}
      <svg width="7" height="7" viewBox="0 0 8 8" fill="none">
        <path d="M1.5 4L3.2 5.8L6.5 2.2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ── RolePill ──────────────────────────────────────────────────────────────────
function RolePill({ role }: { role: StaffRole }) {
  const isTemp = role === 't-moderator' || role === 't-admin';
  const isAdmin = role === 'admin' || role === 't-admin';

  const pillStyles: React.CSSProperties = (() => {
    if (role === 'admin') return {
      background: 'var(--color-info)',
      color: 'var(--color-card)',
      border: '1px solid var(--color-info)',
      boxShadow: '0 0 0 2px color-mix(in srgb, var(--color-info) 20%, transparent), 0 1px 4px color-mix(in srgb, var(--color-info) 30%, transparent)',
    };
    if (role === 't-admin') return {
      background: 'var(--color-primary-bg)',
      color: 'var(--color-primary)',
      border: '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)',
      boxShadow: '0 0 0 1.5px color-mix(in srgb, var(--color-primary) 15%, transparent)',
    };
    if (role === 'moderator') return {
      background: 'var(--color-info-bg)',
      color: 'var(--color-info)',
      border: '1px solid color-mix(in srgb, var(--color-info) 35%, transparent)',
    };
    // t-moderator
    return {
      background: 'var(--color-warning-bg)',
      color: 'var(--color-warning)',
      border: '1px dashed color-mix(in srgb, var(--color-warning) 60%, transparent)',
    };
  })();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 7px',
        borderRadius: 20,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        flexShrink: 0,
        ...pillStyles,
      }}
    >
      {isAdmin
        ? <Crown size={9} style={{ flexShrink: 0 }} />
        : <Shield size={9} style={{ flexShrink: 0 }} />}
      {isTemp && <Clock size={8} style={{ flexShrink: 0, marginLeft: 1 }} />}
      {role === 'moderator' && 'Moderator'}
      {role === 't-moderator' && 'T-Moderator'}
      {role === 'admin' && 'Admin'}
      {role === 't-admin' && 'T-Admin'}
    </span>
  );
}

// ── StaffIdentity — the public API ────────────────────────────────────────────

/**
 * Renders an author identity row with platform-style verification for staff.
 *
 * Usage:
 *   <StaffIdentity name="Jahnvi" role="moderator" timestamp={answer.createdAt} />
 *   <StaffIdentity name="Priya" role="student" avatarSize={22} />
 */
export function StaffIdentity({
  name,
  role = 'student',
  timestamp,
  avatarSize = 26,
}: {
  name: string;
  role?: string;
  timestamp?: string;
  avatarSize?: number;
}) {
  const color = avatarColor(name);
  const staff = isStaff(role);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {/* Avatar + optional verification badge */}
      <div style={{ position: 'relative', flexShrink: 0, width: avatarSize, height: avatarSize }}>
        <div
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: '50%',
            background: color.bg,
            color: color.fg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: avatarSize * 0.42,
            fontWeight: 800,
          }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        {staff && <VerifiedCheckmark role={role as StaffRole} />}
      </div>

      {/* Name */}
      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text)' }}>
        {name}
      </span>

      {/* Role pill — staff only */}
      {staff && <RolePill role={role as StaffRole} />}

      {/* Timestamp */}
      {timestamp && (
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 2 }}>
          · {timeAgo(timestamp)}
        </span>
      )}
    </div>
  );
}

// ── timeAgo helper (local — avoids cross-feature import) ─────────────────────
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
