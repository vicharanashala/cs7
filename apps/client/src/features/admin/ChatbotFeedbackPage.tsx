import { useState, type ReactNode } from 'react';
import { useExclusiveOpen } from '../../hooks/useExclusiveOpen';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Bot,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import type { ApiSuccess, ChatbotFeedbackStats, PublicChatFeedback } from '@samagama/shared';
import { hasAdminAccess } from '@samagama/shared';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../auth/AuthProvider';

type Filter = 'all' | 'helpful' | 'unhelpful' | 'archived';

export function ChatbotFeedbackPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const qc = useQueryClient();

  const stats = useQuery<ChatbotFeedbackStats>({
    queryKey: ['chatbot', 'feedback', 'stats'],
    queryFn: async () => {
      const res = await apiClient.get<ApiSuccess<ChatbotFeedbackStats>>('/api/chat/feedback/stats');
      return res.data.data;
    },
  });

  const list = useQuery<PublicChatFeedback[]>({
    queryKey: ['chatbot', 'feedback', filter],
    queryFn: async () => {
      const res = await apiClient.get<ApiSuccess<PublicChatFeedback[]>>('/api/chat/feedback', {
        params: { filter },
      });
      return res.data.data;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['chatbot', 'feedback'] });
  };

  const v = (n: number | undefined) => (stats.isLoading ? '…' : (n ?? 0));

  const FILTER_LABELS: Record<Filter, string> = {
    all: 'All',
    helpful: 'Helpful',
    unhelpful: 'Unhelpful',
    archived: 'Archived',
  };
  const FILTER_COLORS: Record<Filter, string> = {
    all: 'var(--color-primary)',
    helpful: 'var(--color-success)',
    unhelpful: 'var(--color-danger)',
    archived: 'var(--color-text-muted)',
  };

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
          <Bot size={18} color="var(--color-primary)" />
        </div>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Chatbot Feedback
        </span>
      </div>

      {/* Stats row (active feedback only — archived excluded) */}
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}
      >
        <div
          className="mod-card mod-card-blue"
          style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--color-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <MessageSquare size={22} color="var(--color-primary)" />
          </div>
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: 'var(--color-text)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              {v(stats.data?.total)}
            </div>
            <div
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginTop: 3 }}
            >
              Total Feedback
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--color-primary)', fontWeight: 600, marginTop: 2 }}
            >
              Active only
            </div>
          </div>
        </div>

        <div
          className="mod-card mod-card-green"
          style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--color-success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ThumbsUp size={22} color="var(--color-success)" />
          </div>
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: 'var(--color-text)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              {v(stats.data?.helpful)}
            </div>
            <div
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginTop: 3 }}
            >
              Helpful
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--color-success)', fontWeight: 600, marginTop: 2 }}
            >
              Positive feedback
            </div>
          </div>
        </div>

        <div
          className="mod-card mod-card-red"
          style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14 }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--color-danger-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ThumbsDown size={22} color="var(--color-danger)" />
          </div>
          <div>
            <div
              style={{
                fontSize: 32,
                fontWeight: 900,
                color: 'var(--color-text)',
                letterSpacing: '-0.04em',
                lineHeight: 1,
              }}
            >
              {v(stats.data?.unhelpful)}
            </div>
            <div
              style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', marginTop: 3 }}
            >
              Unhelpful
            </div>
            <div
              style={{ fontSize: 11, color: 'var(--color-danger)', fontWeight: 600, marginTop: 2 }}
            >
              Negative feedback
            </div>
          </div>
        </div>
      </div>

      {/* Filter + list card */}
      <div className="mod-card mod-card-blue">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 20px 0',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--color-primary-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={17} color="var(--color-primary)" />
            </div>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--color-text)',
                letterSpacing: '-0.01em',
              }}
            >
              {filter === 'archived' ? 'Archived Feedback' : 'Chat Sessions'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['all', 'helpful', 'unhelpful', 'archived'] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '6px 14px',
                  borderRadius: 20,
                  cursor: 'pointer',
                  border: `1.5px solid ${filter === f ? FILTER_COLORS[f] : 'var(--color-border)'}`,
                  background: filter === f ? FILTER_COLORS[f] : 'var(--color-card)',
                  color: filter === f ? 'white' : 'var(--color-text-muted)',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {FILTER_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '14px 20px 20px' }}>
          {list.isLoading && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '16px 0' }}>
              Loading…
            </div>
          )}

          {!list.isLoading && (list.data?.length ?? 0) === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'var(--color-primary-bg)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                }}
              >
                {filter === 'archived' ? (
                  <Archive size={24} color="var(--color-primary)" />
                ) : (
                  <Bot size={24} color="var(--color-primary)" />
                )}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                {filter === 'archived' ? 'No archived feedback' : 'No chat feedback yet'}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  maxWidth: 320,
                  margin: '0 auto',
                }}
              >
                {filter === 'archived'
                  ? 'Reviewed feedback that has been archived will appear here.'
                  : 'Once students use Yaksha, conversations and feedback will appear here.'}
              </div>
            </div>
          )}

          {list.data && list.data.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {list.data.map((row) => (
                <FeedbackRow key={row.id} row={row} onMutate={invalidate} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_META: Record<
  PublicChatFeedback['status'],
  { label: string; color: string; bg: string }
> = {
  open: { label: 'New', color: 'var(--color-warning,#f59e0b)', bg: 'rgba(245,158,11,0.12)' },
  reviewed: { label: 'Reviewed', color: 'var(--color-primary)', bg: 'var(--color-primary-bg)' },
  actioned: { label: 'Actioned', color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  archived: { label: 'Archived', color: 'var(--color-text-muted)', bg: 'var(--color-input)' },
};

function StatusBadge({ status }: { status: PublicChatFeedback['status'] }) {
  const m = STATUS_META[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 20,
        color: m.color,
        background: m.bg,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {m.label}
    </span>
  );
}

// ─── Feedback row ─────────────────────────────────────────────────────────────

function FeedbackRow({ row, onMutate }: { row: PublicChatFeedback; onMutate: () => void }) {
  const { isOpen: expanded, toggle: toggleExpanded } = useExclusiveOpen(`chatfb-${row.id}`);
  const { user: viewer } = useAuth();
  const isAdmin = !!viewer && hasAdminAccess(viewer.role);
  const isHelpful = row.rating === 'helpful';
  const color = isHelpful ? 'var(--color-success)' : 'var(--color-danger)';
  const hasFullHistory = row.messages && row.messages.length > 0;

  const statusMutation = useMutation({
    mutationFn: async (status: 'reviewed' | 'actioned' | 'archived') => {
      await apiClient.patch(`/api/chat/feedback/${row.id}`, { status });
    },
    onSuccess: onMutate,
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/api/chat/feedback/${row.id}`);
    },
    onSuccess: onMutate,
  });

  function handleDelete() {
    if (!window.confirm('Permanently delete this feedback? This cannot be undone.')) return;
    deleteMutation.mutate();
  }

  const isBusy = statusMutation.isPending || deleteMutation.isPending;

  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 14,
        border: `1px solid var(--color-border)`,
        overflow: 'hidden',
        opacity: isBusy ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      {/* Header */}
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {/* Rating icon */}
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: isHelpful ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {isHelpful ? (
              <ThumbsUp size={15} color="var(--color-success)" />
            ) : (
              <ThumbsDown size={15} color="var(--color-danger)" />
            )}
          </div>

          {/* Meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {row.rating}
              </span>
              <StatusBadge status={row.status} />
              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                by {row.user.name} · {timeAgo(row.createdAt)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {row.status === 'open' && (
              <ActionBtn
                label="Mark Reviewed"
                color="var(--color-primary)"
                onClick={() => statusMutation.mutate('reviewed')}
                disabled={isBusy}
              />
            )}
            {row.status === 'reviewed' && (
              <ActionBtn
                label="Mark Actioned"
                color="var(--color-success)"
                onClick={() => statusMutation.mutate('actioned')}
                disabled={isBusy}
              />
            )}
            {(row.status === 'reviewed' || row.status === 'actioned') && (
              <ActionBtn
                label="Archive"
                color="var(--color-text-muted)"
                icon={<Archive size={12} />}
                onClick={() => statusMutation.mutate('archived')}
                disabled={isBusy}
              />
            )}
            {isAdmin && (
              <button
                onClick={handleDelete}
                disabled={isBusy}
                title="Delete permanently"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                  background: 'transparent',
                  color: 'var(--color-danger)',
                  flexShrink: 0,
                  fontFamily: 'inherit',
                }}
              >
                <Trash2 size={13} />
              </button>
            )}

            {/* View conversation toggle */}
            <button
              onClick={toggleExpanded}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 12,
                fontWeight: 600,
                padding: '5px 12px',
                borderRadius: 8,
                background: expanded ? 'var(--color-primary)' : 'var(--color-input)',
                color: expanded ? 'white' : 'var(--color-text-muted)',
                border: `1px solid ${expanded ? 'var(--color-primary)' : 'var(--color-border)'}`,
                cursor: 'pointer',
                fontFamily: 'inherit',
                flexShrink: 0,
              }}
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {expanded ? 'Hide' : hasFullHistory ? 'View Chat' : 'View Response'}
            </button>
          </div>
        </div>

        {/* Rated query (always visible) */}
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 6 }}>
          {row.query}
        </div>
        <div
          style={{
            fontSize: 13,
            background: 'var(--color-input)',
            padding: '10px 14px',
            borderRadius: 10,
            borderLeft: `3px solid ${color}`,
            color: 'var(--color-text)',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.6,
          }}
        >
          {row.answer}
        </div>
        {row.comment && (
          <div
            style={{
              marginTop: 8,
              fontSize: 12,
              fontStyle: 'italic',
              color: 'var(--color-text-muted)',
            }}
          >
            "{row.comment}"
          </div>
        )}
      </div>

      {/* Full conversation thread */}
      {expanded && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            background: 'var(--color-bg)',
            padding: '16px 16px',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
              marginBottom: 12,
            }}
          >
            {hasFullHistory ? 'Full Conversation' : 'Rated Exchange'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hasFullHistory ? (
              row.messages!.map((msg, i) => (
                <ChatBubble key={i} msg={msg} isRated={i === row.messages!.length - 1} />
              ))
            ) : (
              <>
                <ChatBubble msg={{ role: 'user', content: row.query }} isRated={false} />
                <ChatBubble msg={{ role: 'assistant', content: row.answer }} isRated={true} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small action button ──────────────────────────────────────────────────────

function ActionBtn({
  label,
  color,
  icon,
  onClick,
  disabled,
}: {
  label: string;
  color: string;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 700,
        padding: '5px 10px',
        borderRadius: 8,
        cursor: 'pointer',
        border: `1.5px solid ${color}`,
        background: 'transparent',
        color,
        fontFamily: 'inherit',
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Chat bubble ──────────────────────────────────────────────────────────────

function ChatBubble({
  msg,
  isRated,
}: {
  msg: { role: 'user' | 'assistant'; content: string };
  isRated: boolean;
}) {
  const isUser = msg.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        gap: 8,
        alignItems: 'flex-start',
      }}
    >
      {!isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
          }}
        >
          <Bot size={14} color="white" />
        </div>
      )}
      <div
        style={{
          maxWidth: '75%',
          padding: '10px 14px',
          borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
          background: isUser ? 'var(--color-primary)' : 'var(--color-card)',
          color: isUser ? 'white' : 'var(--color-text)',
          border: isUser
            ? 'none'
            : `1px solid ${isRated ? 'var(--color-primary)' : 'var(--color-border)'}`,
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          boxShadow: isRated ? '0 0 0 2px var(--color-primary-bg)' : 'none',
        }}
      >
        {msg.content}
      </div>
      {isUser && (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--color-input)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginTop: 2,
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
          }}
        >
          S
        </div>
      )}
    </div>
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
