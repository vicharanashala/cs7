import { useEffect, useMemo, useRef, useState } from 'react';
import { useExclusiveOpen } from '../../hooks/useExclusiveOpen';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock,
  Flame,
  Folder,
  MessageSquare,
  Search,
  User,
  Users,
} from 'lucide-react';
import type { QuestionStatus } from '@samagama/shared';
import { useCommunityIdleBuckets } from '../stats/queries';
import type { IdleBucket, IdleBuckets } from '../stats/api';
import { useQuestions } from './queries';

// ─── Design tokens (match spec exactly) ──────────────────────────────────────

const T = {
  purple:     'var(--color-primary)',
  purpleLight:'var(--color-primary-bg)',
  purpleHover:'var(--color-primary)',
  orange:     'var(--color-warning)',
  green:      'var(--color-success)',
  red:        'var(--color-danger)',
  gray:       'var(--color-text-muted)',
  dark:       'var(--color-text)',
  border:     'var(--color-border)',
  panelBg:    'var(--color-card)',
  rowHover:   'var(--color-input)',
  countBg:    'var(--color-pill)',
};

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusOption = 'All' | QuestionStatus;

interface PendingFilters {
  status: StatusOption;
  category: string; // 'All' | category id
  activity: string; // 'all' | 'last24h' | 'over3days' | 'over1week'
}

const DEFAULT_FILTERS: PendingFilters = { status: 'All', category: 'All', activity: 'all' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readIdleParam(raw: string | null): IdleBucket | null {
  if (raw === 'last24h' || raw === 'over3days' || raw === 'over1week') return raw;
  return null;
}

function activityToIdle(a: string): IdleBucket | null {
  if (a === 'last24h' || a === 'over3days' || a === 'over1week') return a;
  return null;
}

function idleToActivity(idle: IdleBucket | null): string {
  return idle ?? 'all';
}

function getStatusMeta(status: QuestionStatus): {
  icon: React.ReactNode;
  color: string;
  label: string;
} {
  switch (status) {
    case 'open':
      return { icon: <Circle size={13} />, color: T.purple, label: 'Open' };
    case 'answered':
      return { icon: <CheckCircle2 size={13} />, color: T.orange, label: 'Answered' };
    case 'resolved':
      return { icon: <CheckCircle2 size={13} />, color: T.green, label: 'Resolved' };
    default:
      return { icon: <Circle size={13} />, color: T.gray, label: status };
  }
}

function timeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}hr${hr === 1 ? '' : 's'} ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function questionText(title: string, description?: string): string {
  if (!description || !description.trim()) return title;
  if (description.trim().toLowerCase() === title.trim().toLowerCase()) return title;
  return description;
}

// ─── CommunityPage ────────────────────────────────────────────────────────────

export function CommunityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialActivity = idleToActivity(readIdleParam(searchParams.get('idle')));

  // pending = UI selections not yet applied
  const [pending, setPending] = useState<PendingFilters>({
    ...DEFAULT_FILTERS,
    activity: initialActivity,
  });
  // applied = what actually drives the query
  const [applied, setApplied] = useState<PendingFilters>({
    ...DEFAULT_FILTERS,
    activity: initialActivity,
  });

  // ── Search ───────────────────────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => clearTimeout(h);
  }, [searchInput]);

  // Sync ?idle= URL param whenever applied.activity changes
  useEffect(() => {
    const idle = activityToIdle(applied.activity);
    if (idle) {
      setSearchParams({ idle });
    } else {
      const p = new URLSearchParams(searchParams);
      p.delete('idle');
      setSearchParams(p);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applied.activity]);

  const { data: idle } = useCommunityIdleBuckets();

  // Unfiltered community questions — used ONLY to derive available categories.
  // When applied has no filters this shares the React Query cache with the main query.
  const { data: allQuestions } = useQuestions({ type: 'community' });

  // Unique categories across ALL community questions (no filter dependency)
  const activeCategories = useMemo(() => {
    if (!allQuestions) return [];
    const map = new Map<string, { id: string; name: string }>();
    for (const q of allQuestions) {
      if (q.category) map.set(q.category.id, { id: q.category.id, name: q.category.name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allQuestions]);

  // Build query params — omit undefined keys so React Query deduplicates
  // with the allQuestions query when no filters are active.
  const queryParams = useMemo(() => {
    const p: Parameters<typeof useQuestions>[0] = { type: 'community' };
    if (applied.status !== 'All') p.status = applied.status;
    const idle = activityToIdle(applied.activity);
    if (idle) p.idle = idle;
    return p;
  }, [applied.status, applied.activity]);

  const { data: rawData, isLoading, isError, refetch } = useQuestions(queryParams);

  // Category + text search are both filtered client-side.
  const data = useMemo(() => {
    if (!rawData) return [];
    let result =
      applied.category === 'All'
        ? rawData
        : rawData.filter((q) => q.category?.id === applied.category);
    if (debouncedSearch) {
      const lower = debouncedSearch.toLowerCase();
      result = result.filter(
        (q) =>
          q.title.toLowerCase().includes(lower) ||
          (q.description && q.description.toLowerCase().includes(lower)) ||
          q.category?.name.toLowerCase().includes(lower) ||
          q.author.name.toLowerCase().includes(lower),
      );
    }
    return result;
  }, [rawData, applied.category, debouncedSearch]);

  const handleApply = () => setApplied({ ...pending });
  const handleClear = () => {
    setPending(DEFAULT_FILTERS);
    setApplied(DEFAULT_FILTERS);
    setSearchInput('');
    setDebouncedSearch('');
  };

  const hasApplied =
    applied.status !== 'All' || applied.category !== 'All' || applied.activity !== 'all';
  const hasPendingChanges = JSON.stringify(pending) !== JSON.stringify(applied);

  return (
    <div>
      {/* ── Page heading ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--color-card)',
            boxShadow: '0 2px 8px rgba(16,185,129,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Users size={18} color="var(--color-success)" />
        </div>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Community Q&amp;A
          {!isLoading && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                marginLeft: 8,
              }}
            >
              {data.length} question{data.length === 1 ? '' : 's'}
              {debouncedSearch && ` for "${debouncedSearch}"`}
            </span>
          )}
        </span>
      </div>

      {/* ── Search + Filter bar (single row) ─────────────────────────── */}
      <FilterBar
        pending={pending}
        setPending={setPending}
        onApply={handleApply}
        activeCategories={activeCategories}
        idle={idle ?? null}
        hasPendingChanges={hasPendingChanges}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
      />

      {/* ── Active filter / search chips ────────────────────────────── */}
      {(hasApplied || debouncedSearch) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 14,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Active:</span>
          {debouncedSearch && <ActiveChip label={`"${debouncedSearch}"`} />}
          {applied.status !== 'All' && (
            <ActiveChip label={applied.status.charAt(0).toUpperCase() + applied.status.slice(1)} />
          )}
          {applied.category !== 'All' && (
            <ActiveChip
              label={activeCategories.find((c) => c.id === applied.category)?.name ?? 'Category'}
            />
          )}
          {applied.activity !== 'all' && (
            <ActiveChip
              label={
                applied.activity === 'last24h'
                  ? 'Active in 24h'
                  : applied.activity === 'over3days'
                    ? 'Idle > 3 days'
                    : 'Idle > 1 week'
              }
            />
          )}
          <button
            onClick={handleClear}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: T.gray,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px 6px',
              fontFamily: 'inherit',
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {isLoading && (
        <div
          className="mod-card mod-card-green"
          style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}
        >
          Loading questions…
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
      {isError && (
        <div className="mod-card mod-card-red" style={{ padding: 20 }}>
          <div style={{ color: 'var(--color-danger)', fontWeight: 700, marginBottom: 4 }}>
            Couldn't load questions.
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Check your connection and try again.
          </div>
          <button
            onClick={() => refetch()}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid var(--color-danger)',
              background: 'transparent',
              color: 'var(--color-danger)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Empty state ───────────────────────────────────────────────── */}
      {!isLoading && !isError && data.length === 0 && (
        <div className="mod-card mod-card-green" style={{ padding: 40, textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--color-success-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <MessageSquare size={26} color="var(--color-success)" />
          </div>
          {debouncedSearch ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                No questions found for &ldquo;{debouncedSearch}&rdquo;
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                Try a different keyword or clear the search.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                No questions match the selected filters
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                Try adjusting your filters or clearing them.
              </div>
            </>
          )}
          <button
            onClick={handleClear}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: '8px 20px',
              borderRadius: 10,
              border: 'none',
              background: T.purple,
              color: 'white',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {debouncedSearch ? 'Clear search' : 'Clear filters'}
          </button>
        </div>
      )}

      {/* ── Question list ─────────────────────────────────────────────── */}
      {!isLoading && !isError && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((q) => {
            const sm = getStatusMeta(q.status);
            return (
              <div
                key={q.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/community/${q.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/community/${q.id}`);
                  }
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = 'var(--shadow-md)';
                  el.style.borderColor = T.purple;
                  el.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = 'none';
                  el.style.borderColor = 'var(--color-border)';
                  el.style.transform = 'none';
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.outline = `2px solid ${T.purple}`;
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.outline = 'none';
                }}
                style={{
                  background: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '16px 20px',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.15s',
                  outline: 'none',
                  userSelect: 'none',
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1.5,
                    marginBottom: 12,
                    color: T.dark,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {questionText(q.title, q.description)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', rowGap: 4 }}>
                  {q.category && (
                    <>
                      <MetaChip icon={<Folder size={13} />} color={T.purple}>
                        {q.category.name}
                      </MetaChip>
                      <MetaPipe />
                    </>
                  )}
                  <MetaChip icon={sm.icon} color={sm.color}>
                    {sm.label}
                  </MetaChip>
                  <MetaPipe />
                  <MetaChip icon={<MessageSquare size={13} />} color={T.gray}>
                    {q.answerCount} response{q.answerCount === 1 ? '' : 's'}
                  </MetaChip>
                  <MetaPipe />
                  <MetaChip icon={<User size={13} />} color={T.gray}>
                    by {q.author.name}
                  </MetaChip>
                  <MetaPipe />
                  <MetaChip icon={<Clock size={13} />} color={T.gray}>
                    {timeAgo(q.updatedAt)}
                  </MetaChip>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  pending: PendingFilters;
  setPending: React.Dispatch<React.SetStateAction<PendingFilters>>;
  onApply: () => void;
  activeCategories: { id: string; name: string }[];
  idle: IdleBuckets | null;
  hasPendingChanges: boolean;
  searchInput: string;
  onSearchChange: (v: string) => void;
}

function FilterBar({
  pending,
  setPending,
  onApply,
  activeCategories,
  idle,
  hasPendingChanges,
  searchInput,
  onSearchChange,
}: FilterBarProps) {
  const statusOptions: SelectOption[] = [
    { value: 'All', label: 'All Status' },
    { value: 'open', label: 'Open', icon: <Circle size={13} />, color: T.purple },
    { value: 'answered', label: 'Answered', icon: <CheckCircle2 size={13} />, color: T.orange },
    { value: 'resolved', label: 'Resolved', icon: <CheckCircle2 size={13} />, color: T.green },
  ];

  const categoryOptions: SelectOption[] = [
    { value: 'All', label: 'All Categories' },
    ...activeCategories.map((c) => ({ value: c.id, label: c.name })),
  ];

  const activityOptions: SelectOption[] = [
    { value: 'all', label: 'All Activity' },
    {
      value: 'last24h',
      label: 'Active in 24h',
      icon: <Flame size={13} />,
      color: T.green,
      count: idle?.last24h,
    },
    {
      value: 'over3days',
      label: 'Idle > 3 days',
      icon: <Clock size={13} />,
      color: T.purple,
      count: idle?.over3days,
    },
    {
      value: 'over1week',
      label: 'Idle > 1 week',
      icon: <AlertTriangle size={13} />,
      color: T.red,
      count: idle?.over1week,
    },
  ];

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}
    >
      {/* Search — grows to fill available space */}
      <div className="topbar-search" style={{ flex: '1 1 200px', minWidth: 0 }}>
        <Search
          size={15}
          color={searchInput ? 'var(--color-primary)' : 'var(--color-text-muted)'}
          style={{ flexShrink: 0 }}
        />
        <input
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search questions…"
          aria-label="Search community questions"
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
      </div>

      {/* Filter dropdowns — no labels, placeholders carry the context */}
      <FilterSelect
        dropdownKey="community-status"
        value={pending.status}
        options={statusOptions}
        onChange={(v) => setPending((p) => ({ ...p, status: v as StatusOption }))}
        style={{ flex: '0 0 auto', width: 130 }}
      />

      <FilterSelect
        dropdownKey="community-category"
        value={pending.category}
        options={categoryOptions}
        onChange={(v) => setPending((p) => ({ ...p, category: v }))}
        style={{ flex: '0 0 auto', width: 150 }}
      />

      <FilterSelect
        dropdownKey="community-activity"
        value={pending.activity}
        options={activityOptions}
        onChange={(v) => setPending((p) => ({ ...p, activity: v }))}
        style={{ flex: '0 0 auto', width: 160 }}
      />

      {/* Apply */}
      <button
        onClick={onApply}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 36,
          padding: '0 16px',
          borderRadius: 8,
          border: `1.5px solid ${T.purple}`,
          background: T.purple,
          color: 'white',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          boxShadow: hasPendingChanges
            ? '0 2px 8px rgba(124,58,237,0.28)'
            : '0 1px 2px rgba(0,0,0,0.06)',
          transition: 'all 0.15s',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = T.purpleHover;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = T.purple;
        }}
        onMouseDown={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
        }}
        onMouseUp={(e) => {
          (e.currentTarget as HTMLButtonElement).style.transform = 'none';
        }}
      >
        Apply
      </button>
    </div>
  );
}

// ─── FilterSelect ─────────────────────────────────────────────────────────────

interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  color?: string;
  count?: number;
}

function FilterSelect({
  dropdownKey,
  label,
  value,
  options,
  onChange,
  style,
}: {
  dropdownKey: string;
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  style?: React.CSSProperties;
}) {
  const { isOpen: open, toggle, close } = useExclusiveOpen(dropdownKey);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, close]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, close]);

  const current = options.find((o) => o.value === value) ?? options[0];
  const isActive = value !== options[0]?.value;

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      {/* Card trigger — value + chevron only */}
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: 36,
          padding: '0 10px',
          background: isActive ? T.purpleLight : 'var(--color-card)',
          border: `1.5px solid ${isActive ? T.purple : T.border}`,
          borderRadius: 8,
          cursor: 'pointer',
          fontFamily: 'inherit',
          gap: 6,
          transition: 'all 0.15s',
          outline: 'none',
          textAlign: 'left',
          boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
        }}
        onFocus={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = T.purple;
        }}
        onBlur={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = isActive ? T.purple : T.border;
        }}
        onMouseEnter={(e) => {
          if (!isActive) (e.currentTarget as HTMLButtonElement).style.borderColor = '#C4B5FD';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = isActive ? T.purple : T.border;
        }}
      >
        <span
          style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, overflow: 'hidden' }}
        >
          {current.icon && (
            <span style={{ color: current.color, flexShrink: 0 }}>{current.icon}</span>
          )}
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: isActive ? T.purple : T.dark,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
            }}
          >
            {current.label}
          </span>
        </span>
        <ChevronDown
          size={13}
          style={{
            flexShrink: 0,
            transition: 'transform 0.18s',
            transform: open ? 'rotate(180deg)' : 'none',
            color: T.gray,
          }}
        />
      </button>

      {/* Dropdown panel — capped at 5 rows with internal scroll */}
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            minWidth: '100%',
            zIndex: 1200,
            background: T.panelBg,
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.05)',
            padding: '4px 0',
            maxHeight: 188, // 5 × 36 px rows + 8 px padding
            overflowY: 'auto',
          }}
        >
          {options.map((opt) => {
            const sel = value === opt.value;
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={sel}
                tabIndex={0}
                onClick={() => {
                  onChange(opt.value);
                  close();
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onChange(opt.value);
                    close();
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 14px',
                  height: 36,
                  cursor: 'pointer',
                  outline: 'none',
                  background: sel ? T.purpleLight : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (!sel) (e.currentTarget as HTMLElement).style.background = T.rowHover;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = sel
                    ? T.purpleLight
                    : 'transparent';
                }}
                onFocus={(e) => {
                  (e.currentTarget as HTMLElement).style.background = T.rowHover;
                }}
                onBlur={(e) => {
                  (e.currentTarget as HTMLElement).style.background = sel
                    ? T.purpleLight
                    : 'transparent';
                }}
              >
                {/* Icon + label */}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    overflow: 'hidden',
                  }}
                >
                  {opt.icon && <span style={{ color: opt.color, flexShrink: 0 }}>{opt.icon}</span>}
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: sel ? 600 : 400,
                      color: sel ? T.purple : T.dark,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.label}
                  </span>
                </span>
                {/* Count badge + check mark */}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    flexShrink: 0,
                    marginLeft: 8,
                  }}
                >
                  {opt.count !== undefined && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 20,
                        background: T.countBg,
                        color: T.gray,
                      }}
                    >
                      {opt.count}
                    </span>
                  )}
                  {sel && <Check size={13} color={T.purple} strokeWidth={2.5} />}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────

function ActiveChip({ label }: { label: string }) {
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        background: T.purpleLight,
        color: T.purple,
        borderRadius: 20,
        padding: '3px 10px',
      }}
    >
      {label}
    </span>
  );
}

function MetaChip({
  icon,
  color,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        color,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}

function MetaPipe() {
  return <span style={{ margin: '0 10px', color: T.border, userSelect: 'none' }}>|</span>;
}
