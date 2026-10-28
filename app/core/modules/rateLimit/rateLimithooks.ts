import { RateLimiter, addRateLimitHeaders } from '@core/modules/rateLimit/RateLimiter.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';

import { _convertTimeToMs } from '@core/utils/time.ts';
import type { RateLimitOptions } from '@typedefs/public/RateLimit.js';
import { RateLimitConfig } from '@core/modules/rateLimit/RateLimitConfig.ts';
import { log } from '@core/utils/log.ts';
import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.js';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.js';

/** Hook instance -> lookup of the limiter it holds for one app, so each app destroys only its own on close(). */
const _hookLimiters = new WeakMap<object, (app: object) => RateLimiter | undefined>();

/** Key for a hook called outside a YinzerFlow request (no app on the context), so it still has a limiter. */
const _noApp = {};

/** Creation-order counter naming hooks created without `name`; named hooks never advance it. */
let _unnamedHookCount = 0;

/** `name` -> the limit first registered under it, to warn once when another hook reuses the name with a different limit. */
const _namedHookLimits = new Map<string, { max: number; window: number }>();
const _warnedHookNames = new Set<string>();

/**
 * Two hooks with one `name` share one Redis namespace, so one counter. If their max or window differ they disagree
 * about the limit for that counter: warn once per name. Same name and same limit is a deliberate shared budget.
 */
const _checkHookNameClash = (name: string, config: RateLimitConfig): void => {
  const first = _namedHookLimits.get(name);
  if (!first) {
    _namedHookLimits.set(name, { max: config.max, window: config.window });
    return;
  }
  if ((first.max === config.max && first.window === config.window) || _warnedHookNames.has(name)) return;
  _warnedHookNames.add(name);
  log.warn(
    `[RATE LIMIT] Two rateLimitHook() calls share name "${name}" with different limits ` +
      `(max ${first.max} per ${first.window}ms vs max ${config.max} per ${config.window}ms). ` +
      'Hooks with one name share one counter in Redis; give each limit its own name.',
  );
};

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
  const { name } = rateLimitOptions;
  if (name === undefined) _unnamedHookCount += 1;
  const namespace = `hook:${name ?? `#${_unnamedHookCount}`}`;
  return _createRateLimitHook<T>(rateLimitOptions, namespace);
};

/**
 * Build one hook in its own Redis key namespace. The configuration is validated once, here; the limiter itself
 * is one per app that uses the hook, created on that app's first request. Two YinzerFlow apps in one process
 * sharing a hook are separate servers, so they get separate in-memory budgets, and appA.close() destroys only
 * appA's limiter, never the one appB is still counting in. (With a Redis store they share counters through the
 * namespace, exactly as two nodes of one service do.)
 */
const _createRateLimitHook = <T extends HandlerCallbackGenerics>(rateLimitOptions: RateLimitOptions, namespace: string): HandlerCallback<T> => {
  const rateLimitConfig = new RateLimitConfig(_withStoreNamespace(rateLimitOptions, namespace));
  if (rateLimitOptions.name !== undefined) _checkHookNameClash(rateLimitOptions.name, rateLimitConfig);
  const limitersByApp = new WeakMap<object, RateLimiter>();
  const limiterFor = (app: object): RateLimiter => {
    let limiter = limitersByApp.get(app);
    if (!limiter) {
      limiter = new RateLimiter(rateLimitConfig);
      limitersByApp.set(app, limiter);
    }
    return limiter;
  };

  const hook: HandlerCallback<T> = async (context) => {
    const rateLimiter = limiterFor((context as unknown as Partial<InternalContextImpl>)._request?._setup ?? _noApp);

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
  _hookLimiters.set(hook, (app) => limitersByApp.get(app));
  return hook;
};

/** The limiter a rateLimitHook instance holds for `app` (if that app has used it), or undefined for any other hook. */
export const _rateLimiterOfHook = (hook: HandlerCallback, app: object): RateLimiter | undefined => _hookLimiters.get(hook)?.(app);

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
