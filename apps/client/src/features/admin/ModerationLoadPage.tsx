// Moderation Load dashboard — admin view of per-moderator performance and queue depth.
import { Shield, Users, Clock, BarChart3 } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { useModerationLoad } from './queries';

export function ModerationLoadPage() {
  const { data, isLoading } = useModerationLoad();

  if (isLoading) {
    return (
      <div>
        <SectionHeader title="Moderation Load" sub="Per-moderator performance and queue depth." />
        <Card>Loading…</Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="Moderation Load" sub="Per-moderator performance and queue depth." />

      {/* Top-line stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
          marginBottom: 24,
        }}
      >
        <StatCard
          label="Pending Queue Depth"
          value={data?.pendingQueueDepth ?? 0}
          icon={Shield}
          color="var(--color-warning)"
        />
        <StatCard
          label="Active Moderators"
          value={data?.moderators.length ?? 0}
          icon={Users}
          color="var(--color-primary)"
        />
        <StatCard
          label="Categories with Backlog"
          value={data?.categoryBacklog.length ?? 0}
          icon={BarChart3}
          color="var(--color-danger)"
        />
      </div>

      {/* Moderator table */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Moderator Performance</div>
      <Card style={{ padding: 0, overflow: 'hidden', marginBottom: 24 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr 1fr',
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
          <div>Moderator</div>
          <div>Approved</div>
          <div>Rejected</div>
          <div>This Week</div>
          <div>Avg. Response</div>
        </div>

        {(data?.moderators.length ?? 0) === 0 && (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              fontSize: 13,
              color: 'var(--color-text-muted)',
            }}
          >
            No moderation activity recorded yet.
          </div>
        )}

        {data?.moderators.map((mod, i) => (
          <div
            key={mod.moderatorId}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 0.8fr 0.8fr 0.8fr 1fr',
              gap: 10,
              padding: '12px 18px',
              borderBottom:
                i < data.moderators.length - 1 ? '1px solid var(--color-border)' : 'none',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{mod.name}</div>
              <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{mod.email}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-success)' }}>
              {mod.totalApprovals}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)' }}>
              {mod.totalRejections}
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-primary)' }}>
              {mod.approvalsThisWeek}
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--color-text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <Clock size={12} />
              {mod.avgResponseTimeHours}h
            </div>
          </div>
        ))}
      </Card>

      {/* Category backlog */}
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Category Backlog</div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 10,
        }}
      >
        {(data?.categoryBacklog.length ?? 0) === 0 && (
          <Card style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              No pending items in any category.
            </div>
          </Card>
        )}
        {data?.categoryBacklog.map((cat) => (
          <Card key={cat.category} style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-warning)' }}>
              {cat.count}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>
              {cat.category}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Shield;
  color: string;
}) {
  return (
    <Card style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 10,
            background: `${color}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={20} color={color} />
        </div>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</div>
        </div>
      </div>
    </Card>
  );
}
