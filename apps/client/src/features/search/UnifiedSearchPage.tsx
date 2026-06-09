// Unified semantic search — FAQs + Community Q&A in one place.
// Engine: MiniSearch (TF-IDF) running in a Web Worker, payloads in IndexedDB.
// Spec: semantic/faq_semantic.md
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, MessageSquare, Search, Sparkles, X, Zap } from 'lucide-react';
import { useUnifiedSearch, type SearchDoc } from '../../hooks/useUnifiedSearch';

const DEBOUNCE_MS = 250;

export function UnifiedSearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [inputValue, setInputValue] = useState(initialQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const { search, clear, results, isReady, indexStats, error } =
    useUnifiedSearch('/api/help-data/export');

  // Fire initial search if arrived from the topbar with ?q=...
  useEffect(() => {
    if (initialQuery && isReady) search(initialQuery);
  }, [isReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleInput = (value: string) => {
    setInputValue(value);
    setSearchParams(value ? { q: value } : {}, { replace: true });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      clear();
      return;
    }
    debounceRef.current = setTimeout(() => search(value), DEBOUNCE_MS);
  };

  const totalResults = results.faqs.length + results.community.length;
  const hasQuery = inputValue.trim().length > 0;

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
          <Sparkles size={18} color="var(--color-primary)" />
        </div>
        <div>
          <span
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Unified Search
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 10 }}>
            FAQs &amp; Community Q&amp;A · instant TF-IDF
          </span>
        </div>
        {indexStats && (
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Zap size={11} color="var(--color-success)" />
            {indexStats.doc_count} docs indexed in {indexStats.total_ms}ms
          </span>
        )}
      </div>

      {/* Search bar */}
      <div className="mod-card mod-card-blue" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <Search
            size={18}
            color={isReady ? 'var(--color-primary)' : 'var(--color-text-muted)'}
            style={{ flexShrink: 0 }}
          />
          <input
            autoFocus
            value={inputValue}
            onChange={(e) => handleInput(e.target.value)}
            placeholder={isReady ? 'Search FAQs and community discussions…' : 'Building index…'}
            disabled={!isReady && !error}
            style={{
              flex: 1,
              border: 'none',
              background: 'none',
              outline: 'none',
              color: 'var(--color-text)',
              fontSize: 15,
              fontFamily: 'inherit',
              opacity: !isReady && !error ? 0.5 : 1,
            }}
          />
          {!isReady && !error && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--color-primary)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 5,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  animation: 'pulse 1.2s ease-in-out infinite',
                }}
              />
              Syncing…
            </span>
          )}
          {isReady && !error && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--color-success)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--color-success)',
                }}
              />
              Ready
            </span>
          )}
          {inputValue && (
            <button
              type="button"
              onClick={() => handleInput('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-text-muted)',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mod-card mod-card-red" style={{ padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>
            Search engine failed to load
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
            {error}
          </div>
        </div>
      )}

      {/* Empty query — show prompt */}
      {!hasQuery && isReady && !error && (
        <div className="mod-card mod-card-blue" style={{ padding: 40, textAlign: 'center' }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--color-primary-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <Search size={26} color="var(--color-primary)" />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>
            Start typing to search
          </div>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              maxWidth: 360,
              margin: '0 auto',
            }}
          >
            Searches {indexStats?.doc_count ?? '…'} articles across FAQs and Community Q&amp;A
            simultaneously
          </div>
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 8,
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {['NOC certificate', 'team formation', 'attendance', 'phase 2', 'mentor'].map((q) => (
              <button
                key={q}
                onClick={() => handleInput(q)}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '5px 14px',
                  borderRadius: 20,
                  border: '1.5px solid var(--color-border)',
                  background: 'var(--color-pill)',
                  color: 'var(--color-text-muted)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No results */}
      {hasQuery && isReady && totalResults === 0 && (
        <div className="mod-card mod-card-orange" style={{ padding: 36, textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            No results for "{inputValue}"
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 14 }}>
            Try different keywords, or post it as a question.
          </div>
          <button
            onClick={() => navigate('/ask')}
            style={{
              padding: '9px 22px',
              borderRadius: 10,
              border: 'none',
              background: 'var(--color-primary)',
              color: 'white',
              fontWeight: 700,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Ask a question →
          </button>
        </div>
      )}

      {/* Results grid */}
      {hasQuery && totalResults > 0 && (
        <>
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              marginBottom: 12,
              fontWeight: 600,
            }}
          >
            {totalResults} result{totalResults === 1 ? '' : 's'} for "{inputValue}"{' · '}
            <span style={{ color: 'var(--color-success)' }}>{results.faqs.length} FAQ</span>
            {' · '}
            <span style={{ color: 'var(--color-primary)' }}>
              {results.community.length} Community
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* FAQ column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: 'var(--color-success-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BookOpen size={15} color="var(--color-success)" />
                </div>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Official FAQs
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                      marginLeft: 8,
                    }}
                  >
                    {results.faqs.length}
                  </span>
                </span>
              </div>

              {results.faqs.length === 0 ? (
                <div
                  className="mod-card mod-card-green"
                  style={{ padding: '20px 18px', textAlign: 'center' }}
                >
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    No FAQ matches
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {results.faqs.map((doc) => (
                    <SearchResultCard key={doc.id} doc={doc} onClick={() => navigate('/faqs')} />
                  ))}
                </div>
              )}
            </div>

            {/* Community column */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 9,
                    background: 'var(--color-primary-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MessageSquare size={15} color="var(--color-primary)" />
                </div>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Community Q&amp;A
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'var(--color-text-muted)',
                      marginLeft: 8,
                    }}
                  >
                    {results.community.length}
                  </span>
                </span>
              </div>

              {results.community.length === 0 ? (
                <div
                  className="mod-card mod-card-blue"
                  style={{ padding: '20px 18px', textAlign: 'center' }}
                >
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    No community matches
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {results.community.map((doc) => (
                    <SearchResultCard
                      key={doc.id}
                      doc={doc}
                      onClick={() => {
                        const mongoId = doc.id.replace('com_', '');
                        navigate(`/community/${mongoId}`);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Result card ──────────────────────────────────────────────────────────────

function SearchResultCard({ doc, onClick }: { doc: SearchDoc; onClick: () => void }) {
  const isFaq = doc.type === 'faq';
  const cardClass = isFaq ? 'mod-card-green' : 'mod-card-blue';

  return (
    <button
      type="button"
      onClick={onClick}
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
      <div className={`mod-card ${cardClass}`} style={{ padding: '14px 16px' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 8,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-text)',
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {doc.title}
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              padding: '3px 8px',
              borderRadius: 6,
              flexShrink: 0,
              background: isFaq ? 'var(--color-success-bg)' : 'var(--color-primary-bg)',
              color: isFaq ? 'var(--color-success)' : 'var(--color-primary)',
            }}
          >
            {isFaq ? 'FAQ' : 'Community'}
          </span>
        </div>

        {/* Content preview */}
        <div
          style={{
            fontSize: 12,
            color: 'var(--color-text-muted)',
            lineHeight: 1.55,
            marginBottom: 10,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {doc.content}
        </div>

        {/* Tags */}
        {doc.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {doc.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 10,
                  padding: '2px 7px',
                  borderRadius: 6,
                  background: 'var(--color-pill)',
                  color: 'var(--color-pill-text)',
                  fontWeight: 600,
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}
