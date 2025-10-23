import { Redis } from 'ioredis';
import type { RedisClientType } from 'redis';
import type { InternalRateLimitStore } from '@typedefs/internal/modules/rateLimit/index.js';
import { log } from '@core/utils/log.ts';
import { _convertTimeToMs } from '@core/utils/time.ts';
import type { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
import type { RedisClient } from '@typedefs/public/RateLimit.js';

/**
 * Create a Redis-based store for rate limiting data
 *
 * This store is designed to work with any rate limiting algorithm by providing
 * a generic key-value interface. It handles serialization/deserialization
 * and provides automatic key expiration.
 *
 * ## Features
 *
 * - **Algorithm agnostic**: Works with sliding window counter, token bucket, etc.
 * - **Automatic expiration**: Keys expire automatically to prevent memory leaks
 * - **JSON serialization**: Handles complex data structures
 * - **Error handling**: Graceful fallback on Redis errors
 * - **Debug logging**: Optional detailed logging for troubleshooting
 *
 * ## Usage
 *
 * ```typescript
 * import { createRedisStore } from '@core/modules/rateLimit/stores/redis.ts';
 * import Redis from 'ioredis';
 *
 * const redis = new Redis({
 *   host: 'localhost',
 *   port: 6379,
 *   retryDelayOnFailover: 100,
 * });
 *
 * const store = createRedisStore({
 *   client: redis,
 *   keyPrefix: 'myapp:rate_limit:',
 *   defaultTtl: 3600
 * });
 * ```
 *
 * ## Key Format
 *
 * Keys are formatted as: `{prefix}{algorithm}:{identifier}`
 *
 * Examples:
 * - `rate_limit:sliding_window_counter:192.168.1.100`
 * - `rate_limit:token_bucket:user:12345`
 * - `myapp:rate_limit:sliding_window_counter:api_key:abc123`
 *
 * @param config - Redis store configuration
 * @returns Rate limit store instance
 */
export const createRedisStore = async <T>(config: RateLimitConfig): Promise<InternalRateLimitStore<T>> => {
  const { store } = config;
  if (store.type !== 'redis') throw new Error(`Expected Redis store configuration but got: ${JSON.stringify(store)}`);
  const { client, keyPrefix = 'rate_limit:', maxRetries = 3, retryDelay = 1000 } = store;
  const retryDelayMs = _convertTimeToMs(retryDelay);
  let connectionHealthy = false;

  // Validate Redis connection with retry logic
  const _validateConnection = async (): Promise<void> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await client.ping();
        connectionHealthy = true;
        log.info(`[RedisStore] Successfully connected to Redis (attempt ${attempt})`);
        return;
      } catch (error) {
        log.warn(`[RedisStore] Redis connection attempt ${attempt}/${maxRetries} failed:`, error);

        if (attempt < maxRetries) {
          log.info(`[RedisStore] Retrying connection in ${retryDelay}...`);
          await new Promise<void>((resolve) => {
            setTimeout(resolve, retryDelayMs);
          });
        } else {
          log.error('[RedisStore] All Redis connection attempts failed. Store will operate in degraded mode.');
          connectionHealthy = false;
        }
      }
    }
  };

  // Initialize connection validation (non-blocking)
  await _validateConnection();

  return {
    get: async (key: string) => _get({ client, key, keyPrefix, connectionHealthy }),
    set: async (key: string, value: T) => _set({ client, config, key, value, keyPrefix, connectionHealthy }),
    delete: async (key: string) => _delete({ client, key, keyPrefix, connectionHealthy }),
    destroy: async () => _destroy({ client, keyPrefix, connectionHealthy }),
  };
};

/**
 * Build Redis key with prefix
 */
const _buildKey = (key: string, keyPrefix: string): string => `${keyPrefix}${key}`;

/**
 * Serialize value to JSON string
 */
const _serialize = <T>(value: T): string => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    log.error('[RedisStore] Failed to serialize value:', error);
    throw new Error('Failed to serialize rate limit data');
  }
};

/**
 * Deserialize JSON string to value
 */
const _deserialize = <T>(json: string): T => {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    log.error('[RedisStore] Failed to deserialize value:', error);
    throw new Error('Failed to deserialize rate limit data');
  }
};

/**
 * Handle Redis errors gracefully
 */
const _handleError = (operation: string, error: unknown, connectionHealthy: boolean): void => {
  if (connectionHealthy) {
    log.warn(`[RedisStore] Redis ${operation} failed (connection was healthy):`, error);
  } else {
    log.error(`[RedisStore] Redis ${operation} failed (connection unhealthy):`, error);
  }
  // Don't throw - allow the application to continue with degraded functionality
};

/**
 * Set key with TTL, handling both ioredis and redis package differences
 */
const _setWithTtl = async ({ client, key, value, ttlSeconds }: { client: RedisClient; key: string; value: string; ttlSeconds: number }): Promise<void> => {
  if (client instanceof Redis) {
    await client.set(key, value, 'EX', ttlSeconds);
  }

  await (client as RedisClientType).set(key, value, { EX: ttlSeconds });
};

/**
 * Get value from Redis
 */
const _get = async <T>({
  client,
  key,
  keyPrefix,
  connectionHealthy,
}: {
  client: RedisClient;
  key: string;
  keyPrefix: string;
  connectionHealthy: boolean;
}): Promise<T | undefined> => {
  try {
    const redisKey = _buildKey(key, keyPrefix);
    const value = await client.get(redisKey);

    if (value === null) {
      return undefined;
    }

    return _deserialize<T>(value);
  } catch (error) {
    _handleError('GET', error, connectionHealthy);
    return undefined;
  }
};

/**
 * Set value in Redis with TTL
 */
const _set = async <T>({
  client,
  config,
  key,
  value,
  keyPrefix,
  connectionHealthy,
}: {
  client: RedisClient;
  config: RateLimitConfig;
  key: string;
  value: T;
  keyPrefix: string;
  connectionHealthy: boolean;
}): Promise<void> => {
  try {
    const redisKey = _buildKey(key, keyPrefix);
    const serialized = _serialize(value);

    // Check if key exists first
    const exists = await client.exists(redisKey);

    if (exists) {
      // Key exists - update value but preserve TTL
      await client.set(redisKey, serialized);
    } else {
      // New key - set with TTL
      await _setWithTtl({ client, key: redisKey, value: serialized, ttlSeconds: Math.floor(config.window / 1000) });
    }
  } catch (error) {
    _handleError('SET', error, connectionHealthy);
  }
};

/**
 * Delete key from Redis
 */
const _delete = async ({
  client,
  key,
  keyPrefix,
  connectionHealthy,
}: {
  client: RedisClient;
  key: string;
  keyPrefix: string;
  connectionHealthy: boolean;
}): Promise<void> => {
  try {
    const redisKey = _buildKey(key, keyPrefix);
    await client.del(redisKey);
  } catch (error) {
    _handleError('DELETE', error, connectionHealthy);
  }
};

/**
 * Delete all keys related to this store
 */
const _destroy = async ({ client, keyPrefix, connectionHealthy }: { client: RedisClient; keyPrefix: string; connectionHealthy: boolean }): Promise<void> => {
  try {
    const pattern = `${keyPrefix}*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await Promise.all(keys.map(async (key) => client.del(key)));
      log.info(`[RedisStore] Destroyed ${keys.length} rate limit keys`);
    }
  } catch (error) {
    _handleError('DESTROY', error, connectionHealthy);
  }
};
