/** Simple TTL cache for CLI output. Deduplicates in-flight requests. */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 5_000;

export function cached<T>(key: string, fn: () => Promise<T>, ttlMs = DEFAULT_TTL_MS): Promise<T> {
  const now = Date.now();
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (entry && entry.expiresAt > now) return Promise.resolve(entry.value);

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = fn().then((value) => {
    store.set(key, { value, expiresAt: now + ttlMs });
    inflight.delete(key);
    return value;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, p);
  return p;
}

export function invalidate(keyPrefix?: string): void {
  if (!keyPrefix) { store.clear(); return; }
  for (const k of store.keys()) {
    if (k.startsWith(keyPrefix)) store.delete(k);
  }
}
