import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCheck, HelpCircle } from 'lucide-react';
import type { PublicQuestion } from '@samagama/shared';
import { Badge } from '../../components/ui/Badge';
import { useQuestions } from './queries';

type Tab = 'personal' | 'community';

export function MyQuestionsPage() {
  const [tab, setTab] = useState<Tab>('personal');
  const { data, isLoading } = useQuestions({ type: tab, mine: true });

  return (
    <div>
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--color-card)',
            boxShadow: '0 2px 8px rgba(124,58,237,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <HelpCircle size={18} color="var(--color-purple)" />
        </div>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          My Questions
        </span>
      </div>

      {/* Tabs */}
      <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['personal', 'community'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: '8px 20px',
              borderRadius: 10,
              border: `1.5px solid ${tab === t ? 'var(--color-purple)' : 'var(--color-border)'}`,
              background: tab === t ? 'var(--color-purple)' : 'var(--color-card)',
              color: tab === t ? 'white' : 'var(--color-text-muted)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textTransform: 'capitalize',
              transition: 'all 0.15s',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading && (
        <div
          className="mod-card mod-card-purple"
          style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}
        >
          Loading…
        </div>
      )}

      {!isLoading && (data?.length ?? 0) === 0 && (
        <div className="mod-card mod-card-purple" style={{ padding: 36, textAlign: 'center' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'var(--color-purple-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <HelpCircle size={24} color="var(--color-purple)" />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            No {tab} questions yet
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {tab === 'personal'
              ? 'Personal questions go directly to moderators.'
              : 'Community questions get peer answers — try asking one.'}
          </div>
        </div>
      )}

      {!isLoading && data && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map((q) => (
            <QuestionRow key={q.id} q={q} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionRow({ q }: { q: PublicQuestion }) {
  const navigate = useNavigate();
  const isPersonal = q.type === 'personal';
  const cardColor = isPersonal ? 'mod-card-purple' : 'mod-card-blue';

  return (
    <button
      onClick={() => navigate(`/community/${q.id}`)}
      style={{
        display: 'block',
        textAlign: 'left',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        width: '100%',
      }}
    >
      <div className={`mod-card ${cardColor}`} style={{ padding: '16px 18px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '3px 8px',
                  borderRadius: 6,
                  background: isPersonal ? 'var(--color-purple-bg)' : 'var(--color-primary-bg)',
                  color: isPersonal ? 'var(--color-purple)' : 'var(--color-primary)',
                }}
              >
                {q.type}
              </span>
              {q.category && <Badge color="accent">{q.category.name}</Badge>}
            </div>
            <div
              style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: 'var(--color-text)' }}
            >
              {q.description.length > 200 ? q.description.slice(0, 197) + '…' : q.description}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {timeAgo(q.createdAt)}
              {q.answerCount > 0 && ` · ${q.answerCount} answer${q.answerCount === 1 ? '' : 's'}`}
            </div>
          </div>
          <StatusTick q={q} />
        </div>
      </div>
    </button>
  );
}

function StatusTick({ q }: { q: PublicQuestion }) {
  if (q.type === 'personal') {
    if (q.displayState === 'responded')
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--color-success)',
            background: 'var(--color-success-bg)',
            borderRadius: 20,
            padding: '4px 10px',
            flexShrink: 0,
          }}
        >
          <CheckCheck size={13} /> Responded
        </span>
      );
    if (q.displayState === 'seen')
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--color-primary)',
            background: 'var(--color-primary-bg)',
            borderRadius: 20,
            padding: '4px 10px',
            flexShrink: 0,
          }}
        >
          <CheckCheck size={13} /> Seen
        </span>
      );
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          borderRadius: 20,
          padding: '4px 10px',
          flexShrink: 0,
          border: '1px solid var(--color-border)',
        }}
      >
        <Check size={13} /> Posted
      </span>
    );
  }
  const map: Record<string, 'accent' | 'warning' | 'success' | 'default'> = {
    open: 'accent',
    answered: 'warning',
    resolved: 'success',
    duplicate: 'default',
    archived: 'default',
  };
  return <Badge color={map[q.status] ?? 'default'}>{q.status}</Badge>;
}

function timeAgo(isoDate: string): string {
  const sec = Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
