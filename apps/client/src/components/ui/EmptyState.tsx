// Standardized empty state — one consistent layout for "no data yet" across the
// app, replacing the bespoke per-page empty messages that varied in padding,
// wording, and iconography.
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';
import type { ReactNode } from 'react';
import { fontSize, fontWeight, radius, space } from '../../lib/tokens';

interface EmptyStateProps {
  /** Lucide icon component; defaults to an inbox. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional call-to-action (typically a Button). */
  action?: ReactNode;
  /** Render without the surrounding card surface (e.g. already inside a Card). */
  bare?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  bare = false,
}: EmptyStateProps) {
  return (
    <div
      className={bare ? undefined : 'card'}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: space[2],
        padding: `${space[8]}px ${space[6]}px`,
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 48,
          height: 48,
          borderRadius: radius.lg,
          background: 'var(--color-pill)',
          color: 'var(--color-text-muted)',
          marginBottom: space[1],
        }}
      >
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: 'var(--color-text)' }}>
        {title}
      </div>
      {description && (
        <div
          style={{
            fontSize: fontSize.body,
            color: 'var(--color-text-muted)',
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      )}
      {action && <div style={{ marginTop: space[2] }}>{action}</div>}
    </div>
  );
}
