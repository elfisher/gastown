/**
 * Simple TTL cache for CLI command results.
 *
 * Each entry stores a resolved value and an expiry timestamp.
 * Concurrent requests for the same key coalesce — only one CLI call runs.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/**
 * Get a cached value or compute it. Concurrent calls with the same key
 * share a single in-flight promise (request coalescing).
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) return entry.value;

  // Coalesce concurrent requests
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const promise = fn().then((value) => {
    store.set(key, { value, expiresAt: now + ttlMs });
    inflight.delete(key);
    return value;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}

/** Invalidate a single key or all keys matching a prefix. */
export function invalidate(keyOrPrefix?: string): void {
  if (!keyOrPrefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix + ":")) {
      store.delete(k);
    }
  }
}
