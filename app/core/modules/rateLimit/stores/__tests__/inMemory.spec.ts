import { afterEach, describe, expect, it, setSystemTime } from 'bun:test';
import { createInMemoryStore } from '@core/modules/rateLimit/stores/inMemory.ts';
import type { InternalInMemoryRateLimitStore } from '@typedefs/internal/modules/rateLimit/index.js';

// Bug: the in-memory store never deleted keys, so with rate limiting on by default every client IP
// (IPv6 /64 rotation included) leaked one entry forever. Tier: High (unbounded memory under untrusted input).
describe('In-memory rate-limit store bound', () => {
  const windowMs = 60_000;
  const halfWindowMs = 30_000;
  const startTime = new Date('2026-01-01T00:00:00Z');
  let store: InternalInMemoryRateLimitStore<number> | undefined;

  afterEach(async () => {
    setSystemTime();
    await store?.destroy();
  });

  it('drops entries whose window has passed on sweep, and keeps live ones', async () => {
    setSystemTime(startTime);
    store = createInMemoryStore<number>({ ttlMs: windowMs, maxEntries: 100 });
    await store.set('expired-a', 1);
    await store.set('expired-b', 1);

    setSystemTime(new Date(startTime.getTime() + halfWindowMs));
    await store.set('live', 1);

    setSystemTime(new Date(startTime.getTime() + windowMs));
    store.sweep();

    expect(store.size()).toBe(1);
    expect(await store.get('live')).toBe(1);
    expect(await store.get('expired-a')).toBeUndefined();
  });

  it('never holds more than maxEntries and evicts the least recently written client', async () => {
    setSystemTime(startTime);
    const maxEntries = 3;
    store = createInMemoryStore<number>({ ttlMs: windowMs, maxEntries });
    await store.set('a', 1);
    await store.set('b', 1);
    await store.set('c', 1);
    await store.set('a', 2); // `a` is active again, so `b` is now the least recently written

    for (const rotatedAddress of ['d', 'e']) await store.set(rotatedAddress, 1);

    expect(store.size()).toBe(maxEntries);
    expect(await store.get('a')).toBe(2);
    expect(await store.get('b')).toBeUndefined();
    expect(await store.get('c')).toBeUndefined();
    expect(await store.get('e')).toBe(1);
  });

  // Bug: at the cap the oldest entry was evicted even when that client was blocked, so a filler run of new
  // addresses reset a blocked client's count and let it straight back in. Tier: High.
  it('keeps a pinned (blocked) client through a filler run that fills the cap', async () => {
    setSystemTime(startTime);
    const maxEntries = 3;
    store = createInMemoryStore<number>({ ttlMs: windowMs, maxEntries });
    await store.set('blocked', 99, { pinned: true });

    for (let i = 0; i < 10; i++) await store.set(`filler-${i}`, 1);

    expect(store.size()).toBe(maxEntries);
    expect(await store.get('blocked')).toBe(99);
    expect(await store.get('filler-9')).toBe(1);
  });
});
