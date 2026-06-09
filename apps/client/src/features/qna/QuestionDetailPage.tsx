import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Clock,
  Folder,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StaffIdentity } from '../../components/ui/StaffIdentity';
import { useAuth } from '../auth/AuthProvider';
import { useSettings } from '../../hooks/useSettings';
import { useAnswers, useQuestion, useSubmitAnswer, useVoteAnswer } from './queries';

// ── Avatar palette — CSS variable references adapt to dark/light mode automatically ─
const AVATAR_PALETTE = [
  { bg: 'var(--avatar-purple-bg)', fg: 'var(--avatar-purple-fg)' },
  { bg: 'var(--avatar-green-bg)',  fg: 'var(--avatar-green-fg)'  },
  { bg: 'var(--avatar-amber-bg)',  fg: 'var(--avatar-amber-fg)'  },
  { bg: 'var(--avatar-blue-bg)',   fg: 'var(--avatar-blue-fg)'   },
  { bg: 'var(--avatar-red-bg)',    fg: 'var(--avatar-red-fg)'    },
  { bg: 'var(--avatar-pink-bg)',   fg: 'var(--avatar-pink-fg)'   },
  { bg: 'var(--avatar-sky-bg)',    fg: 'var(--avatar-sky-fg)'    },
];
function avatarColor(name: string) {
  const idx = ((name.charCodeAt(0) ?? 0) + (name.charCodeAt(1) ?? 0)) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}hr${hr === 1 ? '' : 's'} ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── Status config — CSS variable references adapt to dark/light mode automatically ─
const STATUS_CFG: Record<
  string,
  { label: string; bg: string; fg: string; border: string; accent: string }
> = {
  open: {
    label: 'Open',
    bg: 'var(--color-primary-bg)',
    fg: 'var(--color-primary)',
    border: 'color-mix(in srgb, var(--color-primary) 35%, transparent)',
    accent: 'var(--color-primary)',
  },
  answered: {
    label: 'Answered',
    bg: 'var(--color-warning-bg)',
    fg: 'var(--color-warning)',
    border: 'color-mix(in srgb, var(--color-warning) 35%, transparent)',
    accent: 'var(--color-warning)',
  },
  resolved: {
    label: 'Resolved',
    bg: 'var(--color-success-bg)',
    fg: 'var(--color-success)',
    border: 'color-mix(in srgb, var(--color-success) 35%, transparent)',
    accent: 'var(--color-success)',
  },
};
function getStatus(s: string) {
  return (
    STATUS_CFG[s] ?? {
      label: capitalize(s),
      bg: 'var(--color-pill)',
      fg: 'var(--color-text-muted)',
      border: 'var(--color-border)',
      accent: 'var(--color-border)',
    }
  );
}

// ── QuestionDetailPage ─────────────────────────────────────────────────────────
export function QuestionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: question, isLoading: qLoading } = useQuestion(id);
  const { data: answers, isLoading: aLoading } = useAnswers(id);
  const { data: settings } = useSettings();

  const [showAnswerForm, setShowAnswerForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoom, setZoom] = useState(1);

  const totalAnswers = answers?.length ?? 0;

  // Sort by net vote score (highest first) — reflects persisted MongoDB counts.
  const sortedAnswers = [...(answers ?? [])].sort(
    (a, b) => b.upvoteCount - b.downvoteCount - (a.upvoteCount - a.downvoteCount),
  );
  // Default view: top 3; expanded view: all.
  const displayedAnswers = showAll ? sortedAnswers : sortedAnswers.slice(0, 3);
  const hasMore = totalAnswers > 3;

  const answerCap = settings?.communityAnswerCap ?? 10;
  const capReached = totalAnswers >= answerCap;
  const alreadyAnswered = answers?.some((a) => a.author.id === user?.id) ?? false;

  if (qLoading)
    return (
      <div
        className="mod-card mod-card-blue"
        style={{ padding: 20, fontSize: 13, color: 'var(--color-text-muted)' }}
      >
        Loading…
      </div>
    );
  if (!question)
    return (
      <div className="mod-card mod-card-red" style={{ padding: 20 }}>
        Question not found.
      </div>
    );

  const isOwnQuestion = user?.id === question.author.id;
  const sc = getStatus(question.status);
  const qAvatarColor = avatarColor(question.author.name);

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* ── Back ── */}
      <button
        onClick={() => (window.history.length > 2 ? navigate(-1) : navigate('/community'))}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          fontSize: 13,
          fontWeight: 500,
          padding: '4px 0',
          marginBottom: 24,
          fontFamily: 'inherit',
          transition: 'color 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
        }}
      >
        <ChevronLeft size={15} />
        Back to Community
      </button>

      {/* ── Question card ── */}
      <div
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderLeft: `4px solid ${sc.accent}`,
          borderRadius: 14,
          padding: '24px 28px',
          marginBottom: 28,
        }}
      >
        {/* Status + Category chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              padding: '3px 10px',
              borderRadius: 20,
              background: sc.bg,
              color: sc.fg,
              border: `1px solid ${sc.border}`,
            }}
          >
            {sc.label}
          </span>
          {question.category && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: 20,
                background: 'var(--color-input, #F3F4F6)',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              <Folder size={11} />
              {question.category.name}
            </span>
          )}
        </div>

        {/* Question text */}
        <p
          style={{
            fontSize: 15,
            fontWeight: 600,
            lineHeight: 1.75,
            color: 'var(--color-text)',
            whiteSpace: 'pre-wrap',
            margin: '0 0 18px',
          }}
        >
          {question.description}
        </p>

        {/* Screenshot thumbnail */}
        {question.screenshotUrl && (
          <div style={{ marginBottom: 18 }}>
            <ImageThumbnail
              src={question.screenshotUrl}
              onClick={() => {
                setZoom(1);
                setLightboxOpen(true);
              }}
            />
          </div>
        )}

        {/* Card footer: author + answer count */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingTop: 16,
            borderTop: '1px solid var(--color-border)',
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              flexShrink: 0,
              background: qAvatarColor.bg,
              color: qAvatarColor.fg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {question.author.name.charAt(0).toUpperCase()}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Asked by{' '}
            <strong style={{ color: 'var(--color-text)', fontWeight: 600 }}>
              {question.author.name}
            </strong>
            <span style={{ margin: '0 6px' }}>·</span>
            {formatDate(question.createdAt)}
          </div>
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 12,
              color: 'var(--color-text-muted)',
            }}
          >
            <MessageSquare size={13} />
            {totalAnswers} {totalAnswers === 1 ? 'answer' : 'answers'}
          </div>
        </div>
      </div>

      {/* ── Lightbox ── */}
      {lightboxOpen && question.screenshotUrl && (
        <ImageLightbox
          src={question.screenshotUrl}
          zoom={zoom}
          onZoomIn={() => setZoom((z) => Math.min(+(z + 0.25).toFixed(2), 3))}
          onZoomOut={() => setZoom((z) => Math.max(+(z - 0.25).toFixed(2), 0.25))}
          onClose={() => {
            setLightboxOpen(false);
            setZoom(1);
          }}
        />
      )}

      {/* ── Answers ── */}
      {question.type === 'personal' ? (
        <PersonalAnswerSection
          answers={answers ?? []}
          isLoading={aLoading}
          questionId={question.id}
          userId={user?.id}
        />
      ) : (
        <>
          {/* Section header */}
          {!aLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  whiteSpace: 'nowrap',
                }}
              >
                {totalAnswers === 0
                  ? 'No answers yet'
                  : `${totalAnswers} Answer${totalAnswers === 1 ? '' : 's'}`}
              </span>
              <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
            </div>
          )}

          {aLoading && (
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '12px 0' }}>
              Loading answers…
            </div>
          )}

          {/* Answer cards (top 3 or all, sorted by net votes) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {displayedAnswers.map((a) => (
              <AnswerCard
                key={a.id}
                answer={a}
                questionId={question.id}
                canVote={!!user?.id && user.id !== a.author.id}
                voteMutationKey={question.id}
              />
            ))}
          </div>

          {/* Show All / Show Less toggle */}
          {!aLoading && hasMore && (
            <button
              onClick={() => setShowAll((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                width: '100%',
                marginTop: 10,
                padding: '10px 0',
                background: 'none',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--color-primary)',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'var(--color-primary)';
                el.style.color = '#fff';
                el.style.borderColor = 'var(--color-primary)';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement;
                el.style.background = 'none';
                el.style.color = 'var(--color-primary)';
                el.style.borderColor = 'var(--color-border)';
              }}
            >
              {showAll ? (
                <>
                  <ChevronUp size={14} />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={14} />
                  Show All {totalAnswers} Answers
                </>
              )}
            </button>
          )}

          {/* ── Submit answer ── */}
          {!isOwnQuestion && question.status !== 'resolved' && question.status !== 'archived' && (
            <div style={{ marginTop: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Your Answer
                </span>
                <div style={{ flex: 1, height: 1, background: 'var(--color-border)' }} />
              </div>

              {alreadyAnswered ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '14px 18px',
                    borderRadius: 12,
                    background: 'var(--color-success-bg, #f0fdf4)',
                    border: '1px solid var(--color-success)',
                    fontSize: 13,
                    color: 'var(--color-success)',
                    fontWeight: 600,
                  }}
                >
                  <Clock size={15} />
                  Your answer is submitted and is pending moderator review.
                </div>
              ) : capReached ? (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 12,
                    background: 'var(--color-input, #F9FAFB)',
                    border: '1px solid var(--color-border)',
                    fontSize: 13,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  This question has reached the maximum of {answerCap} answers.
                </div>
              ) : !showAnswerForm ? (
                <button
                  onClick={() => setShowAnswerForm(true)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 22px',
                    borderRadius: 10,
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'white',
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '0.88';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.opacity = '1';
                  }}
                >
                  <MessageSquare size={15} />
                  Write an Answer
                </button>
              ) : (
                <AnswerForm
                  questionId={question.id}
                  showConfirmation={totalAnswers > 0}
                  onClose={() => setShowAnswerForm(false)}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── PersonalAnswerSection ──────────────────────────────────────────────────────
function PersonalAnswerSection({
  answers,
  isLoading,
  questionId,
  userId,
}: {
  answers: import('@samagama/shared').PublicAnswer[];
  isLoading: boolean;
  questionId: string;
  userId: string | undefined;
}) {
  const approved = answers.filter((a) => a.status === 'approved');
  if (isLoading)
    return (
      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '12px 0' }}>
        Loading response…
      </div>
    );
  if (approved.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          padding: '18px 20px',
          borderRadius: 12,
          background: 'var(--color-input, #F9FAFB)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)',
          fontSize: 13,
          lineHeight: 1.6,
        }}
      >
        <Clock size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        Personal questions are answered directly by moderators. A response will appear here once a
        moderator replies.
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {approved.map((a) => (
        <AnswerCard
          key={a.id}
          answer={a}
          questionId={questionId}
          canVote={!!userId && userId !== a.author.id}
          voteMutationKey={questionId}
        />
      ))}
    </div>
  );
}

// ── AnswerCard ─────────────────────────────────────────────────────────────────
function AnswerCard({
  answer,
  questionId: _qId,
  canVote,
  voteMutationKey,
}: {
  answer: import('@samagama/shared').PublicAnswer;
  questionId: string;
  canVote: boolean;
  voteMutationKey: string;
}) {
  const vote = useVoteAnswer(voteMutationKey);
  const isApproved = answer.status === 'approved';

  function castVote(direction: 'up' | 'down') {
    if (!vote.isPending) vote.mutate({ answerId: answer.id, direction });
  }

  const upActive = answer.myVote === 'up';
  const downActive = answer.myVote === 'down';

  return (
    <div
      style={
        {
          background: isApproved ? 'rgba(5,150,105,0.02)' : 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderLeft: `3px solid ${isApproved ? 'var(--color-success)' : 'var(--color-border)'}`,
          borderRadius: 12,
          padding: '18px 22px',
        } as React.CSSProperties
      }
    >
      {/* Answer body */}
      <p
        style={{
          fontSize: 14,
          lineHeight: 1.8,
          color: 'var(--color-text)',
          whiteSpace: 'pre-wrap',
          margin: '0 0 14px',
        }}
      >
        {answer.body}
      </p>

      {/* Footer: identity · votes · timestamp */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 8,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
          fontSize: 13,
        }}
      >
        <StaffIdentity name={answer.author.name} role={answer.author.role} avatarSize={26} />

        {/* Approved indicator inline */}
        {isApproved && <CheckCircle2 size={14} color="var(--color-success)" style={{ flexShrink: 0 }} />}

        {/* Votes — clickable if canVote, read-only otherwise */}
        <VoteControl
          direction="up"
          count={answer.upvoteCount}
          active={upActive}
          canVote={canVote}
          isPending={vote.isPending}
          onVote={() => castVote('up')}
        />
        <VoteControl
          direction="down"
          count={answer.downvoteCount}
          active={downActive}
          canVote={canVote}
          isPending={vote.isPending}
          onVote={() => castVote('down')}
        />

        {/* Timestamp — pushed to the right */}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-muted)' }}>
          {timeAgo(answer.createdAt)}
        </span>
      </div>
    </div>
  );
}

// ── VoteControl ────────────────────────────────────────────────────────────────
function VoteControl({
  direction,
  count,
  active,
  canVote,
  isPending,
  onVote,
}: {
  direction: 'up' | 'down';
  count: number;
  active: boolean;
  canVote: boolean;
  isPending: boolean;
  onVote: () => void;
}) {
  const isUp = direction === 'up';
  const activeColor = isUp ? 'var(--color-success)' : 'var(--color-danger)';
  const Icon = isUp ? ThumbsUp : ThumbsDown;

  if (!canVote) {
    // Read-only display
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: active ? activeColor : 'var(--color-text-muted)',
        }}
      >
        <Icon size={13} strokeWidth={active ? 2.5 : 1.8} fill={active ? activeColor : 'none'} />
        {count}
      </span>
    );
  }

  return (
    <button
      onClick={onVote}
      disabled={isPending}
      title={isUp ? 'Upvote' : 'Downvote'}
      aria-label={`${isUp ? 'Upvote' : 'Downvote'} — ${count} vote${count === 1 ? '' : 's'}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'none',
        border: 'none',
        cursor: isPending ? 'default' : 'pointer',
        padding: 0,
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        color: active ? activeColor : 'var(--color-text-muted)',
        transition: 'color 0.15s, opacity 0.15s',
        opacity: isPending ? 0.45 : 1,
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = activeColor;
      }}
      onMouseLeave={(e) => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
      }}
    >
      <Icon size={13} strokeWidth={active ? 2.5 : 1.8} fill={active ? activeColor : 'none'} />
      {count}
    </button>
  );
}

// ── AnswerForm ─────────────────────────────────────────────────────────────────
function AnswerForm({
  questionId,
  showConfirmation,
  onClose,
}: {
  questionId: string;
  showConfirmation: boolean;
  onClose: () => void;
}) {
  const [confirmed, setConfirmed] = useState(!showConfirmation);
  const [assumeCorrect, setAssumeCorrect] = useState(false);
  const submit = useSubmitAnswer(questionId);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (body.trim().length < 10) {
      setError('Please write at least 10 characters.');
      return;
    }
    if (!assumeCorrect) {
      setError('Please confirm your answer is correct.');
      return;
    }
    setError(null);
    await submit.mutateAsync({ body });
    setBody('');
    onClose();
  };

  return (
    <div
      style={{
        background: 'var(--color-card)',
        border: '1px solid var(--color-border)',
        borderTop: '3px solid var(--color-primary)',
        borderRadius: 12,
        padding: '20px 22px',
      }}
    >
      {showConfirmation && !confirmed ? (
        <div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text)',
              margin: '0 0 14px',
            }}
          >
            Existing answers may already help. Are you sure you'd like to add a new one?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" size="sm" onClick={onClose}>
              No, existing are fine
            </Button>
            <Button size="sm" onClick={() => setConfirmed(true)}>
              Yes, I'll add one
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Share what worked for you. Be specific and include official sources where possible."
            style={{
              width: '100%',
              background: 'var(--color-input)',
              border: `1.5px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
              borderRadius: 8,
              padding: '10px 14px',
              color: 'var(--color-text)',
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              resize: 'vertical',
              boxSizing: 'border-box',
              lineHeight: 1.7,
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => {
              if (!error)
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--color-primary)';
            }}
            onBlur={(e) => {
              if (!error)
                (e.currentTarget as HTMLTextAreaElement).style.borderColor = 'var(--color-border)';
            }}
          />

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 10,
              fontSize: 12,
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={assumeCorrect}
              onChange={(e) => setAssumeCorrect(e.target.checked)}
              style={{ accentColor: 'var(--color-success)', width: 14, height: 14 }}
            />
            I believe my answer is correct and helpful.
          </label>

          {error && (
            <div
              role="alert"
              style={{ marginTop: 8, fontSize: 12, color: 'var(--color-danger)', fontWeight: 500 }}
            >
              {error}
            </div>
          )}
          {submit.isError && (
            <div
              role="alert"
              style={{
                marginTop: 8,
                padding: '8px 12px',
                background: 'var(--color-danger-bg)',
                color: 'var(--color-danger)',
                borderRadius: 8,
                fontSize: 12,
              }}
            >
              {submit.error instanceof Error
                ? submit.error.message
                : 'Could not submit — please try again.'}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 14,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              Visible immediately · reviewed by a moderator
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={submit.isPending || !assumeCorrect || body.trim().length < 10}
              >
                {submit.isPending ? 'Submitting…' : 'Submit Answer'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ImageThumbnail ─────────────────────────────────────────────────────────────
function ImageThumbnail({ src, onClick }: { src: string; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-block',
        cursor: 'zoom-in',
        borderRadius: 10,
        overflow: 'hidden',
        border: '1.5px solid var(--color-border)',
        boxShadow: hovered ? '0 4px 16px rgba(0,0,0,0.14)' : '0 1px 4px rgba(0,0,0,0.07)',
        transition: 'box-shadow 0.15s',
      }}
    >
      <img
        src={src}
        alt="Question attachment"
        style={{
          display: 'block',
          width: 'auto',
          height: 110,
          maxWidth: 180,
          objectFit: 'cover',
          transition: 'opacity 0.15s',
          opacity: hovered ? 0.85 : 1,
        }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).closest('div')!.style.display = 'none';
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.28)',
          opacity: hovered ? 1 : 0,
          transition: 'opacity 0.15s',
          pointerEvents: 'none',
        }}
      >
        <ZoomIn size={22} color="white" />
      </div>
    </div>
  );
}

// ── ImageLightbox ──────────────────────────────────────────────────────────────
function ImageLightbox({
  src,
  zoom,
  onZoomIn,
  onZoomOut,
  onClose,
}: {
  src: string;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onClose: () => void;
}) {
  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 38,
    height: 38,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.25)',
    color: 'white',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
    transition: 'background 0.15s',
  };
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 18,
          right: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 9001,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.7)',
            minWidth: 36,
            textAlign: 'center',
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          style={btnStyle}
          title="Zoom out (−)"
          onClick={onZoomOut}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.28)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
          }}
        >
          <ZoomOut size={17} />
        </button>
        <button
          style={btnStyle}
          title="Zoom in (+)"
          onClick={onZoomIn}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.28)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)';
          }}
        >
          <ZoomIn size={17} />
        </button>
        <button
          style={{
            ...btnStyle,
            background: 'rgba(220,38,38,0.5)',
            border: '1px solid rgba(220,38,38,0.6)',
          }}
          title="Close (Esc)"
          onClick={onClose}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.75)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.5)';
          }}
        >
          <X size={17} />
        </button>
      </div>
      <div
        style={{
          overflow: 'auto',
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={src}
          alt="Attachment preview"
          draggable={false}
          style={{
            display: 'block',
            maxWidth: '85vw',
            maxHeight: '85vh',
            borderRadius: 12,
            boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}
