// Tiny in-memory TTL cache.
//
// Why not Redis: this MVP runs as a single Node process. Adding Redis means a new daemon,
// a new env var, and an outage path. An in-process Map covers the hot path (repeated
// "Check Existing Answers" clicks within a session) and is one file to swap when we scale.
//
// Behavior:
//   - get(key) returns the value if it exists AND has not expired; null otherwise.
//   - set(key, value) stores with the configured TTL.
//   - Lazy eviction on read (no background timer). When the cache grows past `maxEntries`,
//     the oldest 10% of entries are removed at the next set().

interface Entry<V> {
  value: V;
  /** Absolute expiry time in epoch ms. */
  expiresAt: number;
}

export interface TtlCache<V> {
  get(key: string): V | null;
  set(key: string, value: V): void;
  delete(key: string): void;
  clear(): void;
  size(): number;
}

export interface TtlCacheOptions {
  /** Time-to-live in milliseconds. */
  ttlMs: number;
  /** Max entries before eviction kicks in. Default 500. */
  maxEntries?: number;
}

export function createTtlCache<V>({ ttlMs, maxEntries = 500 }: TtlCacheOptions): TtlCache<V> {
  const store = new Map<string, Entry<V>>();

  const evictExpired = (now: number): void => {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
  };

  return {
    get(key) {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value) {
      const now = Date.now();
      if (store.size >= maxEntries) {
        evictExpired(now);
        // Still over capacity — drop the oldest 10% (insertion order is preserved by Map).
        if (store.size >= maxEntries) {
          const dropCount = Math.max(1, Math.floor(maxEntries * 0.1));
          let dropped = 0;
          for (const key of store.keys()) {
            store.delete(key);
            if (++dropped >= dropCount) break;
          }
        }
      }
      store.set(key, { value, expiresAt: now + ttlMs });
    },
    delete(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
    size() {
      return store.size;
    },
  };
}
