import type { Context } from '@typedefs/public/Context.js';
import type {
  InternalRateLimitResult,
  InternalRateLimitStore,
  InternalRateLimitStrategy,
  InternalSlidingWindowCounterEntry,
} from '@typedefs/internal/modules/rateLimit/index.js';
import type { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
import { createInMemoryStore } from '@core/modules/rateLimit/stores/inMemory.ts';

/**
 * Sliding Window Counter Strategy
 *
 * Uses a weighted count of current and previous windows to provide accurate rate limiting
 * with minimal memory overhead.
 *
 * ## Algorithm:
 * 1. Track counts in current window and previous window
 * 2. Calculate weighted estimate based on time elapsed in current window
 * 3. Formula: current_count + (previous_count × (1 - elapsed_percentage))
 *
 * ## Example (100 req/15min window):
 * - Time: 8 minutes into current window
 * - Current window: 20 requests
 * - Previous window: 95 requests
 * - Estimated: 20 + (95 × (7/15)) = 20 + 44.33 = 64.33 requests
 *
 * ## Memory Efficiency:
 * - Only 3 numbers per IP: ~24 bytes
 * - vs Sliding Window Log: ~800 bytes (100 timestamps)
 * - 33x more efficient!
 *
 * @see https://en.wikipedia.org/wiki/Rate_limiting#Sliding_window_counter
 */
export class SlidingWindowCounterStrategy implements InternalRateLimitStrategy {
  private readonly _config: RateLimitConfig;
  private readonly _store: InternalRateLimitStore<InternalSlidingWindowCounterEntry>;

  constructor(config: RateLimitConfig) {
    this._config = config;
    this._store = createInMemoryStore<InternalSlidingWindowCounterEntry>();
  }

  /**
   * Check if request should be allowed using sliding window counter algorithm
   */
  check(context: Context<any>): InternalRateLimitResult {
    const key = this._config.keyGenerator(context);
    const now = Date.now();

    // Get or create entry for this client
    const entry: InternalSlidingWindowCounterEntry = this._store.get(key) ?? {
      currentWindowCount: 0,
      previousWindowCount: 0,
      windowStart: now,
    };

    // Check if we've moved to a new window
    const timeElapsed = now - entry.windowStart;

    if (timeElapsed >= this._config.window) {
      // Move to new window
      const windowsPassed = Math.floor(timeElapsed / this._config.window);

      if (windowsPassed === 1) {
        // Moved exactly one window forward
        entry.previousWindowCount = entry.currentWindowCount;
        entry.currentWindowCount = 0;
      } else {
        // Moved more than one window forward (user was inactive)
        entry.previousWindowCount = 0;
        entry.currentWindowCount = 0;
      }

      entry.windowStart = now;
    }

    // Calculate weighted count using sliding window formula
    const percentageIntoCurrentWindow = timeElapsed / this._config.window;
    const weightedPreviousCount = entry.previousWindowCount * (1 - percentageIntoCurrentWindow);
    const estimatedCount = entry.currentWindowCount + weightedPreviousCount;

    // Check if limit is exceeded
    const allowed = estimatedCount < this._config.max;

    if (allowed) {
      // Increment current window count
      entry.currentWindowCount++;
    }

    // Save updated entry
    this._store.set(key, entry);

    // Calculate remaining requests
    const remaining = Math.max(0, Math.floor(this._config.max - estimatedCount - (allowed ? 1 : 0)));

    // Calculate reset time (end of current window)
    const resetTime = entry.windowStart + this._config.window;

    return {
      allowed,
      remaining,
      resetTime,
      totalHits: Math.ceil(estimatedCount + (allowed ? 1 : 0)),
      limit: this._config.max,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this._store.clear();
  }
}
