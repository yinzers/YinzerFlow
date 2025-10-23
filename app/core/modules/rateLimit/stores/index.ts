import { createInMemoryStore } from './inMemory.ts';
import { createRedisStore } from './redis.ts';
import type { InternalRateLimitStore } from '@typedefs/internal/modules/rateLimit/index.js';
import type { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';

const createStoreFactories = <T>() =>
  ({
    memory: () => createInMemoryStore<T>(),
    redis: async (config: RateLimitConfig) => createRedisStore<T>(config),
  }) as const;

export const createRateLimitStore = async <T>(rateLimitConfig: RateLimitConfig): Promise<InternalRateLimitStore<T>> => {
  const storeFactories = createStoreFactories<T>();
  const factory = storeFactories[rateLimitConfig.store.type];
  if (!factory) throw new Error(`Unsupported store type: ${rateLimitConfig.store.type}`); // eslint-disable-line @typescript-eslint/no-unnecessary-condition -- javascript compatibility
  return factory(rateLimitConfig);
};
