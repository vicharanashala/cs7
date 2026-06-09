// Surface container with theme styling. When `onClick` is provided it becomes
// interactive (pointer cursor + hover lift/elevation). `as` picks the rendered element.
import type { CSSProperties, ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
  as?: 'div' | 'button' | 'article';
}

export function Card({ children, style, onClick, as: Tag = 'div' }: CardProps) {
  const isClickable = Boolean(onClick);
  return (
    <Tag
      onClick={onClick}
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '20px 22px',
        boxShadow: 'var(--shadow-sm)',
        textAlign: 'left',
        width: '100%',
        cursor: isClickable ? 'pointer' : 'default',
        font: 'inherit',
        color: 'inherit',
        transition:
          'box-shadow var(--transition), transform var(--transition), border-color var(--transition)',
        ...style,
      }}
      onMouseEnter={
        isClickable
          ? (e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = 'var(--shadow-hover)';
              el.style.transform = 'translateY(-1px)';
              el.style.borderColor = 'var(--color-primary)';
            }
          : undefined
      }
      onMouseLeave={
        isClickable
          ? (e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.boxShadow = 'var(--shadow-sm)';
              el.style.transform = '';
              el.style.borderColor = '';
            }
          : undefined
      }
    >
      {children}
    </Tag>
  );
}
