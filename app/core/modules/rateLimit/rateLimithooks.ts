import { RateLimiter, addRateLimitHeaders } from '@core/modules/rateLimit/RateLimiter.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';

import { _convertTimeToMs } from '@core/utils/time.ts';
import type { RateLimitOptions } from '@typedefs/public/RateLimit.js';
import { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.js';

/** Unbound rateLimitHook instance -> factory for a clone bound to one route registration. */
const _routeBinders = new WeakMap<object, (routeId: string) => HandlerCallback>();

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
  const hook = _createRateLimitHook<T>(rateLimitOptions, 'unbound');
  // Route registration swaps this instance for a per-route clone (see _bindRateLimitHookToRoute)
  _routeBinders.set(hook, (routeId) => _createRateLimitHook(rateLimitOptions, `route:${routeId}`));
  return hook;
};

/**
 * Build one hook with its own limiter. `namespace` keeps its Redis keys apart from the global limiter's and
 * from every other route's when they share a client and key prefix: keys become
 * `<keyPrefix><namespace>:<client key>`. The in-memory store is already per limiter, so it needs no namespace.
 */
const _createRateLimitHook = <T extends HandlerCallbackGenerics>(rateLimitOptions: RateLimitOptions, namespace: string): HandlerCallback<T> => {
  const { store } = rateLimitOptions;
  const namespacedOptions: RateLimitOptions =
    store?.type === 'redis' ? { ...rateLimitOptions, store: { ...store, keyPrefix: `${store.keyPrefix ?? 'rate_limit:'}${namespace}:` } } : rateLimitOptions;
  // One limiter (and one store) per hook, created once. Building it inside the per-request closure gave every
  // request a fresh, empty store, so the limit never applied.
  const rateLimiter = new RateLimiter(new RateLimitConfig(namespacedOptions));

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
  return hook;
};

/**
 * Called by route registration for every route hook. A rateLimitHook instance is replaced by a clone whose
 * namespace is the route registration (`route:<METHOD> <pattern>`): deterministic, so it is the same on every
 * node and after restarts, and distinct per route even when one hook instance is reused across routes. Any
 * other hook is returned unchanged.
 */
export const _bindRateLimitHookToRoute = (hook: HandlerCallback, routeId: string): HandlerCallback => _routeBinders.get(hook)?.(routeId) ?? hook;

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
