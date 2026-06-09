// Page/section heading: an accent bar, a title with optional subtitle, and an
// optional right-aligned action slot (e.g. a button).
import type { ReactNode } from 'react';

interface SectionHeaderProps {
  title: string;
  sub?: string;
  action?: ReactNode;
}

export function SectionHeader({ title, sub, action }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginBottom: 20,
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div
          style={{
            width: 4,
            borderRadius: 4,
            background: 'var(--color-primary)',
            alignSelf: 'stretch',
            minHeight: 28,
            flexShrink: 0,
          }}
        />
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
          {sub && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                marginTop: 3,
                lineHeight: 1.4,
              }}
            >
              {sub}
            </div>
          )}
        </div>
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
