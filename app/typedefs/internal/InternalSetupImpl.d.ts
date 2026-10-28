import type { HandlerCallback } from '@typedefs/public/Context.d.ts';
import type { InternalHookRegistryImpl } from '@typedefs/internal/InternalHookRegistryImpl.js';
import type { InternalRouteRegistryImpl, InternalRouteRegistryOptions } from '@typedefs/internal/InternalRouteRegistryImpl.js';
import type { InternalServerOptions } from '@typedefs/internal/InternalConfiguration.js';
import type { Setup } from '@typedefs/public/Setup.js';
import type { InternalTrustedProxyMatcher } from '@typedefs/internal/InternalIpAddress.js';

export type InternalSetupMethod = (path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions) => void;

export interface InternalSetupImpl extends Setup {
  readonly _configuration: InternalServerOptions;
  readonly _routeRegistry: InternalRouteRegistryImpl;
  readonly _hooks: InternalHookRegistryImpl;
  /** `ipSecurity.trustedProxies` compiled once at construction; requests use only this, never the configured array. */
  readonly _trustedProxyMatcher: InternalTrustedProxyMatcher;
  /**
   * The framework's global rate limiter, run by RequestHandlerImpl in its own stage: after beforeRouting
   * hooks and route matching (so keyGenerator sees params and beforeRouting state), before the 404 and
   * beforeAll. Deliberately not a hook-registry entry, so user hooks can't reorder or remove it.
   */
  readonly _globalRateLimitHook: HandlerCallback | undefined;
  /** Per-instance logger. Set by `_configureLogging()` in YinzerFlow. */
  _log: {
    info: (...args: Array<unknown>) => void;
    warn: (...args: Array<unknown>) => void;
    error: (...args: Array<unknown>) => void;
    debug: (...args: Array<unknown>) => void;
    table: (data: unknown, ...additionalArgs: Array<unknown>) => void;
  };
}
