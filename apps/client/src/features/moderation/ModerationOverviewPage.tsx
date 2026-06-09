import { useAuth } from '../auth/AuthProvider';
import { ModerationQueueCards } from './ModerationQueueCards';

export function ModerationOverviewPage() {
  const { user } = useAuth();

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh', padding: '0 0 48px' }}>
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
          boxShadow: '0 12px 40px rgba(124,58,237,0.22)',
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
            position: 'absolute',
            bottom: -50,
            right: 120,
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.04)',
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
          Welcome back
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>
          {user?.name} 👋
        </div>
        <div style={{ fontSize: 12, opacity: 0.65 }}>
          Samagama Internship Portal · <strong>Moderator Dashboard</strong>
        </div>
      </div>

      {/* Section heading */}
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
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <span
          style={{
            fontSize: 19,
            fontWeight: 800,
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
          }}
        >
          Moderation Queue
        </span>
      </div>

      <ModerationQueueCards />
    </div>
  );
}
