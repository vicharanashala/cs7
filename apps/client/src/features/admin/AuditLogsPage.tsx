// Audit Logs page — admin-only surface for reviewing system audit trail.
import { useState } from 'react';
import { Clock, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { useAuditLogs } from './queries';

type EntityFilter = 'all' | 'user' | 'faq' | 'answer';

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = {
    page,
    pageSize: 20,
    ...(entityFilter !== 'all' ? { entityType: entityFilter } : {}),
  };

  const { data, isLoading } = useAuditLogs(params);
  const totalPages = data?.meta?.totalPages ?? 1;

  return (
    <div>
      <SectionHeader title="Audit Logs" sub="Complete trail of admin and moderator actions." />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'user', 'faq', 'answer'] as EntityFilter[]).map((f) => (
          <FilterChip
            key={f}
            active={entityFilter === f}
            onClick={() => {
              setEntityFilter(f);
              setPage(1);
            }}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1) + 's'}
          </FilterChip>
        ))}
      </div>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.2fr 1fr 0.8fr 1.2fr 40px',
            gap: 10,
            padding: '10px 18px',
            background: 'var(--color-input)',
            borderBottom: '1px solid var(--color-border)',
            fontSize: 11,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '.5px',
          }}
        >
          <div>Time</div>
          <div>Actor</div>
          <div>Action</div>
          <div>Entity</div>
          <div>Details</div>
          <div></div>
        </div>

        {isLoading && <div style={{ padding: 18, fontSize: 13 }}>Loading…</div>}
        {!isLoading && (data?.items.length ?? 0) === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--color-text-muted)',
            }}
          >
            No audit log entries yet.
          </div>
        )}

        {data?.items.map((entry, i) => {
          const isExpanded = expandedId === entry.id;
          return (
            <div key={entry.id}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.2fr 1fr 0.8fr 1.2fr 40px',
                  gap: 10,
                  padding: '12px 18px',
                  borderBottom:
                    !isExpanded && i < data.items.length - 1
                      ? '1px solid var(--color-border)'
                      : isExpanded
                        ? '1px solid var(--color-border)'
                        : 'none',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
                onClick={() => setExpandedId(isExpanded ? null : entry.id)}
              >
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  <Clock size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                  {formatDate(entry.createdAt)}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{entry.actor.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                    {entry.actor.email}
                  </div>
                </div>
                <div>
                  <Badge color={actionColor(entry.action)}>{formatAction(entry.action)}</Badge>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {entry.entityType}
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  {entry.entityId ? `ID: ${entry.entityId.slice(-6)}` : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isExpanded ? (
                    <ChevronUp size={14} color="var(--color-text-muted)" />
                  ) : (
                    <ChevronDown size={14} color="var(--color-text-muted)" />
                  )}
                </div>
              </div>

              {isExpanded && (
                <div
                  style={{
                    padding: '12px 18px',
                    background: 'var(--color-input)',
                    borderBottom:
                      i < data.items.length - 1 ? '1px solid var(--color-border)' : 'none',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                  }}
                >
                  {entry.before && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--color-danger)',
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        Before
                      </div>
                      <pre
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {JSON.stringify(entry.before, null, 2)}
                      </pre>
                    </div>
                  )}
                  {entry.after && (
                    <div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--color-success)',
                          textTransform: 'uppercase',
                          marginBottom: 4,
                        }}
                      >
                        After
                      </div>
                      <pre
                        style={{
                          fontSize: 11,
                          color: 'var(--color-text-muted)',
                          margin: 0,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {JSON.stringify(entry.after, null, 2)}
                      </pre>
                    </div>
                  )}
                  {entry.reason && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        fontStyle: 'italic',
                      }}
                    >
                      Reason: {entry.reason}
                    </div>
                  )}
                  {!entry.before && !entry.after && !entry.reason && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      No additional details recorded.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            marginTop: 16,
          }}
        >
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={14} /> Prev
          </Button>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next <ChevronRight size={14} />
          </Button>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12,
        padding: '6px 14px',
        borderRadius: 20,
        border: `1px solid ${active ? 'var(--color-primary)' : 'var(--color-border)'}`,
        background: active ? 'var(--color-primary)' : 'var(--color-card)',
        color: active ? 'white' : 'var(--color-text-muted)',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function actionColor(action: string): 'success' | 'warning' | 'danger' | 'accent' | 'default' {
  if (action.includes('approve') || action.includes('activate')) return 'success';
  if (action.includes('reject') || action.includes('suspend') || action.includes('archive'))
    return 'danger';
  if (action.includes('role')) return 'warning';
  if (action.includes('create') || action.includes('update')) return 'accent';
  return 'default';
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  );
}
