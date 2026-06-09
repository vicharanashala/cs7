// App-wide toast notifications. There was no toast system before — success/error
// feedback was bespoke per page. Wrap the app in <ToastProvider> and call
// `useToast().show(...)` (or the `success`/`error`/`info` helpers) anywhere.
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { fontSize, fontWeight, radius, space } from '../../lib/tokens';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  show: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const KIND_STYLE: Record<ToastKind, { color: string; bg: string; Icon: typeof CheckCircle2 }> = {
  success: { color: 'var(--color-success)', bg: 'var(--color-success-bg)', Icon: CheckCircle2 },
  error: { color: 'var(--color-danger)', bg: 'var(--color-danger-bg)', Icon: AlertCircle },
  info: { color: 'var(--color-info)', bg: 'var(--color-info-bg)', Icon: Info },
};

const AUTO_DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), AUTO_DISMISS_MS);
  }, []);

  const api: ToastApi = {
    show,
    success: (m) => show(m, 'success'),
    error: (m) => show(m, 'error'),
    info: (m) => show(m, 'info'),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: space[6],
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column',
            gap: space[2],
            alignItems: 'center',
            pointerEvents: 'none',
          }}
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { color, bg, Icon } = KIND_STYLE[toast.kind];
  return (
    <div
      role="status"
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: space[2],
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderLeft: `3px solid ${color}`,
        borderRadius: radius.md,
        boxShadow: 'var(--shadow-lg)',
        padding: `10px 12px 10px 14px`,
        minWidth: 260,
        maxWidth: 420,
        animation: 'pageIn 0.18s ease-out',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          borderRadius: radius.sm,
          background: bg,
          color,
          flexShrink: 0,
        }}
      >
        <Icon size={15} />
      </span>
      <span
        style={{
          fontSize: fontSize.body,
          fontWeight: fontWeight.medium,
          color: 'var(--color-text)',
          flex: 1,
          lineHeight: 1.4,
        }}
      >
        {toast.message}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="topbar-icon-btn"
        style={{ flexShrink: 0, padding: 4 }}
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}
