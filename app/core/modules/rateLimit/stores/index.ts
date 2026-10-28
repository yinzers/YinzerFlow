import { createInMemoryStore } from './inMemory.ts';
import { createRedisStore } from './redis.ts';
import type { InternalRateLimitStore } from '@typedefs/internal/modules/rateLimit/index.js';
import type { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';

/**
 * Default cap on in-memory rate-limit entries: roughly 20 MB of keys and counters, enough distinct
 * clients per window for a single-node app while keeping memory bounded under address rotation.
 */
const _defaultMemoryStoreMaxEntries = 100_000;

const createStoreFactories = <T>() =>
  ({
    memory: (config: RateLimitConfig) =>
      createInMemoryStore<T>({
        ttlMs: config.window,
        maxEntries: (config.store.type === 'memory' ? config.store.maxEntries : undefined) ?? _defaultMemoryStoreMaxEntries,
      }),
    redis: async (config: RateLimitConfig) => createRedisStore<T>(config),
  }) as const;

export const createRateLimitStore = async <T>(rateLimitConfig: RateLimitConfig): Promise<InternalRateLimitStore<T>> => {
  const storeFactories = createStoreFactories<T>();
  const factory = storeFactories[rateLimitConfig.store.type];
  if (!factory) throw new Error(`Unsupported store type: ${rateLimitConfig.store.type}`); // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- javascript compatibility
  return factory(rateLimitConfig);
};
