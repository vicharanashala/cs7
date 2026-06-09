// Public, dedicated FAQ knowledge-base page (replaces the old login-page popup). Open to
// anonymous visitors — the /api/faqs, /api/categories and /api/tags GET endpoints are public.
// FAQs render with the same <FaqCard> used on the Student Dashboard; voting flows through the
// public endpoints (anonymous votes are attributed via the X-Anon-Id header set in api-client).
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Folder, RotateCcw, Search, X } from 'lucide-react';
import type { FaqListQuery, PublicFaq } from '@samagama/shared';
import { GlobalTooltip } from '../../components/ui/GlobalTooltip';
import { FaqCard } from './FaqCard';
import { FaqMultiSelect } from './FaqMultiSelect';
import { useCategories, useFaqList, useTags } from './queries';

const DEBOUNCE_MS = 300;
const UNCATEGORIZED = '__general__';

interface CategoryGroup {
  key: string;
  name: string;
  faqs: PublicFaq[];
}

export function CuratedFaqsPage() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  // Single-expand accordion — matches the dashboard's Knowledge Feed behaviour.
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchInput.trim()), DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [searchInput]);

  const query = useMemo<Partial<FaqListQuery>>(() => {
    // Pull a generous page so the grouped knowledge-base view shows the full library.
    const q: Partial<FaqListQuery> = {
      sort: debouncedSearch ? 'relevance' : 'recent',
      pageSize: 100,
    };
    if (debouncedSearch) q.q = debouncedSearch;
    if (categoryIds.length > 0) q.category = categoryIds.join(',');
    if (tagIds.length > 0) q.tag = tagIds.join(',');
    return q;
  }, [debouncedSearch, categoryIds, tagIds]);

  const { data: categories } = useCategories();
  const { data: tags } = useTags();
  const { data, isLoading, isError, refetch } = useFaqList(query, { refetchInterval: 30_000 });

  const items = data?.items ?? [];
  const total = data?.meta.total ?? items.length;
  const hasFilters = categoryIds.length > 0 || tagIds.length > 0 || debouncedSearch.length > 0;

  const resetAll = () => {
    setSearchInput('');
    setDebouncedSearch('');
    setCategoryIds([]);
    setTagIds([]);
  };

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  // Grouped knowledge-base view is only used when nothing is being searched/filtered;
  // otherwise we show a single ranked/filtered result list.
  const groups = useMemo<CategoryGroup[]>(() => {
    if (hasFilters) return [];
    const byKey = new Map<string, CategoryGroup>();
    for (const faq of items) {
      const cat = faq.categories[0];
      const key = cat?.id ?? UNCATEGORIZED;
      const name = cat?.name ?? 'General';
      const group = byKey.get(key);
      if (group) group.faqs.push(faq);
      else byKey.set(key, { key, name, faqs: [faq] });
    }
    // Order sections by the canonical category list, then any leftovers, General last.
    const order = new Map((categories ?? []).map((c, i) => [c._id, i] as const));
    return [...byKey.values()].sort((a, b) => {
      if (a.key === UNCATEGORIZED) return 1;
      if (b.key === UNCATEGORIZED) return -1;
      return (order.get(a.key) ?? Infinity) - (order.get(b.key) ?? Infinity);
    });
  }, [items, categories, hasFilters]);

  const jumpTo = (key: string) => {
    document.getElementById(`cat-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <GlobalTooltip />

      {/* ── Sticky header ────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--color-card)',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Link
            to="/login"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              textDecoration: 'none',
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                fontWeight: 900,
                color: 'white',
                letterSpacing: '-0.5px',
                boxShadow: '0 4px 14px rgba(124,58,237,0.32)',
              }}
            >
              S
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.4px',
                  lineHeight: 1.1,
                }}
              >
                Samagama
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 1 }}>
                Internship Portal
              </div>
            </div>
          </Link>

          <Link
            to="/login"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Sign in <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px 64px' }}>
        {/* Hero */}
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '5px 12px',
              borderRadius: 999,
              background: 'var(--color-purple-bg)',
              color: 'var(--color-purple)',
              fontSize: 12,
              fontWeight: 700,
              marginBottom: 14,
            }}
          >
            <BookOpen size={14} /> Knowledge Base
          </div>
          <h1
            style={{
              fontSize: 30,
              fontWeight: 900,
              color: 'var(--color-text)',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Internship FAQs
          </h1>
          <p
            style={{
              fontSize: 14.5,
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
              marginTop: 10,
              marginBottom: 0,
              maxWidth: 620,
            }}
          >
            Answers to common questions about the Samagama internship — curated and kept current.
            Browse by category, search, or 👍 / 👎 to tell us what helped. No account needed.
          </p>
        </div>

        {/* Search + filters — one aligned row (wraps on narrow screens) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 22,
          }}
        >
          {/* Search — grows to fill the row */}
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 0 }}>
            <Search
              size={17}
              color={searchInput ? 'var(--color-primary)' : 'var(--color-text-muted)'}
              style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search the knowledge base…"
              aria-label="Search FAQs"
              className="field-input"
              style={{
                paddingLeft: 40,
                paddingRight: searchInput ? 40 : 14,
                height: 36,
                fontSize: 14,
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Clear search"
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  padding: 4,
                  color: 'var(--color-text-muted)',
                }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {categories && categories.length > 0 && (
            <FaqMultiSelect
              dropdownKey="browse-faqs-categories"
              values={categoryIds}
              onChange={setCategoryIds}
              placeholder="All Categories"
              countLabel="categories"
              options={categories.map((c) => ({ value: c._id, label: c.name }))}
              width={170}
            />
          )}
          {tags && tags.length > 0 && (
            <FaqMultiSelect
              dropdownKey="browse-faqs-tags"
              values={tagIds}
              onChange={setTagIds}
              placeholder="All Tags"
              countLabel="tags"
              options={tags.map((t) => ({ value: t._id, label: `#${t.name}` }))}
              width={140}
            />
          )}
          {hasFilters && (
            <button
              type="button"
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

        {/* Quick-jump category nav — only in the grouped (unfiltered) view */}
        {!isLoading && !isError && !hasFilters && groups.length > 1 && (
          <nav
            aria-label="Jump to category"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}
          >
            {groups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => jumpTo(g.key)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 999,
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-card)',
                  color: 'var(--color-text)',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = 'var(--color-primary)';
                  el.style.color = 'var(--color-primary)';
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.borderColor = 'var(--color-border)';
                  el.style.color = 'var(--color-text)';
                }}
              >
                <Folder size={13} />
                {g.name}
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 700 }}>
                  {g.faqs.length}
                </span>
              </button>
            ))}
          </nav>
        )}

        {/* ── States ─────────────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 54, borderRadius: 14 }} />
            ))}
          </div>
        ) : isError ? (
          <div
            className="mod-card mod-card-red"
            style={{
              padding: 28,
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
              Couldn't load FAQs.
            </div>
            <button
              onClick={() => void refetch()}
              className="btn btn-danger btn-sm"
              style={{ alignSelf: 'center' }}
            >
              Try again
            </button>
          </div>
        ) : items.length === 0 ? (
          <div
            className="mod-card mod-card-blue"
            style={{ padding: 48, textAlign: 'center' }}
          >
            <BookOpen size={40} color="var(--color-border)" style={{ marginBottom: 14 }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
              {debouncedSearch
                ? `No FAQs match “${debouncedSearch}”`
                : hasFilters
                  ? 'No FAQs match the selected filters'
                  : 'No FAQs published yet'}
            </div>
            {hasFilters && (
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                Try a different keyword or clear your filters.
              </div>
            )}
          </div>
        ) : hasFilters ? (
          // Flat ranked/filtered list.
          <>
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text-muted)',
                fontWeight: 500,
                marginBottom: 12,
              }}
            >
              {total} result{total === 1 ? '' : 's'}
              {debouncedSearch && ` for “${debouncedSearch}”`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map((faq) => (
                <FaqCard
                  key={faq.id}
                  faq={faq}
                  role="student"
                  allowFlag={false}
                  expanded={openId === faq.id}
                  onToggle={() => toggle(faq.id)}
                />
              ))}
            </div>
          </>
        ) : (
          // Grouped knowledge-base view.
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {groups.map((g) => (
              <section key={g.key} id={`cat-${g.key}`} style={{ scrollMarginTop: 80 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    marginBottom: 14,
                    paddingBottom: 10,
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <Folder size={17} color="var(--color-primary)" />
                  <h2
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: 'var(--color-text)',
                      letterSpacing: '-0.02em',
                      margin: 0,
                    }}
                  >
                    {g.name}
                  </h2>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-text-muted)',
                      background: 'var(--color-input)',
                      borderRadius: 999,
                      padding: '2px 9px',
                    }}
                  >
                    {g.faqs.length}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {g.faqs.map((faq) => (
                    <FaqCard
                      key={faq.id}
                      faq={faq}
                      role="student"
                      allowFlag={false}
                      expanded={openId === faq.id}
                      onToggle={() => toggle(faq.id)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {/* Footer CTA */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: 13.5,
            color: 'var(--color-text-muted)',
          }}
        >
          Looking for Community Q&A or Yaksha AI?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>
            Sign in to your account →
          </Link>
        </div>
      </main>
    </div>
  );
}
