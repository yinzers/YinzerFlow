import { log } from '@core/utils/log.ts';
import type {
  InternalInMemoryRateLimitStore,
  InternalInMemoryStoreOptions,
  InternalRateLimitStoreSetOptions,
} from '@typedefs/internal/modules/rateLimit/index.js';

/** Sweep at least once a minute, or once per window when the window is shorter. */
const _maxSweepIntervalMs = 60_000;

/**
 * Create a bounded in-memory store for rate-limit entries.
 *
 * ## Memory bound
 *
 * - **Expiry**: an entry expires `ttlMs` after its last write. Expired entries are dropped lazily on
 *   read and by a periodic sweep (an unref'd timer, so it never keeps the process alive; cleared by
 *   `destroy`).
 * - **Cap**: at most `maxEntries` entries. When a new key arrives at the cap, expired entries are swept
 *   first; if the store is still full, the least-recently-written unblocked entry is evicted. That
 *   client's count restarts, which is the same thing an attacker already gets by rotating addresses,
 *   while every active client (one that keeps writing) stays at the young end and keeps its count.
 *   Clients written with `pinned` (at their limit) are evicted only once no unblocked entry is left,
 *   so a flood of new addresses can't free a blocked client. New keys are never let through unlimited.
 *
 * ## Performance
 *
 * `set` re-inserts the key, so Map order is last-write order. Every entry shares one TTL, so that is
 * also expiry order: eviction takes the first key (O(1)) and a sweep stops at the first live entry.
 */
export const createInMemoryStore = <T>({ ttlMs, maxEntries }: InternalInMemoryStoreOptions): InternalInMemoryRateLimitStore<T> => {
  // Two Maps, both in last-write (= expiry) order: clients that are under their limit, and pinned clients that
  // have used their window. Eviction drains `entries` first and touches `pinned` only when it is empty, so a
  // filler run of new addresses can't evict (and so reset) a blocked client.
  const entries = new Map<string, { value: T; expiresAt: number }>();
  const pinned = new Map<string, { value: T; expiresAt: number }>();
  let hasWarnedAtCap = false;

  const sweepMap = (map: Map<string, { value: T; expiresAt: number }>, now: number): void => {
    for (const [key, entry] of map) {
      if (entry.expiresAt > now) break;
      map.delete(key);
    }
  };

  const sweep = (): void => {
    const now = Date.now();
    sweepMap(entries, now);
    sweepMap(pinned, now);
  };

  const size = (): number => entries.size + pinned.size;

  const evictOldest = (): void => {
    const victims = entries.size > 0 ? entries : pinned;
    const oldestKey = victims.keys().next().value;
    if (oldestKey !== undefined) victims.delete(oldestKey);
    if (!hasWarnedAtCap) {
      hasWarnedAtCap = true;
      log.warn(
        `[RATE LIMIT] In-memory store reached its cap of ${maxEntries} clients; evicting the least recently seen. ` +
          'Raise rateLimit.store.maxEntries or use the Redis store if you expect this many distinct clients per window.',
      );
    }
  };

  const sweepTimer = setInterval(sweep, Math.min(ttlMs, _maxSweepIntervalMs));
  sweepTimer.unref();

  return {
    get: async (key: string): Promise<T | undefined> => {
      const map = pinned.has(key) ? pinned : entries;
      const entry = map.get(key);
      if (!entry) return Promise.resolve(undefined);
      if (entry.expiresAt <= Date.now()) {
        map.delete(key);
        return Promise.resolve(undefined);
      }
      return Promise.resolve(entry.value);
    },
    set: async (key: string, value: T, options?: InternalRateLimitStoreSetOptions): Promise<void> => {
      // Delete first so the key moves to the young end of whichever Map it lands in
      entries.delete(key);
      pinned.delete(key);
      if (size() >= maxEntries) {
        sweep();
        if (size() >= maxEntries) evictOldest();
      }
      (options?.pinned ? pinned : entries).set(key, { value, expiresAt: Date.now() + ttlMs });
      return Promise.resolve();
    },
    delete: async (key: string): Promise<void> => {
      entries.delete(key);
      pinned.delete(key);
      return Promise.resolve();
    },
    destroy: async (): Promise<void> => {
      clearInterval(sweepTimer);
      entries.clear();
      pinned.clear();
      return Promise.resolve();
    },
    sweep,
    size,
  };
};
