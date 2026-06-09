// Single axios instance. Reads the access token from localStorage on every request,
// so token rotation is picked up without further wiring.
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

const TOKEN_STORAGE_KEY = 'samagama:accessToken';
const REFRESH_STORAGE_KEY = 'samagama:refreshToken';
// Set ONLY when a previously-valid session can no longer be refreshed (a genuine expiry).
// The login page reads this once to decide whether to show the "session expired" notice.
// Kept in sessionStorage (not localStorage) so it never outlives the browser tab/session.
const SESSION_EXPIRED_KEY = 'samagama:sessionExpired';
// Stable per-browser identifier for anonymous actions (e.g. voting on FAQs from the login
// page). ObjectId-shaped (24 hex) so the server can slot it into its existing vote arrays.
const ANON_ID_KEY = 'samagama:anonId';

export const tokenStorage = {
  getAccess: (): string | null => localStorage.getItem(TOKEN_STORAGE_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_STORAGE_KEY),
  setTokens: (access: string, refresh: string): void => {
    localStorage.setItem(TOKEN_STORAGE_KEY, access);
    localStorage.setItem(REFRESH_STORAGE_KEY, refresh);
  },
  clear: (): void => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_STORAGE_KEY);
  },
};

// Single source of truth for "the session genuinely expired". Logout, fresh logins, and
// never-logged-in visits must NOT set this — only a failed token refresh does.
export const sessionExpiry = {
  mark: (): void => {
    try {
      sessionStorage.setItem(SESSION_EXPIRED_KEY, '1');
    } catch {
      /* storage unavailable — non-fatal */
    }
  },
  peek: (): boolean => {
    try {
      return sessionStorage.getItem(SESSION_EXPIRED_KEY) === '1';
    } catch {
      return false;
    }
  },
  clear: (): void => {
    try {
      sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    } catch {
      /* storage unavailable — non-fatal */
    }
  },
};

// 24-hex (ObjectId-shaped) random id. Uses the Web Crypto API when available.
function generateAnonId(): string {
  const bytes = new Uint8Array(12);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Stable anonymous id for this browser, created on first use and persisted. Lets the server
// attribute anonymous votes/views to a consistent (but unidentifiable) visitor.
export function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_ID_KEY);
    if (!id || !/^[0-9a-f]{24}$/.test(id)) {
      id = generateAnonId();
      localStorage.setItem(ANON_ID_KEY, id);
    }
    return id;
  } catch {
    return generateAnonId();
  }
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true,
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Always present so the server can attribute anonymous FAQ votes/views; it's ignored
  // whenever a valid Bearer token identifies a real user.
  config.headers['X-Anon-Id'] = getAnonId();
  return config;
});

// Queue of callers waiting for a refresh in flight.
let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

function drainQueue(newToken: string) {
  refreshQueue.forEach((resolve) => resolve(newToken));
  refreshQueue = [];
}

type RetryableConfig = InternalAxiosRequestConfig & { _retry?: boolean };

apiClient.interceptors.response.use(
  (res) => res,
  async (err: AxiosError) => {
    // Surface the API error envelope's message instead of axios's generic one when present.
    const apiMessage = (err?.response?.data as Record<string, any>)?.error?.message;
    if (apiMessage) err.message = apiMessage;

    const config = err.config as RetryableConfig | undefined;

    // Silent token refresh on 401. Skip for the refresh endpoint itself and retried requests.
    if (
      err.response?.status === 401 &&
      config &&
      !config._retry &&
      !config.url?.includes('/auth/refresh')
    ) {
      const refreshToken = tokenStorage.getRefresh();
      if (!refreshToken) {
        tokenStorage.clear();
        sessionExpiry.mark();
        window.location.replace('/login');
        return Promise.reject(err);
      }

      if (isRefreshing) {
        // Another refresh is already in flight — queue this request.
        return new Promise((resolve) => {
          refreshQueue.push((token: string) => {
            config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
            resolve(apiClient(config));
          });
        });
      }

      config._retry = true;
      isRefreshing = true;

      try {
        const baseURL = apiClient.defaults.baseURL ?? '';
        const res = await axios.post(
          `${baseURL}/api/auth/refresh`,
          { refreshToken },
          { timeout: 15_000 },
        );
        const { accessToken, refreshToken: newRefresh } = res.data.data;
        tokenStorage.setTokens(accessToken, newRefresh);
        // Refresh succeeded — the session is healthy, so drop any stale expiry flag.
        sessionExpiry.clear();
        drainQueue(accessToken);
        config.headers = { ...config.headers, Authorization: `Bearer ${accessToken}` };
        return apiClient(config);
      } catch {
        refreshQueue = [];
        tokenStorage.clear();
        sessionExpiry.mark();
        window.location.replace('/login');
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  },
);
