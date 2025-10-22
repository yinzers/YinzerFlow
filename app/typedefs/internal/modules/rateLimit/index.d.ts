import type { Context } from '@typedefs/public/Context.js';

/**
 * Internal types for rate limiting module
 *
 * All rate limiting related types are consolidated here for easier maintenance.
 * This includes strategy interfaces, store types, handler types, and result types.
 */

// ============================================
// Strategy Pattern Types
// ============================================

/**
 * Result returned from rate limit check
 */
export interface InternalRateLimitResult {
  /**
   * Whether the request is allowed
   */
  allowed: boolean;

  /**
   * Number of requests remaining in current window
   */
  remaining: number;

  /**
   * Unix timestamp (ms) when the rate limit resets
   */
  resetTime: number;

  /**
   * Total number of hits in the current window
   */
  totalHits: number;

  /**
   * Maximum requests allowed per window
   */
  limit: number;
}

/**
 * Interface that all rate limiting strategy implementations must follow
 *
 * This allows different algorithms (sliding window counter, token bucket, etc.)
 * to be used interchangeably while maintaining the same API.
 */
export interface InternalRateLimitStrategy {
  /**
   * Check if a request should be allowed and record it
   *
   * @param context - Request context containing IP and other identifying information
   * @returns Result indicating if request is allowed and current limit status
   */
  check: (context: Context<any>) => InternalRateLimitResult;

  /**
   * Clean up any resources (intervals, timers, etc.)
   * Called when shutting down the server
   */
  destroy: () => void;
}

// ============================================
// Storage Types
// ============================================

/**
 * Sliding Window Counter entry
 * Tracks request counts in current and previous windows
 */
export interface InternalSlidingWindowCounterEntry {
  /**
   * Number of requests in the current window
   */
  currentWindowCount: number;

  /**
   * Number of requests in the previous window
   */
  previousWindowCount: number;

  /**
   * Timestamp when the current window started (ms)
   */
  windowStart: number;
}

/**
 * Generic rate limiter store interface for tracking data per client
 */
export interface InternalRateLimitStore<T> {
  get: (key: string) => T | undefined;
  set: (key: string, value: T) => void;
  delete: (key: string) => void;
  clear: () => void;
  size: () => number;
  entries: () => IterableIterator<[string, T]>;
}
