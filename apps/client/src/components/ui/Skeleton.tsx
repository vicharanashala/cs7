// Loading placeholders built on the `.skeleton` shimmer in globals.css. Replaces
// the ~18 ad-hoc "Loading…" text states with a consistent shimmer that matches
// the shape of the content being loaded.
import type { CSSProperties } from 'react';
import { radius, space } from '../../lib/tokens';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  /** Border radius token; defaults to `md`. Use `full` for avatars/circles. */
  rounded?: keyof typeof radius;
  style?: CSSProperties;
}

export function Skeleton({ width = '100%', height = 14, rounded = 'md', style }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className="skeleton"
      style={{ display: 'block', width, height, borderRadius: radius[rounded], ...style }}
    />
  );
}

/** A card-shaped block of stacked skeleton lines — a drop-in list/detail loader. */
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      className="card"
      style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: space[3] }}
      aria-busy="true"
    >
      <Skeleton width="55%" height={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '80%' : '100%'} height={12} />
      ))}
    </div>
  );
}

/** Repeats SkeletonCard to stand in for a loading list. */
export function SkeletonList({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[3] }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={lines} />
      ))}
    </div>
  );
}
