/**
 * Rate limiting algorithm types
 *
 * Available algorithms for rate limiting:
 * - sliding-window-counter: Memory efficient, Redis-ready, 99%+ accurate
 * - token-bucket: (Future) Allows smooth traffic patterns with continuous refill
 * - sliding-window-log: (Future) 100% accurate but memory intensive
 */
export const rateLimitAlgorithm = {
  slidingWindowCounter: 'sliding-window-counter',
  // tokenBucket: 'token-bucket', // Future enhancement
  // slidingWindowLog: 'sliding-window-log', // Future enhancement
} as const;

/**
 * Rate limiting store type options
 *
 * Available store types for rate limiting:
 * - memory: In-memory store
 * - redis: Redis store
 */
export const rateLimitStoreType = {
  memory: 'memory',
  redis: 'redis',
} as const;
