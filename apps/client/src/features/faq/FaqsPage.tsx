import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, RotateCcw, Search, X } from 'lucide-react';
import type { FaqListQuery, FaqStatus } from '@samagama/shared';
import { FAQ_STATUSES, hasModeratorAccess } from '@samagama/shared';
import { useAuth } from '../auth/AuthProvider';
import { FaqCard } from './FaqCard';
import { FaqMultiSelect } from './FaqMultiSelect';
import { FaqSingleSelect } from './FaqSingleSelect';
import { useCategories, useFaqList, useTags } from './queries';

const DEBOUNCE_MS = 300;

export function FaqsPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(initialQ);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQ.trim());
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [status, setStatus] = useState<FaqStatus | undefined>();
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleFaq = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [searchInput]);

  const query = useMemo<Partial<FaqListQuery>>(() => {
    const q: Partial<FaqListQuery> = { sort: debouncedSearch ? 'relevance' : 'recent' };
    if (debouncedSearch) q.q = debouncedSearch;
    if (categoryIds.length > 0) q.category = categoryIds.join(',');
    if (tagIds.length > 0) q.tag = tagIds.join(',');
    if (status) q.status = status;
    return q;
  }, [debouncedSearch, categoryIds, tagIds, status]);

  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data, isLoading, isError, error, refetch } = useFaqList(query, { refetchInterval: 30_000 });

  const isMod = !!user && hasModeratorAccess(user.role);
  const activeCount =
    (categoryIds.length > 0 ? 1 : 0) + (tagIds.length > 0 ? 1 : 0) + (status ? 1 : 0);

  const resetAll = () => {
    setCategoryIds([]);
    setTagIds([]);
    setStatus(undefined);
    setSearchInput('');
    setDebouncedSearch('');
  };

  if (!user) return null;

  return (
    <div>
      {/* ── Heading ─────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: 'var(--color-card)',
            boxShadow: '0 2px 8px rgba(59,130,246,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <BookOpen size={18} color="var(--color-primary)" />
        </div>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Browse FAQs
          {!isLoading && data && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--color-text-muted)',
                marginLeft: 8,
              }}
            >
              {data.meta.total} article{data.meta.total === 1 ? '' : 's'}
              {debouncedSearch && ` for "${debouncedSearch}"`}
            </span>
          )}
        </span>
      </div>

      {/* ── Search + Filter row ──────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 12,
        }}
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
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search FAQs by title or keyword…"
            aria-label="Search FAQs"
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

        {/* Category — multi-select */}
        {categories && categories.length > 0 && (
          <FaqMultiSelect
            dropdownKey="faqs-categories"
            values={categoryIds}
            onChange={setCategoryIds}
            placeholder="All Categories"
            countLabel="categories"
            options={categories.map((c) => ({ value: c._id, label: c.name }))}
            width={155}
          />
        )}

        {/* Tags — multi-select */}
        {tags && tags.length > 0 && (
          <FaqMultiSelect
            dropdownKey="faqs-tags"
            values={tagIds}
            onChange={setTagIds}
            placeholder="All Tags"
            countLabel="tags"
            options={tags.map((t) => ({ value: t._id, label: `#${t.name}` }))}
            width={130}
          />
        )}

        {/* Status — mods/admins only, single-select */}
        {isMod && (
          <FaqSingleSelect
            dropdownKey="faqs-status"
            value={status}
            onChange={(v) => setStatus(v as FaqStatus | undefined)}
            placeholder="All Statuses"
            options={FAQ_STATUSES.map((s) => ({
              value: s,
              label: s.charAt(0).toUpperCase() + s.slice(1),
            }))}
            width={130}
          />
        )}

        {/* Reset — only when something is active */}
        {(activeCount > 0 || debouncedSearch) && (
          <button
            onClick={resetAll}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              height: 36,
              padding: '0 12px',
              borderRadius: 8,
              border: '1.5px solid var(--color-border)',
              background: 'var(--color-card)',
              color: 'var(--color-text-muted)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = 'var(--color-primary)';
              el.style.color = 'var(--color-primary)';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.borderColor = 'var(--color-border)';
              el.style.color = 'var(--color-text-muted)';
            }}
          >
            <RotateCcw size={12} /> Reset
          </button>
        )}
      </div>

      {/* ── Active filter chips ──────────────────────────────────────── */}
      {(activeCount > 0 || debouncedSearch) && (
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

          {categoryIds.map((id) => {
            const name = categories?.find((c) => c._id === id)?.name;
            return name ? (
              <ActiveChip
                key={id}
                label={name}
                onRemove={() => setCategoryIds((prev) => prev.filter((i) => i !== id))}
              />
            ) : null;
          })}

          {tagIds.map((id) => {
            const name = tags?.find((t) => t._id === id)?.name;
            return name ? (
              <ActiveChip
                key={id}
                label={`#${name}`}
                onRemove={() => setTagIds((prev) => prev.filter((i) => i !== id))}
              />
            ) : null;
          })}

          {status && <ActiveChip label={status.charAt(0).toUpperCase() + status.slice(1)} />}

          <button
            onClick={resetAll}
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--color-text-muted)',
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

      {/* ── Results ──────────────────────────────────────────────────── */}
      {isLoading && (
        <div
          className="mod-card mod-card-blue"
          style={{ padding: 20, color: 'var(--color-text-muted)', fontSize: 13 }}
        >
          Loading FAQs…
        </div>
      )}

      {isError && (
        <div className="mod-card mod-card-red" style={{ padding: 20 }}>
          <div style={{ color: 'var(--color-danger)', fontWeight: 700, marginBottom: 4 }}>
            Couldn't load FAQs.
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            {error instanceof Error ? error.message : 'Unknown error'}
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
            <RotateCcw size={12} /> Try again
          </button>
        </div>
      )}

      {data && data.items.length === 0 && (
        <div className="mod-card mod-card-blue" style={{ padding: 40, textAlign: 'center' }}>
          <BookOpen size={36} color="var(--color-border)" style={{ marginBottom: 12 }} />
          {debouncedSearch ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                No FAQs found for &ldquo;{debouncedSearch}&rdquo;
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Try a different keyword or clear the search.
              </div>
            </>
          ) : activeCount > 0 ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
                No FAQs match the selected filters
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Try adjusting or clearing your filters.
              </div>
            </>
          ) : (
            <div style={{ fontSize: 15, fontWeight: 700 }}>No FAQs found</div>
          )}
        </div>
      )}

      {data && data.items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.items.map((faq) => (
            <FaqCard
              key={faq.id}
              faq={faq}
              role={user.role}
              expanded={openId === faq.id}
              onToggle={() => toggleFaq(faq.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── ActiveChip ───────────────────────────────────────────────────────────────

function ActiveChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 600,
        background: 'var(--color-purple-bg)',
        color: 'var(--color-purple)',
        borderRadius: 20,
        padding: onRemove ? '3px 6px 3px 10px' : '3px 10px',
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove filter: ${label}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: 'var(--color-purple)',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            color: 'white',
            flexShrink: 0,
          }}
        >
          <X size={9} strokeWidth={2.5} />
        </button>
      )}
    </span>
  );
}
