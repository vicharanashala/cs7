import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Eye,
  Plus,
  Pencil,
  Trash2,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Folder,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import type { PublicFaq, FaqCreateInput, FaqStatus } from '@samagama/shared';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { useQueryClient } from '@tanstack/react-query';
import { useDeleteFaq, useCategories, useFaqList, useTags } from '../../faq/queries';
import { useFlagList, useUpdateFlagStatus } from '../../flag/queries';
import { InlineFaqEditor } from './InlineFaqEditor';

type Filter = 'all' | 'helpful' | 'flagged';
const PAGE_SIZES = [5, 10, 20, 50];

// Fixed grid — all columns always visible: # | Question | Details | Engagement | Flag | Actions
const GRID = '52px minmax(0,2.5fr) minmax(0,1fr) 120px 100px 110px';

// ─── Colours — all resolved from the app's CSS custom properties ──────────
const C = {
  badge: { bg: 'var(--color-primary-bg)', fg: 'var(--color-primary)' },
  catText: 'var(--color-primary)',
  dotPublished: 'var(--color-success)',
  dotOutdated: 'var(--color-warning)',
  dotDraft: 'var(--color-text-muted)',
  pillPublished: { bg: 'var(--color-success-bg)', fg: 'var(--color-success)' },
  pillOutdated: { bg: 'var(--color-warning-bg)', fg: 'var(--color-warning)' },
  pillDraft: { bg: 'var(--color-pill)', fg: 'var(--color-pill-text)' },
  thumbUp: 'var(--color-success)',
  thumbDown: 'var(--color-danger)',
  flagBadge: { bg: 'var(--color-danger-bg)', fg: 'var(--color-danger)' },
  flagNone: 'var(--color-text-muted)',
  divider: 'var(--color-border)',
  header: 'var(--color-bg)',
  rowHover: 'var(--color-sidebar-hover)',
  border: 'var(--color-border)',
  muted: 'var(--color-text-muted)',
  mutedLabel: 'var(--color-text-muted)',
  text: 'var(--color-text)',
  actionEye: { bg: 'var(--color-pill)', fg: 'var(--color-text)', border: 'var(--color-border)' },
  actionEdit: {
    bg: 'var(--color-primary-bg)',
    fg: 'var(--color-primary)',
    border: 'var(--color-primary-bg)',
  },
  actionDel: {
    bg: 'var(--color-danger-bg)',
    fg: 'var(--color-danger)',
    border: 'var(--color-danger-bg)',
  },
};

export function FaqsAdminTab({ flaggedCount }: { flaggedCount: number }) {
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [flagExpandedId, setFlagExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      setSearchQuery(value.trim());
      setPage(1);
    }, 350);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setPage(1);
  };

  const queryParams = useMemo(() => {
    const q: {
      filter?: 'helpful' | 'flagged';
      page: number;
      pageSize: number;
      q?: string;
      sort?: 'relevance' | 'recent' | 'added' | 'popular' | 'helpful';
    } = { page, pageSize };
    if (filter === 'helpful') q.filter = 'helpful';
    if (filter === 'flagged') q.filter = 'flagged';
    if (searchQuery) {
      q.q = searchQuery;
      q.sort = 'relevance';
    }
    return q;
  }, [filter, page, pageSize, searchQuery]);

  // Poll every 30 s so engagement counts stay in sync with student votes
  // submitted in other sessions without requiring a manual reload.
  const { data, isLoading } = useFaqList(queryParams, { refetchInterval: 30_000 });
  const { data: categories } = useCategories();
  const { data: tags } = useTags();

  const total = (data?.meta as { total?: number } | undefined)?.total ?? data?.items.length ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  const switchFilter = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        {/* Filter dropdown */}
        <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
          <select
            value={filter}
            onChange={(e) => switchFilter(e.target.value as Filter)}
            style={{
              fontSize: 13,
              padding: '7px 32px 7px 12px',
              borderRadius: 8,
              border: `1px solid ${filter !== 'all' ? 'var(--color-primary)' : 'var(--color-border)'}`,
              background: filter !== 'all' ? 'var(--color-primary-bg)' : 'var(--color-input)',
              color: filter !== 'all' ? 'var(--color-primary)' : 'var(--color-text)',
              fontFamily: 'inherit',
              fontWeight: 600,
              cursor: 'pointer',
              appearance: 'none',
              outline: 'none',
              transition: 'border-color .15s, background .15s',
            }}
          >
            <option value="all">All</option>
            <option value="helpful">Helpful FAQs</option>
            <option value="flagged">
              {flaggedCount > 0 ? `Flagged FAQs (${flaggedCount})` : 'Flagged FAQs'}
            </option>
          </select>
          <ChevronRight
            size={13}
            style={{
              position: 'absolute',
              right: 8,
              pointerEvents: 'none',
              rotate: '90deg',
              color: filter !== 'all' ? 'var(--color-primary)' : C.muted,
            }}
          />
        </div>

        {/* Search bar */}
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <Search
            size={15}
            color={searchInput ? 'var(--color-primary)' : 'var(--color-text-muted)'}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search FAQs by keyword…"
            style={{
              width: '100%',
              padding: '8px 36px 8px 36px',
              fontSize: 13,
              border: `1px solid ${searchInput ? 'var(--color-primary)' : 'var(--color-border)'}`,
              borderRadius: 8,
              outline: 'none',
              background: 'var(--color-input)',
              color: 'var(--color-text)',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
              transition: 'border-color .15s',
            }}
            onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
            onBlur={(e) =>
              (e.target.style.borderColor = searchInput
                ? 'var(--color-primary)'
                : 'var(--color-border)')
            }
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              style={{
                position: 'absolute',
                right: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 2,
                display: 'flex',
                alignItems: 'center',
                color: C.muted,
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus size={14} /> {creating ? 'Cancel' : 'New FAQ'}
        </Button>
      </div>

      {creating && categories && tags && (
        <div style={{ marginBottom: 14 }}>
          <InlineFaqEditor categories={categories} tags={tags} onClose={() => setCreating(false)} />
        </div>
      )}

      {/* ── Table ── */}
      <div className="mod-card mod-card-blue" style={{ overflow: 'hidden', borderRadius: 14 }}>
        {/* Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: GRID,
            alignItems: 'center',
            padding: '14px 20px',
            background: C.header,
            borderBottom: `1px solid ${C.divider}`,
            gap: 0,
          }}
        >
          <ColHead>#</ColHead>
          <ColHead>Question</ColHead>
          <ColHead>Details</ColHead>
          <ColHead>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              Engagement <Info size={13} color={C.muted} />
            </span>
          </ColHead>
          <ColHead>Flag</ColHead>
          <ColHead>Actions</ColHead>
        </div>

        {/* Body */}
        {isLoading && (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: C.muted }}>
            Loading…
          </div>
        )}
        {!isLoading && data?.items.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: C.muted }}>
            {searchQuery ? (
              <>
                No FAQs matched <strong>"{searchQuery}"</strong>. Try different keywords.
              </>
            ) : (
              'No FAQs match this filter.'
            )}
          </div>
        )}

        {data?.items.map((faq, i) => {
          const isLast = i === (data?.items.length ?? 0) - 1;
          const rowNum = String((page - 1) * pageSize + i + 1).padStart(2, '0');
          return (
            <FaqRow
              key={faq.id}
              faq={faq}
              rowNum={rowNum}
              isLast={isLast}
              expanded={expandedId === faq.id}
              onToggleExpand={() => setExpandedId((id) => (id === faq.id ? null : faq.id))}
              flagExpanded={flagExpandedId === faq.id}
              onToggleFlagExpand={() => setFlagExpandedId((id) => (id === faq.id ? null : faq.id))}
              editing={editingId === faq.id}
              onEdit={() => setEditingId(faq.id)}
              onCancelEdit={() => setEditingId(null)}
              categories={categories ?? []}
              tags={tags ?? []}
            />
          );
        })}
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        {/* Count */}
        <span style={{ fontSize: 13, color: C.mutedLabel }}>
          {total === 0
            ? 'No FAQs found'
            : `Showing ${startItem} to ${endItem} of ${total} FAQ${total === 1 ? '' : 's'}`}
          {searchQuery && total > 0 && (
            <span
              style={{
                marginLeft: 8,
                fontSize: 12,
                fontWeight: 600,
                background: 'var(--color-primary-bg)',
                color: 'var(--color-primary)',
                borderRadius: 6,
                padding: '2px 8px',
              }}
            >
              "{searchQuery}"
            </span>
          )}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Page-size picker */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                fontSize: 13,
                padding: '7px 32px 7px 12px',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                background: 'var(--color-input)',
                color: 'var(--color-text)',
                fontFamily: 'inherit',
                cursor: 'pointer',
                appearance: 'none',
                outline: 'none',
              }}
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s} per page
                </option>
              ))}
            </select>
            <ChevronRight
              size={13}
              style={{
                position: 'absolute',
                right: 8,
                pointerEvents: 'none',
                rotate: '90deg',
                color: C.muted,
              }}
            />
          </div>

          {/* Page buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <PgBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft size={14} />
            </PgBtn>
            {buildPages(page, totalPages).map((p, idx) =>
              p === '…' ? (
                <span key={`e${idx}`} style={{ padding: '0 4px', color: C.muted, fontSize: 13 }}>
                  …
                </span>
              ) : (
                <PgBtn key={p} active={page === p} onClick={() => setPage(p as number)}>
                  {p}
                </PgBtn>
              ),
            )}
            <PgBtn
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight size={14} />
            </PgBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function FaqRow({
  faq,
  rowNum,
  isLast,
  expanded,
  onToggleExpand,
  flagExpanded,
  onToggleFlagExpand,
  editing,
  onEdit,
  onCancelEdit,
  categories,
  tags,
}: {
  faq: PublicFaq;
  rowNum: string;
  isLast: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  flagExpanded: boolean;
  onToggleFlagExpand: () => void;
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  categories: { _id: string; name: string }[];
  tags: { _id: string; name: string }[];
}) {
  const deleteFaq = useDeleteFaq();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const flagCount = faq.flagCount ?? 0;
  const { dotColor, pill } = statusTokens(faq.status);

  if (editing) {
    return (
      <div style={{ padding: 20, borderBottom: isLast ? 'none' : `1px solid ${C.border}` }}>
        <InlineFaqEditor
          categories={categories}
          tags={tags}
          existing={{
            id: faq.id,
            title: faq.title,
            answer: faq.answer,
            summary: faq.summary,
            status: faq.status,
            categories: faq.categories.map((c) => c.id),
            tags: faq.tags.map((t) => t.id),
            helpfulCount: faq.helpfulCount,
            unhelpfulCount: faq.unhelpfulCount,
            flagCount: faq.flagCount,
          }}
          onClose={onCancelEdit}
        />
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: GRID,
          alignItems: 'center',
          padding: '14px 20px',
          borderBottom: isLast && !expanded ? 'none' : `1px solid ${C.border}`,
          gap: 0,
          transition: 'background .12s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = C.rowHover)}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        {/* # Badge */}
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: 10,
              background: C.badge.bg,
              color: C.badge.fg,
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {rowNum}
          </span>
        </div>

        {/* Question */}
        <div style={{ paddingRight: 16, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text, lineHeight: 1.45 }}>
            {faq.title}
          </p>
        </div>

        {/* Details — Category above, Status + time below */}
        <div style={{ paddingRight: 16, minWidth: 0 }}>
          {/* Row 1: Category */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, minWidth: 0 }}
          >
            <Folder size={12} color={C.muted} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.catText,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {faq.categories[0]?.name ?? '—'}
            </span>
          </div>
          {/* Row 2: Status pill + updated time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 20,
                background: pill.bg,
                color: pill.fg,
                whiteSpace: 'nowrap',
              }}
            >
              {faq.status.charAt(0).toUpperCase() + faq.status.slice(1)}
            </span>
            <span style={{ fontSize: 11, color: C.mutedLabel, whiteSpace: 'nowrap' }}>
              {timeAgo(faq.updatedAt)}
            </span>
          </div>
        </div>

        {/* Engagement */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ThumbsUp size={14} color={C.thumbUp} strokeWidth={1.8} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.thumbUp }}>
              {faq.helpfulCount ?? 0}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <ThumbsDown size={14} color={C.thumbDown} strokeWidth={1.8} />
            <span style={{ fontSize: 13, fontWeight: 600, color: C.thumbDown }}>
              {faq.unhelpfulCount ?? 0}
            </span>
          </div>
        </div>

        {/* Flag */}
        <div>
          {flagCount > 0 ? (
            <button
              type="button"
              onClick={onToggleFlagExpand}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 20,
                  background: flagExpanded ? C.flagBadge.fg : C.flagBadge.bg,
                  color: flagExpanded ? '#fff' : C.flagBadge.fg,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Flagged
                {flagExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
              </span>
              <p style={{ margin: '3px 0 0', fontSize: 11, color: C.muted }}>
                by {flagCount} student{flagCount === 1 ? '' : 's'}
              </p>
            </button>
          ) : (
            <span style={{ fontSize: 13, color: C.flagNone }}>—</span>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ABtn
            label={expanded ? 'Hide answer' : 'View answer'}
            onClick={onToggleExpand}
            bg={C.actionEye.bg}
            fg={C.actionEye.fg}
            border={C.actionEye.border}
          >
            <Eye size={15} strokeWidth={1.8} />
          </ABtn>
          <ABtn
            label="Edit"
            onClick={onEdit}
            bg={C.actionEdit.bg}
            fg={C.actionEdit.fg}
            border={C.actionEdit.border}
          >
            <Pencil size={15} strokeWidth={1.8} />
          </ABtn>
          <ABtn
            label="Delete"
            onClick={() => setConfirmingDelete(true)}
            bg={C.actionDel.bg}
            fg={C.actionDel.fg}
            border={C.actionDel.border}
          >
            <Trash2 size={15} strokeWidth={1.8} />
          </ABtn>
        </div>

        {/* Confirmation modal — portal so it's never clipped by table overflow */}
        {confirmingDelete && (
          <DeleteFaqDialog
            title={faq.title}
            isPending={deleteFaq.isPending}
            onConfirm={() => deleteFaq.mutate(faq.id)}
            onCancel={() => setConfirmingDelete(false)}
          />
        )}
      </div>

      {/* Expanded answer */}
      {expanded && (
        <div
          style={{
            padding: '16px 20px 16px 80px',
            background: 'var(--color-bg)',
            borderBottom: isLast && !flagExpanded ? 'none' : `1px solid ${C.border}`,
            fontSize: 13,
            color: 'var(--color-text)',
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
          }}
        >
          {faq.answer}
        </div>
      )}

      {/* Expanded flag feedback */}
      {flagExpanded && flagCount > 0 && (
        <FaqFlagPanel faqId={faq.id} faqFlagCount={flagCount} isLast={isLast} />
      )}
    </>
  );
}

// ─── Flag panel ───────────────────────────────────────────────────────────────

const REASON_COPY: Record<string, string> = {
  incorrect: 'Incorrect information',
  outdated: 'Outdated',
  duplicate: 'Duplicate',
  unclear: 'Unclear',
  other: 'Other',
};

const SPURTI_OPTIONS = [
  { label: '0 pts', value: 0 },
  { label: '+1 pt', value: 1 },
  { label: '+2 pts', value: 2 },
  { label: '−1 pt', value: -1 },
];

function FaqFlagPanel({
  faqId,
  faqFlagCount,
  isLast,
}: {
  faqId: string;
  faqFlagCount: number;
  isLast: boolean;
}) {
  const { data: open, isLoading: loadingOpen } = useFlagList({ entityType: 'faq', status: 'open' });
  const { data: underReview, isLoading: loadingUnderReview } = useFlagList({
    entityType: 'faq',
    status: 'under_review',
  });
  const update = useUpdateFlagStatus();
  const qc = useQueryClient();
  const [spurtiMap, setSpurtiMap] = useState<Record<string, number>>({});

  const isLoading = loadingOpen || loadingUnderReview;

  const flags = useMemo(
    () =>
      [...(open ?? []), ...(underReview ?? [])]
        .filter((f) => f.entityId === faqId)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [open, underReview, faqId],
  );

  // When data has loaded but no live flags exist while the FAQ still shows a non-zero
  // flagCount, the counter is stale (e.g. flags were auto-resolved after an answer edit).
  // Invalidate the FAQ list so the row refreshes and disappears from the Flagged filter.
  useEffect(() => {
    if (!isLoading && flags.length === 0 && faqFlagCount > 0) {
      void qc.invalidateQueries({ queryKey: ['faqs'] });
    }
  }, [isLoading, flags.length, faqFlagCount, qc]);

  const getSpurti = (id: string) => spurtiMap[id] ?? 0;
  const setSpurti = (id: string, pts: number) => setSpurtiMap((m) => ({ ...m, [id]: pts }));

  return (
    <div
      style={{
        padding: '12px 20px 14px 20px',
        background: 'var(--color-danger-bg)',
        borderTop: `1px solid var(--color-danger)`,
        borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {isLoading && (
        <div style={{ fontSize: 12, color: C.muted }}>Loading flags…</div>
      )}
      {!isLoading && flags.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted }}>No open flags for this FAQ.</div>
      )}

      {flags.map((f) => (
        <div
          key={f.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 0,
            background: 'var(--color-card)',
            border: `1px solid var(--color-border)`,
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          {/* Left: Student Feedback */}
          <div style={{ padding: '14px 18px', borderRight: `1px solid var(--color-border)` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>
              Student Feedback
            </div>
            {f.details && (
              <div
                style={{
                  fontSize: 12,
                  color: C.mutedLabel,
                  fontStyle: 'italic',
                  lineHeight: 1.6,
                  marginBottom: 6,
                }}
              >
                "{f.details}"
              </div>
            )}
            {!f.details && (
              <div style={{ fontSize: 12, color: C.muted, fontStyle: 'italic', marginBottom: 6 }}>
                {REASON_COPY[f.reason] ?? f.reason}
              </div>
            )}
            <div style={{ fontSize: 11, color: C.muted }}>
              Reported by {f.reportedBy.name} · {flagTimeAgo(f.createdAt)}
            </div>
          </div>

          {/* Middle: Spurti reward */}
          <div
            style={{
              padding: '14px 20px',
              borderRight: `1px solid var(--color-border)`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 8,
              minWidth: 260,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-primary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Sparkles size={11} /> Spurti reward for {f.reportedBy.name}:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {SPURTI_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSpurti(f.id, opt.value)}
                  style={{
                    fontSize: 12,
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontFamily: 'inherit',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: `1.5px solid ${getSpurti(f.id) === opt.value ? '#7c3aed' : C.divider}`,
                    background: getSpurti(f.id) === opt.value ? '#ede9fe' : '#fff',
                    color: getSpurti(f.id) === opt.value ? '#7c3aed' : C.muted,
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Actions */}
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8 }}>
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
  );
}

function flagTimeAgo(iso: string): string {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

// ─── Tiny shared components ───────────────────────────────────────────────────

function ColHead({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: 'var(--color-text)',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {children}
    </div>
  );
}

function ABtn({
  children,
  label,
  onClick,
  bg,
  fg,
  border,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  bg: string;
  fg: string;
  border: string;
  disabled?: boolean;
}) {
  return (
    <button
      aria-label={label}
      data-tooltip={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 36,
        height: 36,
        borderRadius: 9,
        border: `1px solid ${border}`,
        background: bg,
        color: fg,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}


function PgBtn({
  children,
  onClick,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        minWidth: 36,
        height: 36,
        padding: '0 8px',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-primary)' : 'var(--color-card)',
        color: active ? '#fff' : disabled ? 'var(--color-text-muted)' : 'var(--color-text)',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: active ? 700 : 400,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusTokens(status: FaqStatus) {
  const map: Record<FaqStatus, { dotColor: string; pill: { bg: string; fg: string } }> = {
    published: { dotColor: C.dotPublished, pill: C.pillPublished },
    outdated: { dotColor: C.dotOutdated, pill: C.pillOutdated },
    draft: { dotColor: C.dotDraft, pill: C.pillDraft },
  };
  return map[status] ?? map.draft;
}

function buildPages(cur: number, total: number): (number | '…')[] {
  if (total <= 6) return Array.from({ length: total }, (_, i) => i + 1);
  const arr: (number | '…')[] = [1];
  if (cur > 3) arr.push('…');
  for (let p = Math.max(2, cur - 1); p <= Math.min(total - 1, cur + 1); p++) arr.push(p);
  if (cur < total - 2) arr.push('…');
  arr.push(total);
  return arr;
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

const labelStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 10,
  color: 'var(--color-text-muted)',
  marginBottom: 3,
  letterSpacing: '.2px',
};
const valueStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-text)',
};
const vDivider: React.CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background: 'var(--color-border)',
  margin: '0 0',
};

export type { FaqCreateInput };

// ── DeleteFaqDialog ────────────────────────────────────────────────────────────

function DeleteFaqDialog({
  title,
  isPending,
  onConfirm,
  onCancel,
}: {
  title: string;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onCancel]);

  // Trap scroll on the body while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="faq-delete-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(2px)',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'relative',
          background: 'var(--color-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 16,
          padding: '28px 28px 24px',
          width: '100%',
          maxWidth: 420,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Icon */}
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: 'var(--color-danger-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
          }}
        >
          <Trash2 size={22} color="var(--color-danger)" strokeWidth={1.8} />
        </div>

        {/* Heading */}
        <div
          id="faq-delete-title"
          style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}
        >
          Delete FAQ?
        </div>

        {/* Body */}
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 6 }}>
          You are about to permanently delete:
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text)',
            background: 'var(--color-input)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '8px 12px',
            marginBottom: 20,
            lineHeight: 1.5,
          }}
        >
          {title.length > 120 ? title.slice(0, 117) + '…' : title}
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-danger)', marginBottom: 24, fontWeight: 500 }}>
          This action cannot be undone. All flags and engagement data for this FAQ will also be removed.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            disabled={isPending}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: '1px solid var(--color-border)',
              background: 'var(--color-card)',
              color: 'var(--color-text-muted)',
              fontSize: 13,
              fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              padding: '9px 20px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--color-danger)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              opacity: isPending ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Trash2 size={13} strokeWidth={2} />
            {isPending ? 'Deleting…' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
