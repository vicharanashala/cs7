// Centered overlay modal with backdrop, Escape-to-close, scroll lock, and focus
// management. Standardizes the ad-hoc `position:fixed` dialogs scattered across
// admin/FAQ pages. Renders into document.body via a portal for correct stacking.
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { fontSize, fontWeight, radius, space, tracking } from '../../lib/tokens';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  /** Optional sub-line under the title. */
  description?: ReactNode;
  children: ReactNode;
  /** Footer actions (typically Buttons), pinned to the bottom-right. */
  footer?: ReactNode;
  /** Max content width in px. Default 480. */
  width?: number;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape to close + lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: space[4],
        animation: 'pageIn 0.16s ease-out',
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: radius.xl,
          boxShadow: 'var(--shadow-lg)',
          width: '100%',
          maxWidth: width,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          outline: 'none',
        }}
      >
        {(title || description) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: space[3],
              padding: `${space[5]}px ${space[5]}px ${space[3]}px`,
            }}
          >
            <div>
              {title && (
                <div
                  style={{
                    fontSize: fontSize.lg,
                    fontWeight: fontWeight.bold,
                    color: 'var(--color-text)',
                    letterSpacing: tracking.heading,
                  }}
                >
                  {title}
                </div>
              )}
              {description && (
                <div
                  style={{
                    fontSize: fontSize.sm,
                    color: 'var(--color-text-muted)',
                    marginTop: space[1],
                    lineHeight: 1.4,
                  }}
                >
                  {description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="topbar-icon-btn"
              style={{ flexShrink: 0, margin: -4 }}
            >
              <X size={18} />
            </button>
          </div>
        )}

        <div style={{ padding: `0 ${space[5]}px ${space[5]}px`, overflowY: 'auto' }}>{children}</div>

        {footer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: space[2],
              padding: `${space[3]}px ${space[5]}px ${space[5]}px`,
              borderTop: '1px solid var(--color-border)',
              marginTop: 'auto',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
