import type { Redis } from 'ioredis';
import type { createClient } from 'redis';
import type { TimeString } from './Time.js';
import type { RateLimitAlgorithm, RateLimitStoreType } from '@typedefs/constants/rateLimit.js';

interface BaseStoreConfig {
  /** Type of the store @default 'memory' */
  type: RateLimitStoreType;
}

export type RedisClient = Redis | ReturnType<typeof createClient>;

export interface MemoryStoreConfig extends BaseStoreConfig {
  type: 'memory';
  /**
   * Maximum number of clients tracked at once @default 100000
   *
   * Entries expire one window after a client's last request and are swept periodically. If more distinct
   * clients than this arrive within one window, the least recently seen client's count is dropped (it starts
   * fresh); limiting is never skipped. Raise it, or use the Redis store, for very large client populations.
   */
  maxEntries?: number;
}

/**
 * Redis store configuration
 */
export interface RedisStoreConfig extends BaseStoreConfig {
  type: 'redis';
  /** Redis client instance of ioredis or redis */
  client: RedisClient;
  /** Key prefix for the rate limit keys @default 'rate_limit:' */
  keyPrefix?: string;
  /** Maximum number of connection retry attempts @default 3 */
  maxRetries?: number;
  /** Delay between retry attempts in milliseconds or time string @default '1s' */
  retryDelay?: TimeString | number;
}

/**
 * Configuration for rate limit store
 * This is a union type to future proof the code for other store types
 */
export type StoreConfig = MemoryStoreConfig | RedisStoreConfig;

/**
 * Options for per-route rate limiting
 *
 * Allows overriding global rate limit settings for specific routes.
 * Use with the `rateLimitHook()` hook function in route options.
 *
 * @example
 * ```typescript
 * import { rateLimitHook } from 'yinzerflow';
 * import type { RateLimitOptions } from 'yinzerflow';
 *
 * // Using friendly time format
 * const options: RateLimitOptions = {
 *   max: 5,
 *   window: '1m' // 1 minute
 * };
 *
 * // Or using milliseconds directly
 * const optionsMs: RateLimitOptions = {
 *   max: 5,
 *   window: 60000 // 1 minute
 * };
 *
 * app.post('/api/auth/login',
 *   { beforeRoute: [rateLimitHook(options)] },
 *   async (ctx) => {
 *     // Login logic
 *   }
 * );
 * ```
 */
export interface RateLimitOptions {
  /**
   * Enable or disable rate limiting
   * @default true
   * @example
   * ```typescript
   * enabled: true
   * ```
   */
  enabled?: boolean;

  /**
   * Rate limiting algorithm to use
   * @default 'sliding-window-counter'
   *
   * Available algorithms:
   * - 'sliding-window-counter': Memory efficient, Redis-ready, 99%+ accurate (recommended)
   * - 'token-bucket': (Future) Allows smooth traffic patterns with continuous refill
   *
   * @example
   * ```typescript
   * import { rateLimitAlgorithm } from 'yinzerflow';
   *
   * algorithm: rateLimitAlgorithm.slidingWindowCounter
   * ```
   */
  algorithm?: RateLimitAlgorithm;

  /**
   * Rate limiting store configuration
   *
   * Configure the storage backend for rate limiting data.
   * If not provided, defaults to in-memory storage.
   *
   * @example
   * ```typescript
   * // In-memory store (default)
   * const config = { algorithm: 'sliding-window-counter', window: '15m', max: 100 };
   *
   * // Redis store
   * const config = {
   *   algorithm: 'sliding-window-counter',
   *   window: '15m',
   *   max: 100,
   *   store: {
   *     type: 'redis',
   *     client: redisClient,
   *     keyPrefix: 'myapp:rate_limit:'
   *   }
   * };
   * ```
   */
  store?: StoreConfig;

  /**
   * Time window for rate limiting
   *
   * Accepts either:
   * - Friendly format: '30s', '15m', '2h', '1d'
   * - Milliseconds: 900000
   *
   * @default '1m' (1 minute / 60000ms)
   *
   * @example
   * ```typescript
   * window: '30s'   // 30 seconds
   * window: '15m'   // 15 minutes
   * window: '2h'    // 2 hours
   * window: '1d'    // 1 day
   * ```
   */
  window?: TimeString | number;

  /**
   * Maximum requests per window
   * @default 1000
   */
  max?: number;

  /**
   * Include standard rate limit headers in responses
   * @default true
   */
  standardHeaders?: boolean;

  /**
   * Skip counting successful requests (status < 400)
   * @default false
   */
  skipSuccessfulRequests?: boolean;

  /**
   * Skip counting failed requests (status >= 400)
   * @default false
   */
  skipFailedRequests?: boolean;

  /**
   * Store configuration
   * @default { type: 'memory' }
   */
  store?: StoreConfig;

  /**
   * Name of a `rateLimitHook()` budget, used as its Redis key namespace (`<keyPrefix>hook:<name>:`)
   *
   * Each `rateLimitHook()` call is one budget wherever the hook is used: GET and its automatic HEAD, several
   * routes sharing one hook, or a group hook all count against it. Without `name`, the namespace is a creation-order
   * number (`hook:#3`), counted over unnamed hooks only, which is the same on every node and after restarts only
   * while every node creates its unnamed hooks in the same order. Give every hook a unique `name` when several
   * nodes share one Redis. Hooks that share a `name` share one Redis counter; a warning is logged once if they
   * declare different `max` or `window`. Ignored by the
   * global limiter, whose keys always live under `<keyPrefix>global:`.
   *
   * @example
   * ```typescript
   * const loginLimit = rateLimitHook({ name: 'login', max: 5, window: '15m', store: redisStore });
   * ```
   */
  name?: string;

  /**
   * IPv6 prefix length the default key generator masks client addresses to @default 56
   *
   * One IPv6 customer usually holds a whole /64 or larger, so keying on the full address lets one client
   * rotate addresses for a fresh bucket each time. With the default, every address in the same /56 shares a
   * bucket (the same default as express-rate-limit v8). IPv4 and IPv4-mapped IPv6 (`::ffff:1.2.3.4`) are keyed
   * as the IPv4 address. Set `false` to key on the full IPv6 address. Ignored when you pass `keyGenerator`.
   */
  ipv6Subnet?: number | false;

  /**
   * Custom key generator function for identifying clients
   * @default the client IP, IPv6 masked to `ipv6Subnet` (see above)
   *
   * @example
   * ```typescript
   * // Rate limit by user ID instead of IP
   * keyGenerator: (ctx) => ctx.state.userId || ctx.request.ipAddress
   * ```
   */
  keyGenerator?: (context: Context<any>) => string;

  /**
   * Custom handler function called when rate limit is exceeded
   *
   * @param context - Request context
   * @param retryAfter - Seconds until the client can retry
   * @returns Response to send to client
   *
   * @example
   * ```typescript
   * handler: (ctx, retryAfter) => {
   *   ctx.response.setStatusCode(429);
   *   return {
   *     error: 'Too many requests',
   *     retryAfter,
   *     message: 'Please slow down'
   *   };
   * }
   * ```
   */
  handler?: HandlerCallback<T>;
}
