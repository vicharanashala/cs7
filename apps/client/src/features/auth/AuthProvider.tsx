// Auth state. Boots from a stored refresh token, exposes login/logout, and keeps the user object in sync.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { AuthTokenPayload, LoginInput, PublicUser } from '@samagama/shared';
import { apiClient, sessionExpiry, tokenStorage } from '../../lib/api-client';

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const applyAuth = useCallback((payload: AuthTokenPayload) => {
    tokenStorage.setTokens(payload.accessToken, payload.refreshToken);
    setUser(payload.user);
  }, []);

  // On mount: restore session from stored tokens.
  // Try /me first; if that fails (e.g. access token expired), fall back to the refresh token
  // before giving up — so the 7-day refresh window is actually honoured.
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      const access = tokenStorage.getAccess();
      const refresh = tokenStorage.getRefresh();
      try {
        if (access) {
          try {
            // The 401 interceptor in api-client will silently refresh if needed and retry,
            // so a successful response here already means we're fully up to date.
            const res = await apiClient.get('/api/auth/me');
            if (!cancelled) setUser(res.data.data);
          } catch {
            // Interceptor couldn't refresh (e.g. refresh token was absent from storage at
            // intercept time). Try once more directly with the refresh token.
            if (refresh) {
              const res = await apiClient.post('/api/auth/refresh', { refreshToken: refresh });
              if (!cancelled) applyAuth(res.data.data);
            } else {
              throw new Error('no refresh token');
            }
          }
        } else if (refresh) {
          const res = await apiClient.post('/api/auth/refresh', { refreshToken: refresh });
          if (!cancelled) applyAuth(res.data.data);
        }
      } catch {
        // A stored session existed but couldn't be restored (refresh token aged out / revoked)
        // — that's a genuine expiry. A first-time visitor with no tokens is NOT flagged.
        if (access || refresh) sessionExpiry.mark();
        tokenStorage.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [applyAuth]);

  const login = useCallback(
    async (input: LoginInput) => {
      const res = await apiClient.post('/api/auth/login', input);
      // Fresh sign-in supersedes any prior expiry — clear the flag so the notice never lingers.
      sessionExpiry.clear();
      applyAuth(res.data.data);
    },
    [applyAuth],
  );

  const logout = useCallback(() => {
    // Intentional sign-out is not an expiry — make sure the notice can't show afterwards.
    sessionExpiry.clear();
    tokenStorage.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
