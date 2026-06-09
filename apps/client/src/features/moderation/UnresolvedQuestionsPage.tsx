// Unresolved Questions — three-tab layout: Personal · Community · Trash.
// Each tab has its own search bar + inline filter/sort controls.
import { useMemo, useState } from 'react';
import { useExclusiveOpen } from '../../hooks/useExclusiveOpen';
import {
  BookOpen,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit,
  Filter,
  Folder,
  MessageCircle,
  RotateCcw,
  Search,
  SortAsc,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { StaffIdentity } from '../../components/ui/StaffIdentity';
import {
  useAnswers,
  useApproveAnswer,
  useConvertAnswerToFaq,
  usePendingAnswers,
  useQuestions,
  useRejectAnswer,
  useRespondToPersonal,
  useRestoreQuestion,
  useTrash,
} from '../qna/queries';
import type { PendingAnswerSummary, TrashedQuestionRow } from '../qna/api';
import type { PublicAnswer, PublicQuestion } from '@samagama/shared';

type Section = 'personal' | 'community' | 'trash';
type PersonalStatus = 'all' | 'open' | 'resolved';
type CommunityStatus = 'all' | 'open' | 'answered' | 'resolved';
type SortBy = 'multi' | 'today' | 'week' | 'all';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rankAnswers(answers: PublicAnswer[]): PublicAnswer[] {
  return [...answers].sort((a, b) => {
    if (b.upvoteCount !== a.upvoteCount) return b.upvoteCount - a.upvoteCount;
    if (a.downvoteCount !== b.downvoteCount) return a.downvoteCount - b.downvoteCount;
    return 0;
  });
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

function Pipe() {
  return (
    <span style={{ margin: '0 7px', color: 'var(--color-border)', userSelect: 'none' }}>|</span>
  );
}

const dropdownStyle: React.CSSProperties = {
  height: 34,
  padding: '0 10px',
  background: 'var(--color-input)',
  border: '1.5px solid var(--color-border)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--color-text)',
  fontFamily: 'inherit',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'auto',
};

// ─── Tab search bar ────────────────────────────────────────────────────────────

function TabSearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="topbar-search" style={{ flex: '1 1 200px', minWidth: 0 }}>
      <Search
        size={15}
        color={value ? 'var(--color-primary)' : 'var(--color-text-muted)'}
        style={{ flexShrink: 0 }}
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search questions by title or keyword…"
        style={{
          border: 'none',
          background: 'none',
          outline: 'none',
          color: 'var(--color-text)',
          fontSize: 14,
          flex: 1,
          fontFamily: 'inherit',
          minWidth: 0,
        }}
      />
      {value && (
        <button
          onClick={() => onChange('')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: 0,
            color: 'var(--color-text-muted)',
          }}
        >
          <RotateCcw size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function UnresolvedQuestionsPage() {
  const [section, setSection] = useState<Section>('community');

  // Per-tab search states
  const [personalSearch, setPersonalSearch] = useState('');
  const [communitySearch, setCommunitySearch] = useState('');
  const [trashSearch, setTrashSearch] = useState('');

  // Personal filters
  const [personalStatus, setPersonalStatus] = useState<PersonalStatus>('all');

  // Community filters
  const [communityStatus, setCommunityStatus] = useState<CommunityStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('multi');

  // Eagerly load all sections so chip counts are always visible.
  const { data: personalQ, isLoading: pQL } = useQuestions({ type: 'personal' });
  const { data: communityQ, isLoading: cQL } = useQuestions({
    type: 'community',
    status: 'open,answered',
  });
  const { data: resolvedQ, isLoading: rQL } = useQuestions({
    type: 'community',
    status: 'resolved',
  });
  const { data: trashItems, isLoading: tL } = useTrash();
  const { data: pendingAnswers, isLoading: paL } = usePendingAnswers();

  // Group pending answers by questionId.
  const pendingByQuestion = useMemo(() => {
    const map = new Map<string, PendingAnswerSummary[]>();
    (pendingAnswers ?? []).forEach((a) => {
      const list = map.get(a.questionId) ?? [];
      list.push(a);
      map.set(a.questionId, list);
    });
    return map;
  }, [pendingAnswers]);

  // Active-section loading gate.
  const isLoading = section === 'personal' ? pQL : section === 'community' ? cQL || rQL || paL : tL;

  const pq = personalSearch.toLowerCase().trim();
  const cq = communitySearch.toLowerCase().trim();
  const tq = trashSearch.toLowerCase().trim();

  // ── Personal: status + search ──────────────────────────────────────────────
  const filteredPersonal = useMemo(() => {
    if (!personalQ) return [];
    let list = personalQ;
    if (pq)
      list = list.filter(
        (x) => x.title.toLowerCase().includes(pq) || x.description.toLowerCase().includes(pq),
      );
    if (personalStatus !== 'all') list = list.filter((x) => x.status === personalStatus);
    return list;
  }, [personalQ, pq, personalStatus]);

  // ── Community: status + sort + search (includes resolved) ─────────────────
  const filteredCommunity = useMemo(() => {
    let base: PublicQuestion[];
    if (communityStatus === 'resolved') {
      base = resolvedQ ?? [];
    } else if (communityStatus === 'all') {
      base = [...(communityQ ?? []), ...(resolvedQ ?? [])];
    } else {
      base = (communityQ ?? []).filter((x) => x.status === communityStatus);
    }
    if (cq)
      base = base.filter(
        (x) => x.title.toLowerCase().includes(cq) || x.description.toLowerCase().includes(cq),
      );

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    if (sortBy === 'today') base = base.filter((x) => new Date(x.createdAt).getTime() >= now - day);
    else if (sortBy === 'week')
      base = base.filter((x) => new Date(x.createdAt).getTime() >= now - 7 * day);

    return [...base].sort((a, b) => {
      if (sortBy === 'multi') {
        const aT = pendingByQuestion.get(a.id)?.[0]?.taggedStudents.length ?? 0;
        const bT = pendingByQuestion.get(b.id)?.[0]?.taggedStudents.length ?? 0;
        if (aT !== bT) return bT - aT;
        const aP = pendingByQuestion.has(a.id) ? 1 : 0;
        const bP = pendingByQuestion.has(b.id) ? 1 : 0;
        if (aP !== bP) return bP - aP;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [communityQ, resolvedQ, cq, communityStatus, sortBy, pendingByQuestion]);

  // ── Trash: search ──────────────────────────────────────────────────────────
  const filteredTrash = useMemo(() => {
    if (!trashItems) return [];
    if (!tq) return trashItems;
    return trashItems.filter(
      (x) => x.title.toLowerCase().includes(tq) || x.description.toLowerCase().includes(tq),
    );
  }, [trashItems, tq]);

  const pendingCount = pendingAnswers?.length ?? 0;
  const currentCount =
    section === 'personal'
      ? filteredPersonal.length
      : section === 'community'
        ? filteredCommunity.length
        : filteredTrash.length;

  const TABS: Array<{
    key: Section;
    label: string;
    count: number | undefined;
    Icon: typeof MessageCircle;
  }> = [
    { key: 'personal', label: 'Personal', count: personalQ?.length, Icon: User },
    {
      key: 'community',
      label: 'Community',
      count: (communityQ?.length ?? 0) + (resolvedQ?.length ?? 0) || undefined,
      Icon: Users,
    },
    { key: 'trash', label: 'Trash', count: trashItems?.length, Icon: Trash2 },
  ];

  return (
    <div>
      {/* ── Heading ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            flexShrink: 0,
            background: 'var(--color-card)',
            boxShadow: '0 2px 8px rgba(59,130,246,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MessageCircle size={18} color="var(--color-primary)" />
        </div>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Unresolved Questions
          {!isLoading && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                marginLeft: 8,
              }}
            >
              {currentCount} question{currentCount === 1 ? '' : 's'}
              {section === 'community' && pendingCount > 0 && (
                <>
                  {' '}
                  ·{' '}
                  <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>
                    {pendingCount} pending review
                  </span>
                </>
              )}
            </span>
          )}
        </span>
      </div>

      {/* ── Tab navigation row ── */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 18,
          padding: 4,
          background: 'var(--color-input)',
          border: '1.5px solid var(--color-border)',
          borderRadius: 12,
          width: 'fit-content',
        }}
      >
        {TABS.map(({ key, label, count, Icon }) => {
          const active = section === key;
          return (
            <button
              key={key}
              onClick={() => setSection(key)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 36,
                padding: '0 18px',
                borderRadius: 9,
                flexShrink: 0,
                border: 'none',
                background: active ? 'var(--color-card)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
                boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={14} />
              {label}
              {count !== undefined && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: '18px',
                    background: active ? 'var(--color-primary)' : 'var(--color-border)',
                    color: active ? 'white' : 'var(--color-text-muted)',
                    borderRadius: 10,
                    padding: '0 6px',
                    minWidth: 18,
                    textAlign: 'center',
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading && (
        <div
          className="mod-card mod-card-blue"
          style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}
        >
          Loading questions…
        </div>
      )}

      {/* ── Personal ── */}
      {!isLoading && section === 'personal' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              padding: '10px 14px',
              marginBottom: 12,
              background: 'var(--color-card)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 10,
            }}
          >
            <TabSearchBar value={personalSearch} onChange={setPersonalSearch} />
            <div
              style={{ width: 1, height: 20, background: 'var(--color-border)', flexShrink: 0 }}
            />
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 13,
                color: 'var(--color-text-muted)',
                flexShrink: 0,
              }}
            >
              Status
              <select
                value={personalStatus}
                onChange={(e) => setPersonalStatus(e.target.value as PersonalStatus)}
                style={dropdownStyle}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
          </div>
          {filteredPersonal.length === 0 ? (
            <EmptyState
              Icon={User}
              message={
                personalSearch
                  ? `No personal questions matched "${personalSearch}"`
                  : personalStatus !== 'all'
                    ? `No ${personalStatus} personal questions.`
                    : 'No personal questions at the moment.'
              }
              sub={
                personalSearch
                  ? 'Try a different keyword.'
                  : personalStatus !== 'all'
                    ? 'Try changing the status filter.'
                    : 'Direct messages from students appear here.'
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredPersonal.map((q) => (
                <PersonalCard key={q.id} question={q} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Community ── */}
      {!isLoading && section === 'community' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              padding: '10px 14px',
              marginBottom: 12,
              background: 'var(--color-card)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 10,
            }}
          >
            <TabSearchBar value={communitySearch} onChange={setCommunitySearch} />
            <div
              style={{ width: 1, height: 20, background: 'var(--color-border)', flexShrink: 0 }}
            />
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 13,
                color: 'var(--color-text-muted)',
                flexShrink: 0,
              }}
            >
              Status
              <select
                value={communityStatus}
                onChange={(e) => setCommunityStatus(e.target.value as CommunityStatus)}
                style={dropdownStyle}
              >
                <option value="all">All</option>
                <option value="open">Open</option>
                <option value="answered">Answered by Peers</option>
                <option value="resolved">Resolved</option>
              </select>
            </label>
            <div
              style={{ width: 1, height: 20, background: 'var(--color-border)', flexShrink: 0 }}
            />
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                fontSize: 13,
                color: 'var(--color-text-muted)',
                flexShrink: 0,
              }}
            >
              <SortAsc size={14} /> Sort By
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                style={dropdownStyle}
              >
                <option value="multi">Multiple Students Query First</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="all">All Time</option>
              </select>
            </label>
            {(communityStatus !== 'all' || sortBy !== 'multi') && (
              <button
                type="button"
                onClick={() => {
                  setCommunityStatus('all');
                  setSortBy('multi');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 12,
                  color: 'var(--color-text-muted)',
                  background: 'none',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  padding: '4px 10px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  marginLeft: 'auto',
                  flexShrink: 0,
                }}
              >
                <RotateCcw size={11} /> Reset
              </button>
            )}
          </div>
          {filteredCommunity.length === 0 ? (
            <EmptyState
              Icon={Users}
              message={
                communitySearch
                  ? `No community questions matched "${communitySearch}"`
                  : sortBy === 'today'
                    ? 'No community questions posted today.'
                    : sortBy === 'week'
                      ? 'No community questions posted this week.'
                      : communityStatus !== 'all'
                        ? `No ${communityStatus === 'answered' ? 'peer-answered' : communityStatus} community questions.`
                        : 'No community questions need attention.'
              }
              sub={
                communitySearch
                  ? 'Try a different keyword.'
                  : sortBy === 'today' || sortBy === 'week'
                    ? 'Try "All Time" in Sort By.'
                    : communityStatus !== 'all'
                      ? 'Try changing the status filter.'
                      : 'Open and answered questions from students appear here.'
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredCommunity.map((q) =>
                q.status === 'resolved' ? (
                  <ResolvedCard key={q.id} question={q} />
                ) : (
                  <CommunityCard
                    key={q.id}
                    question={q}
                    pendingAnswers={pendingByQuestion.get(q.id) ?? []}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Trash ── */}
      {!isLoading && section === 'trash' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              padding: '10px 14px',
              marginBottom: 12,
              background: 'var(--color-card)',
              border: '1.5px solid var(--color-border)',
              borderRadius: 10,
            }}
          >
            <TabSearchBar value={trashSearch} onChange={setTrashSearch} />
          </div>
          {filteredTrash.length === 0 ? (
            <EmptyState
              Icon={Trash2}
              message={
                trashSearch ? `No trashed questions matched "${trashSearch}"` : 'Trash is empty.'
              }
              sub={
                trashSearch
                  ? 'Try a different keyword.'
                  : 'Expired community posts appear here and can be restored.'
              }
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredTrash.map((q) => (
                <TrashCard key={q.id} question={q} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Shared header row helpers ────────────────────────────────────────────────

function CardHeader({
  title,
  meta,
  expanded,
  onToggle,
  extra,
}: {
  title: React.ReactNode;
  meta: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div style={{ padding: '13px 18px 11px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
        <button
          onClick={onToggle}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 'none',
            padding: 0,
            textAlign: 'left',
            cursor: 'pointer',
            color: 'inherit',
            font: 'inherit',
          }}
        >
          <span
            style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.45 }}
          >
            {title}
          </span>
        </button>
        {extra}
        <button
          onClick={onToggle}
          style={{
            flexShrink: 0,
            background: 'transparent',
            border: 'none',
            borderRadius: 8,
            padding: '4px 6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            transition: 'background 0.13s',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-input)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {expanded ? (
            <ChevronUp size={15} color="var(--color-text-muted)" />
          ) : (
            <ChevronDown size={15} color="var(--color-text-muted)" />
          )}
        </button>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: 12,
          color: 'var(--color-text-muted)',
        }}
      >
        {meta}
      </div>
    </div>
  );
}

function CardBody({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div style={{ borderTop: '1px solid var(--color-border)', margin: '0 18px' }} />
      <div style={{ padding: '14px 18px' }}>{children}</div>
    </div>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
      <span
        style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }}
      />
      <span style={{ color, fontWeight: 600, textTransform: 'capitalize' as const }}>{label}</span>
    </span>
  );
}

// ─── Personal card ────────────────────────────────────────────────────────────

function PersonalCard({ question }: { question: PublicQuestion }) {
  const { isOpen: expanded, toggle: setExpandedToggle } = useExclusiveOpen(`mod-personal-${question.id}`);
  const [body, setBody] = useState('');
  const respond = useRespondToPersonal();

  // Load answers whenever the card is open so the response is visible immediately.
  const { data: answers, isLoading: aLoading } = useAnswers(expanded ? question.id : undefined);

  const isResolved = question.status === 'resolved';

  const submit = async () => {
    if (body.trim().length < 10) return;
    await respond.mutateAsync({ questionId: question.id, body });
    setBody('');
    // Stay expanded — the invalidated query will refetch and render the response.
  };

  const statusColor = isResolved
    ? '#16a34a'
    : question.status === 'answered'
      ? '#d97706'
      : '#3b82f6';

  const meta = (
    <>
      {question.category && (
        <>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--color-primary)',
              fontWeight: 600,
              maxWidth: 110,
            }}
          >
            <Folder size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {question.category.name}
            </span>
          </span>
          <Pipe />
        </>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
        <User size={12} /> {question.author.name}
      </span>
      <Pipe />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
        <Clock size={12} /> {timeAgo(question.createdAt)}
      </span>
      <Pipe />
      <StatusDot color={statusColor} label={question.status} />
    </>
  );

  return (
    <div className={isResolved ? 'mod-card mod-card-green' : 'mod-card mod-card-blue'}>
      <CardHeader
        title={
          question.description.length > 200
            ? question.description.slice(0, 197) + '…'
            : question.description
        }
        meta={meta}
        expanded={expanded}
        onToggle={setExpandedToggle}
      />
      {expanded && (
        <CardBody>
          {/* Question body — only shown when description was truncated in the header */}
          {question.description.length > 200 && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text)',
                lineHeight: 1.65,
                marginBottom: 14,
                whiteSpace: 'pre-wrap',
              }}
            >
              {question.description}
            </div>
          )}
          {question.screenshotUrl && (
            <div style={{ marginBottom: 14 }}>
              <img
                src={question.screenshotUrl}
                alt="Question attachment"
                style={{
                  maxWidth: '100%',
                  maxHeight: 280,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  objectFit: 'contain',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Existing moderator response(s) */}
          {aLoading && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Loading response…
            </div>
          )}
          {!aLoading && answers && answers.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {answers.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      background: 'var(--color-success-bg)',
                      border: '1px solid var(--color-success)',
                      borderLeft: '3px solid var(--color-success)',
                      borderRadius: 8,
                      padding: '9px 12px',
                    }}
                  >
                    <div style={{ marginBottom: 6 }}>
                      <StaffIdentity name={a.author.name} role={a.author.role} timestamp={a.createdAt} avatarSize={22} />
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--color-text)',
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                        paddingLeft: 28,
                      }}
                    >
                      {a.body}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resolved notice — no further input needed */}
          {/* Compose area — only for open questions */}
          {!isResolved && (
            <>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your response. The student will see it under My Questions as 'Responded'."
                rows={4}
                maxLength={4000}
                style={{
                  width: '100%',
                  background: 'var(--color-input)',
                  border: '1px solid var(--color-primary)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 13,
                  fontFamily: 'inherit',
                  color: 'var(--color-text)',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
              {respond.error && (
                <div
                  role="alert"
                  style={{ marginTop: 4, fontSize: 12, color: 'var(--color-danger)' }}
                >
                  {respond.error instanceof Error
                    ? respond.error.message
                    : 'Could not submit response'}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setExpandedToggle();
                    setBody('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submit}
                  disabled={respond.isPending || body.trim().length < 10}
                >
                  {respond.isPending ? 'Sending…' : 'Send response'}
                </Button>
              </div>
            </>
          )}
        </CardBody>
      )}
    </div>
  );
}

// ─── Community card ───────────────────────────────────────────────────────────

function CommunityCard({
  question,
  pendingAnswers,
}: {
  question: PublicQuestion;
  pendingAnswers: PendingAnswerSummary[];
}) {
  const { isOpen: expanded, toggle: setExpandedToggle } = useExclusiveOpen(`mod-community-${question.id}`);
  const [showModAnswer, setShowModAnswer] = useState(false);
  const [modBody, setModBody] = useState('');
  const [showStudents, setShowStudents] = useState(false);

  const hasPending = pendingAnswers.length > 0;
  const taggedStudents = pendingAnswers[0]?.taggedStudents ?? [];
  const multiAsker = taggedStudents.length > 0;
  const respond = useRespondToPersonal();

  // Load approved answers whenever the card is open so any prior mod response is visible.
  const { data: existingAnswers, isLoading: aLoading } = useAnswers(expanded ? question.id : undefined);
  const approvedAnswers = (existingAnswers ?? []).filter((a) => a.status === 'approved');

  const submitModAnswer = async () => {
    if (modBody.trim().length < 10) return;
    await respond.mutateAsync({ questionId: question.id, body: modBody });
    setModBody('');
    setShowModAnswer(false);
  };

  const cardClass = hasPending ? 'mod-card mod-card-orange' : 'mod-card mod-card-blue';

  const meta = (
    <>
      {multiAsker && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowStudents((v) => !v);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              color: 'var(--color-primary)',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              padding: 0,
            }}
          >
            <Users size={11} /> {taggedStudents.length + 1} students
          </button>
          <Pipe />
        </>
      )}
      {question.category && (
        <>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--color-primary)',
              fontWeight: 600,
              maxWidth: 100,
            }}
          >
            <Folder size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {question.category.name}
            </span>
          </span>
          <Pipe />
        </>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
        <User size={12} /> {question.author.name}
      </span>
      <Pipe />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
        <Clock size={12} /> {timeAgo(question.createdAt)}
      </span>
      <Pipe />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
        <MessageCircle size={11} /> {question.answerCount} answer
        {question.answerCount === 1 ? '' : 's'}
      </span>
    </>
  );

  return (
    <div className={cardClass}>
      <CardHeader
        title={
          question.description.length > 200
            ? question.description.slice(0, 197) + '…'
            : question.description
        }
        meta={meta}
        expanded={expanded}
        onToggle={setExpandedToggle}
      />
      {expanded && (
        <CardBody>
          {showStudents && taggedStudents.length > 0 && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
                marginBottom: 10,
                padding: '6px 10px',
                background: 'var(--color-input)',
                borderRadius: 6,
                border: '1px solid var(--color-border)',
              }}
            >
              Also asked by: {taggedStudents.map((s) => s.name).join(', ')}
            </div>
          )}
          {question.description.length > 200 && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text)',
                lineHeight: 1.65,
                marginBottom: 14,
                whiteSpace: 'pre-wrap',
              }}
            >
              {question.description}
            </div>
          )}
          {question.screenshotUrl && (
            <div style={{ marginBottom: 14 }}>
              <img
                src={question.screenshotUrl}
                alt="Question attachment"
                style={{
                  maxWidth: '100%',
                  maxHeight: 280,
                  borderRadius: 8,
                  border: '1px solid var(--color-border)',
                  objectFit: 'contain',
                  display: 'block',
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          )}
          {/* Approved moderator answers — shown after posting */}
          {aLoading && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
              Loading responses…
            </div>
          )}
          {!aLoading && approvedAnswers.length > 0 && (
            <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {approvedAnswers.map((a) => (
                <div
                  key={a.id}
                  style={{
                    background: 'var(--color-success-bg)',
                    border: '1px solid var(--color-success)',
                    borderLeft: '3px solid var(--color-success)',
                    borderRadius: 8,
                    padding: '9px 12px',
                  }}
                >
                  <div style={{ marginBottom: 6 }}>
                    <StaffIdentity name={a.author.name} role={a.author.role} timestamp={a.createdAt} avatarSize={22} />
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text)',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      paddingLeft: 28,
                    }}
                  >
                    {a.body}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasPending && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--color-text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 8,
                }}
              >
                Pending answers — select &amp; review
              </div>
              <ReviewPanel answers={pendingAnswers} />
            </div>
          )}
          <div>
            {!showModAnswer ? (
              <button
                type="button"
                onClick={() => setShowModAnswer(true)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: '#16a34a',
                  background: 'none',
                  border: '1px solid #16a34a',
                  borderRadius: 6,
                  padding: '5px 14px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                + Answer as moderator
              </button>
            ) : (
              <div>
                <textarea
                  value={modBody}
                  onChange={(e) => setModBody(e.target.value)}
                  placeholder="Write your answer here. It will be approved immediately and visible to students."
                  rows={4}
                  maxLength={4000}
                  style={{
                    width: '100%',
                    background: 'var(--color-input)',
                    border: '1px solid #16a34a',
                    borderRadius: 8,
                    padding: '8px 12px',
                    fontSize: 13,
                    fontFamily: 'inherit',
                    color: 'var(--color-text)',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
                {respond.error && (
                  <div style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>
                    {respond.error instanceof Error
                      ? respond.error.message
                      : 'Could not post answer'}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-end' }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowModAnswer(false);
                      setModBody('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={submitModAnswer}
                    disabled={respond.isPending || modBody.trim().length < 10}
                  >
                    {respond.isPending ? 'Posting…' : 'Post answer'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      )}
    </div>
  );
}

// ─── Resolved card ────────────────────────────────────────────────────────────

function ResolvedCard({ question }: { question: PublicQuestion }) {
  const { isOpen: expanded, toggle: setExpandedToggle } = useExclusiveOpen(`mod-resolved-${question.id}`);
  const { data: rawAnswers, isLoading: aLoading } = useAnswers(expanded ? question.id : undefined);
  const convertToFaq = useConvertAnswerToFaq();
  const [faqDismissed, setFaqDismissed] = useState<Set<string>>(new Set());

  const rankedAnswers = useMemo(() => {
    if (!rawAnswers) return [];
    return rankAnswers(rawAnswers.filter((a) => a.status === 'approved'));
  }, [rawAnswers]);

  const meta = (
    <>
      {question.category && (
        <>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--color-primary)',
              fontWeight: 600,
              maxWidth: 110,
            }}
          >
            <Folder size={12} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {question.category.name}
            </span>
          </span>
          <Pipe />
        </>
      )}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
        <User size={12} /> {question.author.name}
      </span>
      <Pipe />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
        <Clock size={12} /> {timeAgo(question.createdAt)}
      </span>
      <Pipe />
      <StatusDot color="#16a34a" label="Resolved" />
      <Pipe />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
        <MessageCircle size={11} /> {question.answerCount} answer
        {question.answerCount === 1 ? '' : 's'}
      </span>
    </>
  );

  return (
    <div className="mod-card mod-card-green">
      <CardHeader
        title={
          question.description.length > 200
            ? question.description.slice(0, 197) + '…'
            : question.description
        }
        meta={meta}
        expanded={expanded}
        onToggle={setExpandedToggle}
      />
      {expanded && (
        <CardBody>
          {question.description.length > 200 && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text)',
                lineHeight: 1.65,
                marginBottom: 14,
                whiteSpace: 'pre-wrap',
              }}
            >
              {question.description}
            </div>
          )}
          {aLoading && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Loading answers…</div>
          )}
          {!aLoading && rankedAnswers.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              No approved answers.
            </div>
          )}
          {rankedAnswers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rankedAnswers.map((a, i) => (
                <div key={a.id}>
                  <RankedAnswerRow answer={a} rank={i + 1} />
                  {!a.isFaqConverted && !faqDismissed.has(a.id) && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginTop: 6,
                        padding: '6px 10px',
                        background: 'var(--color-card)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 8,
                      }}
                    >
                      <BookOpen size={13} color="var(--color-primary)" style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--color-text)', flex: 1 }}>
                        Promote this answer to the FAQ repository for all students to find.
                      </span>
                      {convertToFaq.error && (
                        <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>
                          {convertToFaq.error instanceof Error
                            ? convertToFaq.error.message
                            : 'Could not convert'}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="success"
                        disabled={convertToFaq.isPending}
                        onClick={async () => {
                          await convertToFaq.mutateAsync(a.id);
                          setFaqDismissed((s) => new Set(s).add(a.id));
                        }}
                      >
                        <BookOpen size={12} /> {convertToFaq.isPending ? 'Adding…' : 'Mark as FAQ'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setFaqDismissed((s) => new Set(s).add(a.id))}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                  {(a.isFaqConverted || faqDismissed.has(a.id)) && a.isFaqConverted && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        marginTop: 5,
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--color-success)',
                        background: 'var(--color-success-bg)',
                        border: '1px solid var(--color-success)',
                        borderRadius: 6,
                        padding: '3px 8px',
                      }}
                    >
                      <BookOpen size={11} /> Added to FAQ
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      )}
    </div>
  );
}

// ─── Trash card ───────────────────────────────────────────────────────────────

function TrashCard({ question }: { question: TrashedQuestionRow }) {
  const { isOpen: expanded, toggle: setExpandedToggle } = useExclusiveOpen(`mod-trash-${question.id}`);
  const restore = useRestoreQuestion();

  const meta = (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
        <User size={12} /> {question.author.name}
      </span>
      <Pipe />
      <StatusDot color="#dc2626" label={`Trashed ${timeAgo(question.trashedAt)}`} />
      {question.visibilityExpiresAt && (
        <>
          <Pipe />
          <span style={{ whiteSpace: 'nowrap' }}>
            Expired {timeAgo(question.visibilityExpiresAt)}
          </span>
        </>
      )}
      <Pipe />
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap' }}>
        <MessageCircle size={11} /> {question.answerCount}
      </span>
    </>
  );

  const restoreBtn = (
    <Button
      size="sm"
      variant="success"
      disabled={restore.isPending}
      onClick={(e) => {
        (e as React.MouseEvent).stopPropagation();
        restore.mutate(question.id);
      }}
      style={{ flexShrink: 0 }}
    >
      Restore
    </Button>
  );

  return (
    <div className="mod-card mod-card-red" style={{ opacity: 0.92 }}>
      <CardHeader
        title={
          question.description.length > 200
            ? question.description.slice(0, 197) + '…'
            : question.description
        }
        meta={meta}
        expanded={expanded}
        onToggle={setExpandedToggle}
        extra={restoreBtn}
      />
      {expanded && (
        <CardBody>
          {question.description.length > 200 && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text)',
                lineHeight: 1.65,
                marginBottom: 14,
              }}
            >
              {question.description}
            </div>
          )}
          {question.answers.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              No answers recorded.
            </div>
          )}
          {question.answers.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {question.answers.map((a, i) => (
                <div
                  key={a.id}
                  style={{
                    background: 'var(--color-input)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 8,
                    padding: '8px 12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'var(--color-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'white',
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
                      {a.author.name}
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        <ThumbsUp size={10} /> {a.upvoteCount}
                      </span>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        <ThumbsDown size={10} /> {a.downvoteCount}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--color-text)',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      paddingLeft: 26,
                    }}
                  >
                    {a.body}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  Icon,
  message,
  sub,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
  message: string;
  sub?: string;
}) {
  return (
    <div className="mod-card mod-card-blue" style={{ padding: 40, textAlign: 'center' }}>
      <Icon size={36} color="var(--color-border)" style={{ marginBottom: 12 }} />
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{message}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{sub}</div>}
    </div>
  );
}

// ─── Ranked answer row ────────────────────────────────────────────────────────

function RankedAnswerRow({ answer, rank }: { answer: PublicAnswer; rank: number }) {
  const isTop = rank === 1;
  return (
    <div
      style={{
        background: isTop ? 'var(--color-success-bg)' : 'var(--color-input)',
        border: `1px solid ${isTop ? 'var(--color-success)' : 'var(--color-border)'}`,
        borderLeft: `3px solid ${isTop ? 'var(--color-success)' : 'var(--color-border)'}`,
        borderRadius: 8,
        padding: '9px 12px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            flexShrink: 0,
            background: isTop ? 'var(--color-success)' : 'var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 10,
            fontWeight: 800,
            color: isTop ? 'white' : 'var(--color-text-muted)',
          }}
        >
          {rank}
        </div>
        <StaffIdentity name={answer.author.name} role={answer.author.role} timestamp={answer.createdAt} avatarSize={22} />
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-success)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <CheckCircle2 size={12} /> Approved
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              color: answer.upvoteCount > 0 ? 'var(--color-success)' : 'var(--color-text-muted)',
            }}
          >
            <ThumbsUp size={11} /> {answer.upvoteCount}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 11,
              color: answer.downvoteCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
            }}
          >
            <ThumbsDown size={11} /> {answer.downvoteCount}
          </span>
        </div>
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-text)',
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          paddingLeft: 26,
        }}
      >
        {answer.body}
      </div>
    </div>
  );
}

// ─── Review panel ─────────────────────────────────────────────────────────────

function ReviewPanel({ answers }: { answers: PendingAnswerSummary[] }) {
  const approve = useApproveAnswer();
  const reject = useRejectAnswer();
  const convertToFaq = useConvertAnswerToFaq();
  const [selectedId, setSelectedId] = useState<string>(answers[0]?.id ?? '');
  const [editing, setEditing] = useState(false);
  const [editedBody, setEditedBody] = useState('');
  const [spurtiPoints, setSpurtiPoints] = useState(5);
  const [visibilityDays, setVisibilityDays] = useState<7 | 3 | 2 | null>(7);
  const [showSecond, setShowSecond] = useState(false);
  const [showRest, setShowRest] = useState(false);
  const [justApproved, setJustApproved] = useState<{ id: string } | null>(null);

  const selected = answers.find((a) => a.id === selectedId) ?? answers[0] ?? null;

  const handleSelect = (id: string) => {
    if (id === selectedId) return;
    setSelectedId(id);
    setEditing(false);
    setEditedBody('');
  };
  const startEditing = () => {
    setEditedBody(selected?.body ?? '');
    setEditing(true);
  };
  const cancelEditing = () => {
    setEditing(false);
    setEditedBody('');
  };

  if (!selected) return null;

  const firstGroup = answers.slice(0, 1);
  const secondGroup = answers.slice(1, 3);
  const restGroup = answers.slice(3);

  const renderRow = (a: PendingAnswerSummary) => {
    const isSelected = a.id === selected.id;
    return (
      <button
        key={a.id}
        type="button"
        onClick={() => handleSelect(a.id)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: isSelected ? 'var(--color-primary-bg)' : 'var(--color-input)',
          border: `1.5px solid ${isSelected ? 'var(--color-primary)' : 'var(--color-border)'}`,
          borderRadius: 8,
          padding: '9px 12px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          transition: 'border-color 0.12s, background 0.12s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <StaffIdentity name={a.author.name} role={a.author.role} timestamp={a.createdAt} avatarSize={22} />
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                color: a.upvoteCount > 0 ? 'var(--color-success)' : 'var(--color-text-muted)',
              }}
            >
              <ThumbsUp size={11} /> {a.upvoteCount}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                fontSize: 11,
                color: a.downvoteCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
              }}
            >
              <ThumbsDown size={11} /> {a.downvoteCount}
            </span>
            {isSelected && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--color-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                Selected
              </span>
            )}
          </div>
        </div>
        {isSelected && editing ? (
          <textarea
            value={editedBody}
            onChange={(e) => setEditedBody(e.target.value)}
            rows={4}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              background: 'var(--color-card)',
              border: '1px solid var(--color-primary)',
              borderRadius: 6,
              padding: '7px 10px',
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
              fontSize: 13,
              color: 'var(--color-text)',
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
            }}
          >
            {a.body}
          </div>
        )}
      </button>
    );
  };

  return (
    <div>
      {justApproved && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success)',
            borderRadius: 8,
            padding: '9px 12px',
            marginBottom: 10,
          }}
        >
          <CheckCircle size={14} color="var(--color-success)" style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: 'var(--color-text)', flex: 1 }}>
            Answer approved — post it as an FAQ so it's searchable by all students?
          </span>
          {convertToFaq.error && (
            <span style={{ fontSize: 11, color: 'var(--color-danger)' }}>
              {convertToFaq.error instanceof Error
                ? convertToFaq.error.message
                : 'Could not post as FAQ'}
            </span>
          )}
          <Button
            size="sm"
            variant="success"
            disabled={convertToFaq.isPending}
            onClick={async () => {
              await convertToFaq.mutateAsync(justApproved.id);
              setJustApproved(null);
            }}
          >
            <BookOpen size={12} /> {convertToFaq.isPending ? 'Posting…' : 'Post as FAQ'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setJustApproved(null)}>
            Dismiss
          </Button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {firstGroup.map(renderRow)}
        {secondGroup.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowSecond((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: '2px 4px',
                color: 'var(--color-text-muted)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {showSecond ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {showSecond
                ? 'Hide'
                : `Show ${secondGroup.length} more answer${secondGroup.length === 1 ? '' : 's'}`}
            </button>
            {showSecond && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {secondGroup.map(renderRow)}
                {restGroup.length > 0 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowRest((v) => !v)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        padding: '2px 4px',
                        color: 'var(--color-text-muted)',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {showRest ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {showRest
                        ? 'Hide remaining'
                        : `Show ${restGroup.length} remaining answer${restGroup.length === 1 ? '' : 's'}`}
                    </button>
                    {showRest && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {restGroup.map(renderRow)}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
      <div
        style={{
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Spurti
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
                width: 48,
                background: 'var(--color-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: '4px 6px',
                fontSize: 12,
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                outline: 'none',
                textAlign: 'center',
              }}
            />
          </label>
          <label
            style={{
              fontSize: 11,
              color: 'var(--color-text-muted)',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            Visible
            <select
              value={visibilityDays === null ? 'permanent' : String(visibilityDays)}
              onChange={(e) => {
                const v = e.target.value;
                setVisibilityDays(v === 'permanent' ? null : (Number(v) as 2 | 3 | 7));
              }}
              style={{
                background: 'var(--color-input)',
                border: '1px solid var(--color-border)',
                borderRadius: 6,
                padding: '4px 6px',
                fontSize: 12,
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                outline: 'none',
              }}
            >
              <option value="7">7 days (default)</option>
              <option value="3">3 days</option>
              <option value="2">2 days</option>
              <option value="permanent">Permanent</option>
            </select>
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button
            variant="success"
            size="sm"
            disabled={approve.isPending}
            onClick={() => {
              const payload = editing
                ? { id: selected.id, editedBody, spurtiPoints, visibilityDays }
                : { id: selected.id, spurtiPoints, visibilityDays };
              approve.mutate(payload, { onSuccess: () => setJustApproved({ id: selected.id }) });
            }}
          >
            <CheckCircle size={12} /> {editing ? 'Edit & Approve' : 'Approve'}
          </Button>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={startEditing}>
              <Edit size={12} /> Edit
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={cancelEditing}>
              Cancel edit
            </Button>
          )}
          <Button
            variant="danger"
            size="sm"
            disabled={reject.isPending}
            onClick={() => reject.mutate({ id: selected.id })}
          >
            <XCircle size={12} /> Reject
          </Button>
        </div>
      </div>
    </div>
  );
}
