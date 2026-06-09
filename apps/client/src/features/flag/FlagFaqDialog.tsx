// "Flag this FAQ" affordance for students. Renders a button that opens an inline form.
// After flagging:
//   - Shows a persistent "Flagged for review" confirmation badge.
//   - Persists the flag in localStorage so the badge survives page reloads.
//   - If the FAQ's updatedAt timestamp is newer than when the user flagged it,
//     shows an "Updated since you flagged" notice so the user knows it was addressed.
import { useState, useEffect, useRef } from 'react';
import { Flag, Bell } from 'lucide-react';
import { FLAG_REASONS, type FlagReason } from '@samagama/shared';
import { Button } from '../../components/ui/Button';
import { useCreateFlag } from './queries';

const REASON_LABELS: Record<FlagReason, string> = {
  incorrect: 'Incorrect',
  outdated: 'Outdated',
  duplicate: 'Duplicate',
  unclear: 'Unclear',
  other: 'Other',
};

const STORAGE_KEY = 'samagama:flaggedFaqs';

interface FlagRecord {
  flaggedAt: string; // ISO — when the user submitted the flag
  faqUpdatedAt: string; // ISO — FAQ's updatedAt at the time of flagging
}

function readFlagStore(): Record<string, FlagRecord> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

function saveFlagRecord(faqId: string, record: FlagRecord) {
  const store = readFlagStore();
  store[faqId] = record;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

interface Props {
  faqId: string;
  faqUpdatedAt?: string;
}

export function FlagFaqButton({ faqId, faqUpdatedAt = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FlagReason>('outdated');
  const [details, setDetails] = useState('');
  const flag = useCreateFlag();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const firstReasonRef = useRef<HTMLButtonElement>(null);

  // Move focus into dialog on open; restore to trigger on close
  useEffect(() => {
    if (open) {
      firstReasonRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Read persisted flag state from localStorage on mount.
  const [persisted, setPersisted] = useState<FlagRecord | null>(() => {
    const store = readFlagStore();
    return store[faqId] ?? null;
  });

  // When mutation succeeds, persist the flag record.
  useEffect(() => {
    if (flag.isSuccess) {
      const record: FlagRecord = { flaggedAt: new Date().toISOString(), faqUpdatedAt };
      saveFlagRecord(faqId, record);
      setPersisted(record);
    }
  }, [flag.isSuccess, faqId, faqUpdatedAt]);

  // Determine if the FAQ was updated after the user flagged it.
  const wasFaqUpdated =
    persisted !== null && faqUpdatedAt && new Date(faqUpdatedAt) > new Date(persisted.flaggedAt);

  // Already flagged — show confirmation + optional update notice.
  if (persisted && !open) {
    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 6,
          alignItems: 'center',
          justifyContent: 'flex-end',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            color: 'var(--color-warning)',
            fontWeight: 600,
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning)',
            borderRadius: 12,
            padding: '3px 8px',
          }}
        >
          <Flag size={10} /> Flagged for review
        </span>
        {wasFaqUpdated && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: 'var(--color-success)',
              fontWeight: 600,
              background: 'var(--color-success-bg)',
              border: '1px solid var(--color-success)',
              borderRadius: 12,
              padding: '3px 8px',
            }}
          >
            <Bell size={10} /> FAQ updated since you flagged it
          </span>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 16px',
          borderRadius: 24,
          background: 'var(--color-input)',
          color: 'var(--color-text-muted)',
          border: '1.5px solid var(--color-border)',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'background 0.18s ease, color 0.18s ease',
          outline: 'none',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-card)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-input)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
        }}
      >
        <Flag size={14} strokeWidth={1.8} /> Flag this FAQ
      </button>
    );
  }

  const submit = async () => {
    flag.reset();
    await flag.mutateAsync({
      entityType: 'faq',
      entityId: faqId,
      reason,
      details: details.trim() || undefined,
    });
    setOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Flag this FAQ"
      style={{
        background: 'var(--color-input)',
        border: '1px solid var(--color-warning)',
        borderRadius: 8,
        padding: 12,
        marginTop: 10,
        width: '100%',
      }}
    >
      <div
        style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-warning)', marginBottom: 8 }}
      >
        Flag this FAQ
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {FLAG_REASONS.map((r, i) => (
          <button
            key={r}
            ref={i === 0 ? firstReasonRef : undefined}
            type="button"
            onClick={() => setReason(r)}
            style={{
              fontSize: 11,
              padding: '5px 12px',
              borderRadius: 16,
              border: `1px solid ${reason === r ? 'var(--color-warning)' : 'var(--color-border)'}`,
              background: reason === r ? 'var(--color-warning-bg)' : 'var(--color-card)',
              color: reason === r ? 'var(--color-warning)' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            {REASON_LABELS[r]}
          </button>
        ))}
      </div>
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Optional: add context to help moderators (max 1000 chars)."
        rows={3}
        maxLength={1000}
        style={{
          width: '100%',
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          padding: '6px 8px',
          fontSize: 12,
          fontFamily: 'inherit',
          color: 'var(--color-text)',
          resize: 'vertical',
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {flag.error && (
        <div role="alert" style={{ marginTop: 6, fontSize: 11, color: 'var(--color-danger)' }}>
          {flag.error instanceof Error ? flag.error.message : 'Could not submit flag'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'flex-end' }}>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="warning" onClick={submit} disabled={flag.isPending}>
          {flag.isPending ? 'Submitting…' : 'Submit flag'}
        </Button>
      </div>
    </div>
  );
}
