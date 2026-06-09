// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — the single source of truth for inline styles.
//
// The codebase styles components with inline `style={{ ... }}` objects, so these
// tokens are plain TS values (not just CSS custom properties) that components can
// import and spread directly. CSS-variable equivalents live in globals.css for
// className-based styling; keep the two in sync.
//
// Always reference these instead of hardcoding magic numbers. New code that needs
// a value off these scales is almost always a mistake — round to the nearest step.
// ─────────────────────────────────────────────────────────────────────────────

/** Border radius scale. Matches --radius-* in globals.css. */
export const radius = {
  /** 6px — tight chips, small controls */
  xs: 6,
  /** 8px — inputs, small buttons, icon tiles */
  sm: 8,
  /** 12px — buttons, list rows, nested cards */
  md: 12,
  /** 16px — inputs/medium surfaces */
  lg: 16,
  /** 22px — cards / primary surfaces */
  xl: 22,
  /** Fully rounded — pills, avatars, dots */
  full: 9999,
} as const;

/**
 * Spacing scale (4px base grid). Use for padding, margin, and gap so vertical
 * and horizontal rhythm stays on a single grid across every screen.
 */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 48,
  10: 64,
} as const;

/**
 * Type scale with semantic roles. Pair each size with the matching `weight` and
 * `leading` for a coherent hierarchy.
 */
export const fontSize = {
  /** 11px — captions, helper text, eyebrow labels */
  caption: 11,
  /** 12px — secondary/meta text */
  sm: 12,
  /** 13px — body (default app text) */
  body: 13,
  /** 14px — emphasized body, form inputs */
  md: 14,
  /** 16px — lead paragraph / large body */
  lg: 16,
  /** 20px — section / page titles */
  xl: 20,
  /** 26px — page hero headings */
  '2xl': 26,
  /** 32px — display numbers / big stats */
  '3xl': 32,
  /** 40px — marketing display */
  '4xl': 40,
} as const;

/**
 * Font weights. Constrained to four steps — regular, medium, semibold, bold.
 * Avoid 800/900: bold (700) is the heaviest weight in the system.
 */
export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

/** Line-height roles. */
export const leading = {
  /** 1.1 — display numbers / tight headings */
  tight: 1.1,
  /** 1.25 — headings */
  heading: 1.25,
  /** 1.5 — body copy */
  body: 1.5,
} as const;

/** Letter-spacing roles (em). Headings tighten; eyebrow labels track out. */
export const tracking = {
  heading: '-0.02em',
  display: '-0.03em',
  normal: '0',
  label: '0.06em',
} as const;

/** Shadow scale. Mirrors --shadow-* in globals.css. */
export const shadow = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  hover: 'var(--shadow-hover)',
} as const;

/** Standard motion timing. Mirrors --transition. */
export const transition = '0.18s ease';

/**
 * Convenience text presets — spread one of these to apply a complete, coherent
 * type style (size + weight + line-height + tracking + color) in one shot.
 */
export const text = {
  pageTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    lineHeight: leading.heading,
    letterSpacing: tracking.heading,
    color: 'var(--color-text)',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    lineHeight: leading.heading,
    letterSpacing: tracking.heading,
    color: 'var(--color-text)',
  },
  body: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: leading.body,
    color: 'var(--color-text)',
  },
  meta: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    lineHeight: leading.body,
    color: 'var(--color-text-muted)',
  },
  /** Uppercase eyebrow / field label. */
  eyebrow: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.bold,
    letterSpacing: tracking.label,
    textTransform: 'uppercase' as const,
    color: 'var(--color-text-muted)',
  },
} as const;
