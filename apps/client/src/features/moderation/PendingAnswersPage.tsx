// Pending answer review queue. Each row supports:
//  - Approve (as-is)
//  - Edit & approve (Change Spec §5.5 — moderator may modify body before approving)
//  - Reject (with optional note)
import { useState } from 'react';
import { CheckCircle, Edit, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { useApproveAnswer, usePendingAnswers, useRejectAnswer } from '../qna/queries';
import type { PendingAnswerSummary } from '../qna/api';

export function PendingAnswersPage() {
  const { data, isLoading } = usePendingAnswers();

  return (
    <div>
      <SectionHeader
        title="Pending Answers"
        sub={data ? `${data.length} item${data.length === 1 ? '' : 's'} awaiting review` : ''}
      />
      {isLoading && <Card>Loading…</Card>}
      {!isLoading && data && data.length === 0 && (
        <Card style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Inbox zero 🎉</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            No pending peer answers right now.
          </div>
        </Card>
      )}
      {!isLoading && data && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((a) => (
            <ReviewCard key={a.id} answer={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ answer }: { answer: PendingAnswerSummary }) {
  const approve = useApproveAnswer();
  const reject = useRejectAnswer();

  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState(answer.body);
  const [note, setNote] = useState('');
  const [spurtiPoints, setSpurtiPoints] = useState(5);

  return (
    <Card>
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
        Answer on:
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 10 }}>{answer.questionTitle}</div>

      {editing ? (
        <textarea
          value={editedBody}
          onChange={(e) => setEditedBody(e.target.value)}
          rows={6}
          style={{
            width: '100%',
            background: 'var(--color-input)',
            border: '1px solid var(--color-primary)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 10,
            fontSize: 13,
            color: 'var(--color-text)',
            fontFamily: 'inherit',
            resize: 'vertical',
            boxSizing: 'border-box',
            outline: 'none',
          }}
        />
      ) : (
        <div
          style={{
            background: 'var(--color-input)',
            border: '1px solid var(--color-border)',
            borderLeft: '3px solid var(--color-primary)',
            borderRadius: 8,
            padding: 12,
            marginBottom: 12,
            fontSize: 13,
            color: 'var(--color-text)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          {answer.body}
        </div>
      )}

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note (shown to author on rejection)"
        style={{
          width: '100%',
          background: 'var(--color-input)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '8px 12px',
          marginBottom: 10,
          fontSize: 12,
          color: 'var(--color-text)',
          fontFamily: 'inherit',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 10,
        }}
      >
        <label style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
          Spurti Points on approval:
        </label>
        <input
          type="number"
          min={-1}
          max={5}
          step={1}
          value={spurtiPoints}
          onChange={(e) =>
            setSpurtiPoints(Math.max(-1, Math.min(5, parseInt(e.target.value, 10) || 0)))
          }
          style={{
            width: 64,
            background: 'var(--color-input)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
            color: 'var(--color-text)',
            fontFamily: 'inherit',
            outline: 'none',
            textAlign: 'center',
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>(-1 to 5)</span>
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          by {answer.author.name} · {timeAgo(answer.createdAt)}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="success"
            size="sm"
            disabled={approve.isPending}
            onClick={() =>
              approve.mutate(
                editing
                  ? { id: answer.id, editedBody, note: note || undefined, spurtiPoints }
                  : { id: answer.id, note: note || undefined, spurtiPoints },
              )
            }
          >
            <CheckCircle size={13} /> {editing ? 'Edit & Approve' : 'Approve'}
          </Button>
          {!editing && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <Edit size={13} /> Edit
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            disabled={reject.isPending}
            onClick={() => reject.mutate({ id: answer.id, note: note || undefined })}
          >
            <XCircle size={13} /> Reject
          </Button>
        </div>
      </div>
    </Card>
  );
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
