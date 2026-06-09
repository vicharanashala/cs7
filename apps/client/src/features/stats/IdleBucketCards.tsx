// Single card showing how many open community questions fall into each idle bucket.
// Three buckets are stacked vertically with dividers, each row is clickable.
// Reused on Student Home (inline with stat cards), Moderator Overview, and Admin Overview.
import { useNavigate } from 'react-router-dom';
import { Clock, AlertTriangle, Flame, Activity, ChevronRight } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { useCommunityIdleBuckets } from './queries';
import type { IdleBucket } from './api';

export function IdleBucketCards({ style }: { style?: React.CSSProperties }) {
  const { data, isLoading } = useCommunityIdleBuckets();
  const navigate = useNavigate();

  const goToBucket = (bucket: IdleBucket) => navigate(`/community?idle=${bucket}`);

  const buckets = [
    {
      label: 'Active in last ...',
      sub: 'Open Q&A with recent activity',
      value: data?.last24h ?? (isLoading ? '…' : 0),
      icon: Flame,
      color: '#16a34a',
      iconColor: '#22c55e',
      bucket: 'last24h' as IdleBucket,
    },
    {
      label: 'Idle > 3 days',
      sub: 'Needs a nudge',
      value: data?.over3days ?? (isLoading ? '…' : 0),
      icon: Clock,
      color: '#ea580c',
      iconColor: '#f97316',
      bucket: 'over3days' as IdleBucket,
    },
    {
      label: 'Idle > 1 week',
      sub: 'Stalled — review or close',
      value: data?.over1week ?? (isLoading ? '…' : 0),
      icon: AlertTriangle,
      color: '#dc2626',
      iconColor: '#ef4444',
      bucket: 'over1week' as IdleBucket,
    },
  ];

  return (
    <Card
      style={{
        padding: 0,
        overflow: 'hidden',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '16px 20px',
          background: '#ffffff',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: '#ede9fe',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Activity size={18} color="#7c3aed" />
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
          Open
          <br />
          Community Q&A
        </div>
      </div>

      {/* Bucket rows */}
      {buckets.map(({ label, sub, value, icon: Icon, color, iconColor, bucket }, i) => (
        <button
          key={bucket}
          onClick={() => goToBucket(bucket)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 14,
            padding: '18px 20px',
            background: '#ffffff',
            border: 'none',
            borderBottom: i < buckets.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'inherit',
            flex: 1,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              background: `${color}15`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon size={20} color={iconColor} strokeWidth={2.5} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: '#0f172a',
                  lineHeight: 1,
                  marginBottom: 8,
                  width: 24,
                }}
              >
                {value}
              </div>
              <div style={{ alignSelf: 'flex-start', color: '#cbd5e1', marginLeft: 'auto' }}>
                <ChevronRight size={18} />
              </div>
            </div>

            <div style={{ fontSize: 13, color: '#334155', fontWeight: 600, marginBottom: 2 }}>
              {label}
            </div>
            <div style={{ fontSize: 12, color, fontWeight: 500 }}>{sub}</div>
          </div>
        </button>
      ))}
    </Card>
  );
}
