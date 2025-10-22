import type { InternalRateLimitStore } from '@typedefs/internal/modules/rateLimit/index.js';

/**
 * Create an in-memory store for sliding window counter data
 */
export const createInMemoryStore = <T>(): InternalRateLimitStore<T> => {
  const store = new Map<string, T>();

  return {
    get: (key: string) => store.get(key),
    set: (key: string, value: T) => store.set(key, value),
    delete: (key: string) => store.delete(key),
    clear: () => store.clear(),
    size: () => store.size,
    entries: () => store.entries(),
  };
};
