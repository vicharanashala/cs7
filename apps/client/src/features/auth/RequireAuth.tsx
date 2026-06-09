// Auth gate. Redirects to /login when there's no user; shows a minimal splash while bootstrapping.
import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthProvider';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-text-muted)',
        }}
      >
        Loading…
      </div>
    );
  }

  if (!user) {
    // No user here covers logout and never-logged-in visits too — neither is a session
    // expiry, so we don't flag one. `from` lets the login page return the user afterwards;
    // a genuine expiry is signalled separately via the sessionExpiry flag (see api-client).
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}
