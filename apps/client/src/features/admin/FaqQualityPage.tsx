// FAQ Quality page — admin/moderator surface for content quality monitoring.
// Displays quality scores, classifications, and at-risk FAQs.
import { useState } from 'react';
import { AlertTriangle, Archive, Edit, RefreshCw } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { useFaqQuality } from './queries';
import type { FaqQualityRow } from './api';

type Filter = 'all' | 'rewrite' | 'archive';

export function FaqQualityPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const { data, isLoading } = useFaqQuality(filter);

  const counts = {
    all: data?.length ?? 0,
    rewrite: data?.filter((r) => r.classification === 'rewrite').length ?? 0,
    archive: data?.filter((r) => r.classification === 'archive').length ?? 0,
    good: data?.filter((r) => r.classification === 'good').length ?? 0,
  };

  return (
    <div>
      <SectionHeader
        title="FAQ Quality"
        sub="Monitor content health — identify FAQs needing rewrites or archival."
      />

      {/* Summary cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <ScoreCard label="Good" count={counts.good} color="var(--color-success)" />
        <ScoreCard label="Rewrite Candidates" count={counts.rewrite} color="var(--color-warning)" />
        <ScoreCard label="Archive Candidates" count={counts.archive} color="var(--color-danger)" />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {(['all', 'rewrite', 'archive'] as Filter[]).map((f) => (
          <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
            {f === 'all'
              ? 'All FAQs'
              : f === 'rewrite'
                ? 'Rewrite Candidates'
                : 'Archive Candidates'}
          </FilterChip>
        ))}
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2.5fr 0.6fr 0.6fr 0.6fr 0.6fr 0.8fr 0.8fr',
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
          <div>Title</div>
          <div>Score</div>
          <div>Helpful</div>
          <div>Flags</div>
          <div>Views</div>
          <div>Class</div>
          <div>Updated</div>
        </div>

        {isLoading && <div style={{ padding: 18, fontSize: 13 }}>Loading…</div>}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--color-text-muted)',
            }}
          >
            No FAQs match this filter.
          </div>
        )}

        {data?.map((row, i) => (
          <div
            key={row.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '2.5fr 0.6fr 0.6fr 0.6fr 0.6fr 0.8fr 0.8fr',
              gap: 10,
              padding: '12px 18px',
              borderBottom: i < data.length - 1 ? '1px solid var(--color-border)' : 'none',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{row.title}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{row.category}</div>
            </div>
            <div>
              <QualityScoreBar score={row.qualityScore} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {row.helpfulRatio}%
            </div>
            <div
              style={{
                fontSize: 12,
                color: row.flagCount > 0 ? 'var(--color-danger)' : 'var(--color-text-muted)',
              }}
            >
              {row.flagCount}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{row.viewCount}</div>
            <div>
              <Badge color={classificationColor(row.classification)}>{row.classification}</Badge>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {timeAgo(row.updatedAt)}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

function ScoreCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <Card style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: `${color}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 18, fontWeight: 700, color }}>{count}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</div>
      </div>
    </Card>
  );
}

function QualityScoreBar({ score }: { score: number }) {
  const color =
    score >= 70
      ? 'var(--color-success)'
      : score >= 40
        ? 'var(--color-warning)'
        : 'var(--color-danger)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 40,
          height: 6,
          borderRadius: 3,
          background: 'var(--color-border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 600, color }}>{score}</span>
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

function classificationColor(c: string): 'success' | 'warning' | 'danger' {
  if (c === 'good') return 'success';
  if (c === 'rewrite') return 'warning';
  return 'danger';
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
