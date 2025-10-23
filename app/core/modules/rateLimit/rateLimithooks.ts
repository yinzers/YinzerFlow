import { RateLimiter, addRateLimitHeaders } from '@core/modules/rateLimit/RateLimiter.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';

import { _convertTimeToMs } from '@core/utils/time.ts';
import type { RateLimitOptions } from '@typedefs/public/RateLimit.js';
import { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.js';

/**
 * Create a rate limiting hook for use in route options
 *
 * This function creates a beforeRoute hook that implements rate limiting
 * for a specific route. When used in beforeRoute, it will apply AFTER the
 * global rate limit (if enabled), making it additive. To skip global rate
 * limiting and use only per-route, combine with skipRateLimit().
 *
 * @example
 * ```typescript
 * import { rateLimit, skipRateLimit } from 'yinzerflow';
 *
 * // Strict rate limiting IN ADDITION to global limit
 * app.get('/api/expensive',
 *   { beforeRoute: [rateLimit({ max: 5, windowMs: 60000 })] },
 *   async (ctx) => {
 *     return { data: 'expensive computation' };
 *   }
 * );
 *
 * // ONLY per-route rate limiting (skip global)
 * app.post('/api/auth/login',
 *   {
 *     beforeRoute: [
 *       skipRateLimit(), // Skip global
 *       rateLimit({ max: 5, windowMs: 15 * 60 * 1000 }) // Apply route-specific
 *     ]
 *   },
 *   async (ctx) => {
 *     // Login logic
 *   }
 * );
 * ```
 */
export const rateLimitHook =
  <T extends HandlerCallbackGenerics>(rateLimitOptions: RateLimitOptions): HandlerCallback<T> =>
  // Return the hook function
  async (context) => {
    const rateLimitConfig = new RateLimitConfig(rateLimitOptions);
    const rateLimiter = new RateLimiter(rateLimitConfig);

    // Check if request is within rate limit
    const result = await rateLimiter.check(context);

    // Add headers if configured
    if (rateLimiter.config.standardHeaders) {
      addRateLimitHeaders(context, result);
    }

    // Check if limit exceeded
    if (!result.allowed) {
      return rateLimiter.config.handler<T>(context);
    }

    // Continue to next hook/handler
    return void 0;
  };

/**
 * Create a global rate limiting hook used internally by the framework
 *
 * This function is used to create the global rate limiting hook used internally by the framework
 */
export const _createGlobalRateLimitHook =
  <T extends HandlerCallbackGenerics>(rateLimiter: RateLimiter): HandlerCallback<T> =>
  // Return the hook function
  async (context) => {
    // Check if request is within rate limit
    const result = await rateLimiter.check(context);

    // Add headers if configured
    if (rateLimiter.config.standardHeaders) {
      addRateLimitHeaders(context, result);
    }

    // Check if limit exceeded
    if (!result.allowed) {
      return rateLimiter.config.handler(context);
    }

    // Continue to next hook/handler
    return void 0;
  };
