/**
 * GlobalTooltip — viewport-aware tooltip system.
 *
 * Usage: add data-tooltip="text" to any element. Optionally hint the preferred
 * side with data-tooltip-placement="top|bottom|left|right" (default: top).
 *
 * Works via event delegation on document — no per-element wiring needed.
 * Renders into document.body via a portal so overflow:hidden containers never
 * clip it. Collision-detects all four sides and flips automatically.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

type Side = 'top' | 'bottom' | 'left' | 'right';

const GAP = 10;          // px between anchor edge and tooltip
const EDGE = 8;          // minimum distance from viewport edge
const MAX_W = 220;       // max tooltip width (px)
const ARROW = 6;         // half-size of the arrow diamond (px)

// ── helpers ───────────────────────────────────────────────────────────────────

function parseSide(s: string | null): Side {
  if (s === 'bottom' || s === 'left' || s === 'right') return s;
  return 'top';
}

function fits(side: Side, r: DOMRect, w: number, h: number): boolean {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  switch (side) {
    case 'top':    return r.top    - h - GAP          >= EDGE;
    case 'bottom': return r.bottom + h + GAP          <= vh - EDGE;
    case 'left':   return r.left   - w - GAP          >= EDGE;
    case 'right':  return r.right  + w + GAP          <= vw - EDGE;
  }
}

/** Returns tooltip top-left in viewport coords, plus arrow offset. */
function place(side: Side, r: DOMRect, w: number, h: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let x: number, y: number;
  switch (side) {
    case 'top':
      x = r.left + r.width / 2 - w / 2;
      y = r.top - h - GAP;
      break;
    case 'bottom':
      x = r.left + r.width / 2 - w / 2;
      y = r.bottom + GAP;
      break;
    case 'left':
      x = r.left - w - GAP;
      y = r.top + r.height / 2 - h / 2;
      break;
    case 'right':
      x = r.right + GAP;
      y = r.top + r.height / 2 - h / 2;
      break;
  }

  // Clamp to viewport
  const cx = Math.max(EDGE, Math.min(vw - w - EDGE, x));
  const cy = Math.max(EDGE, Math.min(vh - h - EDGE, y));

  // Arrow points from tooltip toward the anchor midpoint.
  // We track how far the anchor center is from the tooltip edge so the arrow
  // follows even when the tooltip is clamped to the edge.
  const anchorMidX = r.left + r.width / 2;
  const anchorMidY = r.top + r.height / 2;
  // Arrow's position along the relevant axis, clamped within the tooltip
  const arrowAlongX = Math.max(ARROW * 2, Math.min(w - ARROW * 2, anchorMidX - cx));
  const arrowAlongY = Math.max(ARROW * 2, Math.min(h - ARROW * 2, anchorMidY - cy));

  return { x: cx, y: cy, arrowAlongX, arrowAlongY };
}

// ── component ─────────────────────────────────────────────────────────────────

interface TipState {
  text: string;
  side: Side;
  x: number;
  y: number;
  arrowAlongX: number;
  arrowAlongY: number;
  phase: 'hidden' | 'measuring' | 'visible';
}

const INITIAL: TipState = {
  text: '', side: 'top', x: 0, y: 0, arrowAlongX: 0, arrowAlongY: 0, phase: 'hidden',
};

export function GlobalTooltip() {
  const [tip, setTip] = useState<TipState>(INITIAL);
  const divRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number>(0);

  /** Measure the rendered tooltip and snap to its final position. */
  const finalize = useCallback((anchor: HTMLElement, text: string, hint: Side) => {
    const r = anchor.getBoundingClientRect();
    const el = divRef.current;
    const w = el ? el.offsetWidth  : Math.min(MAX_W, text.length * 7 + 24);
    const h = el ? el.offsetHeight : 28;

    const fallback: Side[] = [hint, 'top', 'bottom', 'right', 'left'];
    const tried = new Set<Side>();
    let chosen: Side = hint;
    for (const s of fallback) {
      if (!tried.has(s)) {
        tried.add(s);
        if (fits(s, r, w, h)) { chosen = s; break; }
      }
    }

    const pos = place(chosen, r, w, h);
    setTip(prev => ({ ...prev, ...pos, side: chosen, phase: 'visible' }));
  }, []);

  useEffect(() => {
    // Dismiss the active tooltip and forget its anchor.
    const clear = () => {
      anchorRef.current = null;
      cancelAnimationFrame(rafRef.current);
      setTip(INITIAL);
    };

    const show = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
      if (!anchor) return;

      const text = anchor.getAttribute('data-tooltip') ?? '';
      if (!text) return;

      const hint = parseSide(anchor.getAttribute('data-tooltip-placement'));

      if (anchorRef.current !== anchor) {
        anchorRef.current = anchor;

        // Phase 1: render with content but invisible so the browser can measure it.
        setTip({ text, side: hint, x: -9999, y: -9999, arrowAlongX: 0, arrowAlongY: 0, phase: 'measuring' });

        // Phase 2: after browser paint, measure actual size and position correctly.
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          if (anchorRef.current === anchor) finalize(anchor, text, hint);
        });
      }
    };

    const hide = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
      if (!anchor) return;
      const related = e.relatedTarget as Node | null;
      if (related && anchor.contains(related)) return;
      if (anchorRef.current === anchor) clear();
    };

    // Clicking an anchor often unmounts it (e.g. "Close chat", "Edit") before any
    // mouseout fires — dismiss immediately so the tooltip can't linger.
    const onPointerDown = (e: Event) => {
      const anchor = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement | null;
      if (anchor && anchorRef.current === anchor) clear();
    };

    // Safety net: if the active anchor is removed from the DOM for any reason
    // while its tooltip is showing, mouseout never fires — drop it on detach.
    const observer = new MutationObserver(() => {
      if (anchorRef.current && !anchorRef.current.isConnected) clear();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Use capture so we get events even inside shadow-DOM-like subtrees.
    document.addEventListener('mouseover', show, true);
    document.addEventListener('mouseout',  hide,  true);
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      document.removeEventListener('mouseover', show, true);
      document.removeEventListener('mouseout',  hide,  true);
      document.removeEventListener('pointerdown', onPointerDown, true);
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, [finalize]);

  if (tip.phase === 'hidden') return null;

  // ── arrow geometry ──────────────────────────────────────────────────────────
  // The arrow is a 12×12 rotated square clipped to a triangle using clip-path.
  const d = ARROW * 2;
  const arrowStyle: React.CSSProperties = {
    position: 'absolute',
    width: d,
    height: d,
    background: '#1e293b',
    transform: 'rotate(45deg)',
    borderRadius: 2,
    pointerEvents: 'none',
  };

  switch (tip.side) {
    case 'top':
      Object.assign(arrowStyle, { bottom: -(ARROW - 1), left: tip.arrowAlongX - ARROW });
      break;
    case 'bottom':
      Object.assign(arrowStyle, { top: -(ARROW - 1), left: tip.arrowAlongX - ARROW });
      break;
    case 'left':
      Object.assign(arrowStyle, { right: -(ARROW - 1), top: tip.arrowAlongY - ARROW });
      break;
    case 'right':
      Object.assign(arrowStyle, { left: -(ARROW - 1), top: tip.arrowAlongY - ARROW });
      break;
  }

  const isVisible = tip.phase === 'visible';

  return createPortal(
    <div
      ref={divRef}
      role="tooltip"
      style={{
        position: 'fixed',
        left: tip.x,
        top: tip.y,
        maxWidth: MAX_W,
        background: '#1e293b',
        color: '#f8fafc',
        padding: '6px 10px',
        borderRadius: 7,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.45,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        zIndex: 99999,
        pointerEvents: 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.28)',
        fontFamily: 'inherit',
        letterSpacing: '0.01em',
        // Two-phase: invisible during measurement, then fade in.
        opacity: isVisible ? 1 : 0,
        transition: isVisible ? 'opacity 0.12s ease' : 'none',
        userSelect: 'none',
      }}
    >
      {tip.text}
      <div style={arrowStyle} />
    </div>,
    document.body,
  );
}
