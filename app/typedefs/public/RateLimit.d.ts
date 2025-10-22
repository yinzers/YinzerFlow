import type { TimeString } from './Time.js';
import type { InternalRateLimitAlgorithm } from '@typedefs/constants/rateLimit.js';
import type { HandlerCallback } from '@typedefs/public/Context.js';

/**
 * Options for per-route rate limiting
 *
 * Allows overriding global rate limit settings for specific routes.
 * Use with the `rateLimit()` hook function in route options.
 *
 * @example
 * ```typescript
 * import { rateLimit } from 'yinzerflow';
 * import type { RateLimitOptions } from 'yinzerflow';
 *
 * // Using friendly time format
 * const options: RateLimitOptions = {
 *   max: 5,
 *   windowMs: '1m' // 1 minute
 * };
 *
 * // Or using milliseconds directly
 * const optionsMs: RateLimitOptions = {
 *   max: 5,
 *   windowMs: 60000 // 1 minute
 * };
 *
 * app.post('/api/auth/login',
 *   { beforeRoute: [rateLimit(options)] },
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
  algorithm?: InternalRateLimitAlgorithm;

  /**
   * Time window for rate limiting
   *
   * Accepts either:
   * - Friendly format: '30s', '15m', '2h', '1d'
   * - Milliseconds: 900000
   *
   * @default '15m' (15 minutes / 900000ms)
   *
   * @example
   * ```typescript
   * window: '30s'   // 30 seconds
   * window: '15m'   // 15 minutes
   * window: '2h'    // 2 hours
   * window: '1d'    // 1 day
   * window: 60000   // 1 minute (milliseconds)
   * ```
   */
  window?: TimeString | number;

  /**
   * Maximum requests per window
   * @default 100
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
   * Custom key generator function for identifying clients
   * @default (ctx) => ctx.request.ipAddress
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
  handler?: HandlerCallback<{ response: { success: false; message: string } }>;
}
