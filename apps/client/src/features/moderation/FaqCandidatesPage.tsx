import { ArrowRight, BookOpen, Lightbulb } from 'lucide-react';
import { hasAdminAccess } from '@samagama/shared';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { useFaqCandidates, useConvertToFaq } from '../admin/queries';
import { useAuth } from '../auth/AuthProvider';

export function FaqCandidatesPage() {
  const { data, isLoading } = useFaqCandidates();
  const convert = useConvertToFaq();
  const { user } = useAuth();
  const isAdmin = !!user && hasAdminAccess(user.role);

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
            boxShadow: '0 2px 8px rgba(16,185,129,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lightbulb size={18} color="var(--color-success)" />
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
            FAQ Candidates
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginLeft: 10 }}>
            Approved answers eligible for knowledge base promotion
          </span>
        </div>
      </div>

      {isLoading && (
        <div
          className="mod-card mod-card-green"
          style={{ padding: 24, fontSize: 13, color: 'var(--color-text-muted)' }}
        >
          Loading…
        </div>
      )}

      {!isLoading && (data?.length ?? 0) === 0 && (
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
            <BookOpen size={26} color="var(--color-success)" />
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            No FAQ candidates yet
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-muted)',
              maxWidth: 360,
              margin: '0 auto',
            }}
          >
            When moderators mark approved answers as eligible for FAQ conversion, they'll appear
            here.
          </div>
        </div>
      )}

      {data && data.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {data.map((candidate) => (
            <div key={candidate.id} className="mod-card mod-card-green">
              {/* Card header */}
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 0' }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--color-success-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Lightbulb size={17} color="var(--color-success)" />
                </div>
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: 'var(--color-text)',
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {candidate.questionTitle}
                  </span>
                </div>
                <Badge color="accent">{candidate.category}</Badge>
              </div>

              <div style={{ padding: '12px 20px 20px' }}>
                {candidate.questionDescription && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-muted)',
                      marginBottom: 12,
                      lineHeight: 1.55,
                    }}
                  >
                    {candidate.questionDescription.length > 200
                      ? candidate.questionDescription.slice(0, 200) + '…'
                      : candidate.questionDescription}
                  </div>
                )}

                {/* Answer body */}
                <div
                  style={{
                    background: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderLeft: '3px solid var(--color-success)',
                    borderRadius: 10,
                    padding: '12px 14px',
                    marginBottom: 14,
                    fontSize: 13,
                    color: 'var(--color-text)',
                    lineHeight: 1.65,
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {candidate.answerBody}
                </div>

                {/* Footer */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    by <strong>{candidate.author.name}</strong>
                    {candidate.moderator && (
                      <>
                        {' '}
                        · approved by <strong>{candidate.moderator.name}</strong>
                      </>
                    )}
                    {' · '}
                    {timeAgo(candidate.approvedAt)}
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => convert.mutate(candidate.id)}
                      disabled={convert.isPending}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '8px 18px',
                        background: 'var(--color-success)',
                        color: 'white',
                        border: 'none',
                        borderRadius: 10,
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 700,
                        fontFamily: 'inherit',
                        boxShadow: '0 3px 10px rgba(16,185,129,0.25)',
                        opacity: convert.isPending ? 0.6 : 1,
                      }}
                    >
                      <ArrowRight size={13} /> Convert to FAQ Draft
                    </button>
                  )}
                </div>

                {convert.isSuccess && convert.variables === candidate.id && (
                  <div
                    style={{
                      marginTop: 8,
                      fontSize: 12,
                      color: 'var(--color-success)',
                      fontWeight: 600,
                    }}
                  >
                    ✓ Converted to FAQ draft — find it in FAQ Management.
                  </div>
                )}
              </div>
            </div>
          ))}
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
