// Shared tab bar. Replaces the hand-rolled `role="tab"` pill rows that were
// duplicated (with diverging styles) across Home, FAQ management, and My Questions.
// Controlled: the parent owns the active value.
import type { ReactNode } from 'react';
import { fontSize, fontWeight, radius, space, transition } from '../../lib/tokens';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  /** Optional trailing count badge. */
  count?: number;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  'aria-label'?: string;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: space[2], flexWrap: 'wrap', marginBottom: space[4] }}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: space[2],
              fontSize: fontSize.body,
              fontWeight: fontWeight.semibold,
              padding: '8px 16px',
              borderRadius: radius.md,
              border: `1.5px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: active ? 'var(--color-primary)' : 'var(--color-card)',
              color: active ? 'white' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: `all ${transition}`,
            }}
          >
            {item.label}
            {item.count != null && (
              <span
                style={{
                  fontSize: fontSize.caption,
                  fontWeight: fontWeight.bold,
                  padding: '1px 7px',
                  borderRadius: radius.full,
                  background: active ? 'rgba(255,255,255,0.22)' : 'var(--color-pill)',
                  color: active ? 'white' : 'var(--color-pill-text)',
                }}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
