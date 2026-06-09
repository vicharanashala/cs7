// Inline flag inbox shown above the FAQ list when the Flagged filter is active.
// Lists open/under_review flags on FAQs with their reason and reporter so moderators can
// triage without leaving FAQ Management.
import { useMemo, useState } from 'react';
import { Flag, Check, X, Sparkles } from 'lucide-react';
import type { FlagReason } from '@samagama/shared';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useFlagList, useUpdateFlagStatus } from '../../flag/queries';

const REASON_COPY: Record<FlagReason, string> = {
  incorrect: 'Incorrect',
  outdated: 'Outdated',
  duplicate: 'Duplicate',
  unclear: 'Unclear',
  other: 'Other',
};

const SPURTI_OPTIONS: { label: string; value: number }[] = [
  { label: '0 pts', value: 0 },
  { label: '+1 pt', value: 1 },
  { label: '+2 pts', value: 2 },
  { label: '−1 pt', value: -1 },
];

export function FlagInbox() {
  const { data: open } = useFlagList({ entityType: 'faq', status: 'open' });
  const { data: underReview } = useFlagList({ entityType: 'faq', status: 'under_review' });
  const update = useUpdateFlagStatus();
  const [spurtiMap, setSpurtiMap] = useState<Record<string, number>>({});

  const live = useMemo(() => [...(open ?? []), ...(underReview ?? [])], [open, underReview]);

  if (live.length === 0) return null;

  const getSpurti = (id: string) => spurtiMap[id] ?? 0;
  const setSpurti = (id: string, pts: number) => setSpurtiMap((m) => ({ ...m, [id]: pts }));

  return (
    <Card style={{ marginBottom: 12, borderColor: 'var(--color-warning)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--color-warning)',
          textTransform: 'uppercase',
          letterSpacing: '.5px',
          marginBottom: 10,
        }}
      >
        <Flag size={13} /> {live.length} open flag{live.length === 1 ? '' : 's'} on FAQs
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {live.map((f) => (
          <div
            key={f.id}
            style={{
              padding: 12,
              borderRadius: 8,
              background: 'var(--color-input)',
              border: '1px solid var(--color-border)',
            }}
          >
            {/* Flag details */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {f.entityTitle ?? '(deleted FAQ)'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>
                {REASON_COPY[f.reason]} · by {f.reportedBy.name} · {timeAgo(f.createdAt)}
              </div>
              {f.details && (
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text)',
                    marginTop: 6,
                    fontStyle: 'italic',
                  }}
                >
                  "{f.details}"
                </div>
              )}
            </div>

            {/* Spurti points reward row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 10,
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  color: '#7c3aed',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <Sparkles size={11} /> Spurti reward for {f.reportedBy.name}:
              </span>
              {SPURTI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSpurti(f.id, opt.value)}
                  style={{
                    fontSize: 11,
                    padding: '3px 10px',
                    borderRadius: 12,
                    border: `1px solid ${getSpurti(f.id) === opt.value ? '#7c3aed' : 'var(--color-border)'}`,
                    background: getSpurti(f.id) === opt.value ? '#7c3aed22' : 'var(--color-card)',
                    color: getSpurti(f.id) === opt.value ? '#7c3aed' : 'var(--color-text-muted)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontWeight: 600,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              <Button
                size="sm"
                variant="success"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: f.id,
                    input: {
                      status: 'resolved',
                      resolutionNote: 'Marked resolved by moderator.',
                      spurtiPoints: getSpurti(f.id),
                    },
                  })
                }
              >
                <Check size={12} /> Resolve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({
                    id: f.id,
                    input: {
                      status: 'dismissed',
                      resolutionNote: 'Dismissed by moderator.',
                      spurtiPoints: getSpurti(f.id),
                    },
                  })
                }
              >
                <X size={12} /> Dismiss
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
