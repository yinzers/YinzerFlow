import type { InternalRateLimitStore } from '@typedefs/internal/modules/rateLimit/index.js';

/**
 * Create an in-memory store for sliding window counter data
 */
export const createInMemoryStore = <T>(): InternalRateLimitStore<T> => {
  const store = new Map<string, T>();

  return {
    get: async (key: string) => Promise.resolve(store.get(key)),
    set: async (key: string, value: T): Promise<void> => {
      store.set(key, value);
      return Promise.resolve();
    },
    delete: async (key: string): Promise<void> => {
      store.delete(key);
      return Promise.resolve();
    },
    destroy: async (): Promise<void> => {
      store.clear();
      return Promise.resolve();
    },
  };
};
