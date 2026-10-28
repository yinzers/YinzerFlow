import { RateLimiter, addRateLimitHeaders } from '@core/modules/rateLimit/RateLimiter.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';

import { _convertTimeToMs } from '@core/utils/time.ts';
import type { RateLimitOptions } from '@typedefs/public/RateLimit.js';
import { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.js';

/** Hook instance -> the limiter it owns, so the app can destroy every limiter it holds on close(). */
const _hookLimiters = new WeakMap<object, RateLimiter>();

/** Creation-order counter naming hooks created without `name`. */
let _unnamedHookCount = 0;

/**
 * Give a Redis store config its own key namespace: keys become `<keyPrefix><namespace>:<client key>`. The
 * global limiter uses `global` and each rateLimitHook `hook:<name>`, so no client key (a custom keyGenerator
 * can return anything) can collide with another limiter's keys on a shared client and prefix. The in-memory
 * store is already one per limiter, so it is returned unchanged.
 */
export const _withStoreNamespace = <O extends RateLimitOptions | undefined>(rateLimitOptions: O, namespace: string): O => {
  const store = rateLimitOptions?.store;
  if (store?.type !== 'redis') return rateLimitOptions;
  return { ...rateLimitOptions, store: { ...store, keyPrefix: `${store.keyPrefix ?? 'rate_limit:'}${namespace}:` } };
};

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
 *   { beforeRoute: [rateLimitHook({ max: 5, window: 60000 })] },
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
 *       rateLimitHook({ max: 5, window: '15m' }) // Apply route-specific
 *     ]
 *   },
 *   async (ctx) => {
 *     // Login logic
 *   }
 * );
 * ```
 */
export const rateLimitHook = <T extends HandlerCallbackGenerics>(rateLimitOptions: RateLimitOptions): HandlerCallback<T> => {
  // One budget per rateLimitHook() call, wherever the hook is used: GET and its automatic HEAD, several routes
  // sharing one hook, or a group hook all count against the same limiter (the express-rate-limit model).
  _unnamedHookCount += 1;
  const namespace = `hook:${rateLimitOptions.name ?? `#${_unnamedHookCount}`}`;
  return _createRateLimitHook<T>(rateLimitOptions, namespace);
};

/** Build one hook with its own limiter (and one store), created once, in its own Redis key namespace. */
const _createRateLimitHook = <T extends HandlerCallbackGenerics>(rateLimitOptions: RateLimitOptions, namespace: string): HandlerCallback<T> => {
  const rateLimiter = new RateLimiter(new RateLimitConfig(_withStoreNamespace(rateLimitOptions, namespace)));

  const hook: HandlerCallback<T> = async (context) => {
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
  _hookLimiters.set(hook, rateLimiter);
  return hook;
};

/** The limiter a rateLimitHook instance owns, or undefined for any other hook. */
export const _rateLimiterOfHook = (hook: HandlerCallback): RateLimiter | undefined => _hookLimiters.get(hook);

/**
 * Create a global rate limiting hook used internally by the framework
 *
 * This function is used to create the global rate limiting hook used internally by the framework
 */
export const _createGlobalRateLimitHook =
  <T extends HandlerCallbackGenerics>(rateLimiter: RateLimiter, onRateLimitHit?: (ip: string, path: string) => void): HandlerCallback<T> =>
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
      onRateLimitHit?.(context.request.ipAddress, context.request.path);
      return rateLimiter.config.handler(context);
    }

    // Continue to next hook/handler
    return void 0;
  };
