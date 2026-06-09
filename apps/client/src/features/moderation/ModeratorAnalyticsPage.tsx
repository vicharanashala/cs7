import { BarChart3, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useModeratorPersonalStats } from '../admin/queries';

export function ModeratorAnalyticsPage() {
  const { user } = useAuth();
  const { data, isLoading } = useModeratorPersonalStats();

  return (
    <div>
      {/* Welcome banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 60%, #4c1d95 100%)',
          borderRadius: 20,
          padding: '28px 32px',
          marginBottom: 24,
          color: 'white',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(124,58,237,0.25)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -40,
            right: -30,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.05)',
          }}
        />
        <div
          style={{
            fontSize: 11,
            opacity: 0.6,
            marginBottom: 4,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          My Performance
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>
          {user?.name ?? 'Moderator'} 📊
        </div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Samagama Internship Portal · <strong>Moderator Analytics</strong>
        </div>
      </div>

      {isLoading && (
        <div
          className="mod-card mod-card-blue"
          style={{ padding: 24, fontSize: 13, color: 'var(--color-text-muted)' }}
        >
          Loading…
        </div>
      )}

      {!isLoading && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 14,
              marginBottom: 20,
            }}
          >
            {[
              {
                label: 'Approvals Today',
                value: data?.approvalsToday ?? 0,
                icon: CheckCircle,
                color: 'var(--color-success)',
                cardClass: 'mod-card-green',
                sub: 'Since midnight',
              },
              {
                label: 'Approvals This Week',
                value: data?.approvalsThisWeek ?? 0,
                icon: CheckCircle,
                color: 'var(--color-primary)',
                cardClass: 'mod-card-blue',
                sub: 'Last 7 days',
              },
              {
                label: 'Total Approvals',
                value: data?.totalApprovals ?? 0,
                icon: BarChart3,
                color: 'var(--color-primary)',
                cardClass: 'mod-card-blue',
                sub: 'All time',
              },
              {
                label: 'Avg Response Time',
                value: `${data?.avgResponseTimeHours ?? 0}h`,
                icon: Clock,
                color: 'var(--color-warning)',
                cardClass: 'mod-card-orange',
                sub: 'Hours per item',
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`mod-card ${s.cardClass}`}
                style={{ padding: '18px 16px', position: 'relative', overflow: 'hidden' }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: `${s.color}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <s.icon size={20} color={s.color} />
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: 'var(--color-text)',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    marginBottom: 6,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    marginBottom: 3,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}
          >
            <div className="mod-card mod-card-green">
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
                  <CheckCircle size={17} color="var(--color-success)" />
                </div>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Resolution Breakdown
                </span>
              </div>
              <div style={{ padding: '14px 20px 20px' }}>
                <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
                  {[
                    {
                      n: data?.totalApprovals ?? 0,
                      label: 'Approved',
                      color: 'var(--color-success)',
                    },
                    {
                      n: data?.totalRejections ?? 0,
                      label: 'Rejected',
                      color: 'var(--color-danger)',
                    },
                    {
                      n: (data?.totalApprovals ?? 0) + (data?.totalRejections ?? 0),
                      label: 'Total',
                      color: 'var(--color-text)',
                    },
                  ].map((s) => (
                    <div key={s.label}>
                      <div
                        style={{
                          fontSize: 32,
                          fontWeight: 900,
                          color: s.color,
                          letterSpacing: '-0.04em',
                          lineHeight: 1,
                        }}
                      >
                        {s.n}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-text-muted)',
                          fontWeight: 600,
                          marginTop: 4,
                        }}
                      >
                        {s.label}
                      </div>
                    </div>
                  ))}
                </div>
                {(data?.totalApprovals ?? 0) + (data?.totalRejections ?? 0) > 0 && (
                  <>
                    <div
                      style={{
                        display: 'flex',
                        borderRadius: 6,
                        overflow: 'hidden',
                        height: 8,
                        marginBottom: 6,
                      }}
                    >
                      <div
                        style={{
                          width: `${((data?.totalApprovals ?? 0) / ((data?.totalApprovals ?? 0) + (data?.totalRejections ?? 0))) * 100}%`,
                          background: 'var(--color-success)',
                        }}
                      />
                      <div style={{ flex: 1, background: 'var(--color-danger)' }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {Math.round(
                        ((data?.totalApprovals ?? 0) /
                          ((data?.totalApprovals ?? 0) + (data?.totalRejections ?? 0))) *
                          100,
                      )}
                      % approval rate
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="mod-card mod-card-blue">
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 20px 0' }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--color-primary-bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BarChart3 size={17} color="var(--color-primary)" />
                </div>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Category Breakdown
                </span>
              </div>
              <div style={{ padding: '14px 20px 20px' }}>
                {!data?.categoryBreakdown || data.categoryBreakdown.length === 0 ? (
                  <div
                    style={{ fontSize: 13, color: 'var(--color-text-muted)', padding: '12px 0' }}
                  >
                    No category data yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {data.categoryBreakdown.map((cat) => {
                      const maxCount = data.categoryBreakdown[0]?.count ?? 1;
                      return (
                        <div key={cat.category}>
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: 5,
                            }}
                          >
                            <span
                              style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}
                            >
                              {cat.category}
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: 'var(--color-primary)',
                              }}
                            >
                              {cat.count}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 7,
                              borderRadius: 4,
                              background: 'var(--color-input)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${(cat.count / maxCount) * 100}%`,
                                height: '100%',
                                background: 'var(--color-primary)',
                                borderRadius: 4,
                                transition: 'width 0.3s ease',
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {data?.categoryBreakdown && data.categoryBreakdown.length > 0 && (
            <div
              className="mod-card mod-card-orange"
              style={{ padding: '16px 20px', display: 'flex', gap: 14, alignItems: 'flex-start' }}
            >
              <div style={{ fontSize: 20, flexShrink: 0 }}>💡</div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    marginBottom: 4,
                  }}
                >
                  Insight
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  You've handled the most items in{' '}
                  <strong>{data.categoryBreakdown[0]?.category}</strong> (
                  {data.categoryBreakdown[0]?.count} reviews).
                  {data.categoryBreakdown.length > 1 &&
                    ` Consider focusing on ${data.categoryBreakdown[data.categoryBreakdown.length - 1]?.category} to balance your workload.`}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
