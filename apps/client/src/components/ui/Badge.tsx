// Small rounded status pill. `color` maps to a semantic palette via CSS variables,
// so it adapts to light/dark theme automatically.
import type { ReactNode } from 'react';

export type BadgeColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
}

const COLOR_VARS: Record<BadgeColor, { bg: string; text: string; border: string }> = {
  default: { bg: 'var(--color-pill)', text: 'var(--color-pill-text)', border: 'transparent' },
  accent: {
    bg: 'var(--color-primary-bg)',
    text: 'var(--color-primary-text)',
    border: 'transparent',
  },
  success: { bg: 'var(--color-success-bg)', text: 'var(--color-success)', border: 'transparent' },
  warning: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning)', border: 'transparent' },
  danger: { bg: 'var(--color-danger-bg)', text: 'var(--color-danger)', border: 'transparent' },
};

export function Badge({ children, color = 'default' }: BadgeProps) {
  const c = COLOR_VARS[color];
  return (
    <span
      style={{
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 'var(--radius-full)',
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        display: 'inline-block',
        letterSpacing: '0.01em',
      }}
    >
      {children}
    </span>
  );
}
