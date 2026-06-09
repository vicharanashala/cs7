import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 320,
        gap: 12,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 800 }}>404</div>
      <div style={{ color: 'var(--color-text-muted)' }}>That page doesn't exist.</div>
      <Link to="/">Back to home</Link>
    </div>
  );
}
