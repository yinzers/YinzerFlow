import type { InternalRateLimitResult, InternalRateLimitStrategy } from '@typedefs/internal/modules/rateLimit/index.js';
import type { Context } from '@typedefs/public/Context.js';
import { SlidingWindowCounterStrategy } from '@core/modules/rateLimit/strategies/SlidingWindowCounterStrategy.ts';
import type { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
/**
 * Calculate the retry-after value in seconds
 */
const _calculateRetryAfter = (resetTime: number): number => Math.ceil((resetTime - Date.now()) / 1000);

/**
 * Factory function to create the appropriate rate limiting strategy
 *
 * @param config - Rate limit configuration
 * @returns Strategy instance based on configured algorithm
 * @throws Error if algorithm is not supported
 */
const _createStrategy = (config: RateLimitConfig): InternalRateLimitStrategy =>
  // Currently only one algorithm is implemented
  // When adding more algorithms, refactor to switch statement:
  // switch (config.algorithm) {
  //   case rateLimitAlgorithm.slidingWindowCounter:
  //     return new SlidingWindowCounterStrategy(config);
  //   case rateLimitAlgorithm.tokenBucket:
  //     return new TokenBucketStrategy(config);
  //   default:
  //     throw new Error(`Algorithm "${config.algorithm}" is not implemented`);
  // }
  new SlidingWindowCounterStrategy(config);

/**
 * RateLimiter class with pluggable algorithm support
 *
 * Uses the Strategy Pattern to support multiple rate limiting algorithms:
 * - **Sliding Window Counter**: Memory efficient, Redis-ready, 99%+ accurate (default)
 * - **Token Bucket**: (Future) Smooth traffic patterns with continuous refill
 *
 * ## Architecture
 *
 * The RateLimiter acts as a facade that delegates to algorithm-specific strategy classes.
 * This makes it easy to add new algorithms without modifying existing code.
 *
 * ## Memory Efficiency
 *
 * - Sliding Window Counter: ~24 bytes per IP (3 numbers)
 * - vs Sliding Window Log: ~800 bytes per IP (100 timestamps)
 * - **33x more memory efficient!**
 *
 * ## Usage
 *
 * @example
 * ```typescript
 * // In-memory rate limiter (default)
 * const limiter = new RateLimiter({
 *   algorithm: 'sliding-window-counter', // Default
 *   window: 60000,  // 1 minute
 *   max: 10,        // 10 requests per minute
 *   standardHeaders: true,
 *   skipSuccessfulRequests: false,
 *   skipFailedRequests: false,
 *   keyGenerator: (ctx) => ctx.request.ipAddress,
 *   handler: (ctx) => ({ success: false, message: 'Too many requests' })
 * });
 *
 * // Redis-based rate limiter (for production)
 * import Redis from 'ioredis';
 * const redis = new Redis({ host: 'localhost', port: 6379 });
 *
 * const redisLimiter = new RateLimiter({
 *   algorithm: 'sliding-window-counter',
 *   window: '15m',
 *   max: 100,
 *   keyGenerator: (ctx) => ctx.request.ipAddress,
 *   handler: (ctx) => ({ success: false, message: 'Rate limit exceeded' })
 * }, {
 *   type: 'redis',
 *   redis: {
 *     client: redis,
 *     keyPrefix: 'myapp:rate_limit:',
 *     defaultTtl: 3600
 *   }
 * });
 *
 * const result = limiter.check(context);
 * if (!result.allowed) {
 *   // Rate limit exceeded
 *   context.response.setStatusCode(429);
 *   return { error: 'Too many requests', retryAfter: result.resetTime };
 * }
 * ```
 *
 * @see {@link SlidingWindowCounterStrategy} for algorithm details
 */
export class RateLimiter {
  private readonly _config: RateLimitConfig;
  private readonly _strategy: InternalRateLimitStrategy;

  constructor(config: RateLimitConfig) {
    this._config = config;
    this._strategy = _createStrategy(config);
  }

  /**
   * Check if a request should be allowed
   *
   * Delegates to the configured strategy (sliding window counter, token bucket, etc.)
   * to determine if the request is within rate limits.
   *
   * @param context - Request context containing IP and identifying information
   * @returns Result indicating if request is allowed and current limit status
   *
   * @example
   * ```typescript
   * const result = limiter.check(context);
   *
   * if (result.allowed) {
   *   // Request is allowed
   *   console.log(`Remaining: ${result.remaining}/${result.limit}`);
   * } else {
   *   // Rate limit exceeded
   *   const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
   *   console.log(`Rate limit exceeded. Retry after ${retryAfter}s`);
   * }
   * ```
   */
  async check(context: Context<any>): Promise<InternalRateLimitResult> {
    return this._strategy.check(context);
  }

  /**
   * Destroy the rate limiter and clean up resources
   * Call this when shutting down the server to free memory
   *
   * @example
   * ```typescript
   * const limiter = new RateLimiter(config);
   * // ... use limiter ...
   * limiter.destroy(); // Clean up on shutdown
   * ```
   */
  async destroy(): Promise<void> {
    await this._strategy.destroy();
  }

  get config(): RateLimitConfig {
    return this._config;
  }
}

/**
 * Add standard rate limit headers to response
 *
 * Implements RFC draft standard headers:
 * - RateLimit-Limit: Maximum requests per window
 * - RateLimit-Remaining: Requests remaining in current window
 * - RateLimit-Reset: Time when the rate limit resets (Unix timestamp)
 * - Retry-After: Seconds until the client can retry (only when limit exceeded)
 *
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-ratelimit-headers
 */
export const addRateLimitHeaders = (context: Context<any>, result: InternalRateLimitResult): void => {
  // Standard rate limit headers (RFC draft)
  context.response.addHeaders({
    'RateLimit-Limit': String(result.limit),
    'RateLimit-Remaining': String(result.remaining),
    'RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)), // Unix timestamp in seconds
  });

  // Add Retry-After header when limit is exceeded
  if (!result.allowed) {
    const retryAfter = _calculateRetryAfter(result.resetTime);
    context.response.addHeaders({
      'Retry-After': String(retryAfter),
    });
  }
};
