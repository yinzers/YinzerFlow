import { EventEmitter } from 'events';
import type { IRoute, TUndefinableResponseFunction } from '../types/Route.ts';
import { HookManagerEvent, HookPhase, PathMatchingPattern } from '../constants/hooks.ts';
import type { Context } from './Context.ts';
import type { TResponseBody } from 'types/http/Response.ts';
import type { IExcludeHook, IIncludeHook, THook } from 'types/Hook.ts';

/**
 * Manages hooks registration and execution
 *
 * This class is responsible for registering hook functions and
 * executing them at the appropriate points in the request lifecycle.
 */
export class HooksManager extends EventEmitter {
  private readonly hooks: Array<THook> = [];

  // Cache for path matching to improve performance
  private readonly pathMatchCache = new Map<string, Array<THook>>();

  /**
   * Add a hook to be executed at various points in the request lifecycle
   *
   * @param fn The hook function to execute
   * @param options Configuration options for the hook
   * @returns The hooks manager instance for chaining
   */
  add(
    fn: TUndefinableResponseFunction,
    options?: {
      paths?: Array<string> | typeof PathMatchingPattern.ALL_BUT_EXCLUDED;
      excluded?: Array<string>;
    },
  ): this {
    let hookConfig: THook = <IIncludeHook>{ paths: [], excluded: [], fn };

    if (!options) {
      // Global hook with no path restrictions
      // Use the default initialization
    } else if (options.paths === PathMatchingPattern.ALL_BUT_EXCLUDED && Array.isArray(options.excluded)) {
      // Hook that applies to all paths except those explicitly excluded
      const excludeHook: IExcludeHook = {
        paths: PathMatchingPattern.ALL_BUT_EXCLUDED,
        excluded: options.excluded,
        fn,
      };
      hookConfig = excludeHook;
    } else if (Array.isArray(options.paths)) {
      // Hook that only applies to specific paths
      const includeHook: IIncludeHook = {
        paths: options.paths,
        excluded: options.excluded ?? [],
        fn,
      };
      hookConfig = includeHook;
    }
    // else use the default initialization

    this.hooks.push(hookConfig);

    // Clear the path match cache when a hook is added
    this.clearPathMatchCache();

    // Emit event
    this.emit(HookManagerEvent.HOOK_ADDED, hookConfig);

    return this;
  }

  /**
   * Clear the path match cache
   * This should be called whenever hooks are added or removed
   */
  private clearPathMatchCache(): void {
    this.pathMatchCache.clear();
  }

  /**
   * Get hooks that apply to a specific path
   * Uses caching for better performance
   *
   * @param path The route path to match against
   * @returns Array of hooks that apply to the path
   */
  private getHooksForPath(path: string): Array<THook> {
    // Check cache first
    if (this.pathMatchCache.has(path)) {
      return this.pathMatchCache.get(path) ?? [];
    }

    // Find all hooks that apply to this path
    const matchingHooks = this.hooks.filter((hook) => {
      // Case 1: "All but excluded" hook
      if (hook.paths === PathMatchingPattern.ALL_BUT_EXCLUDED) {
        return !this.isPathExcluded(path, hook.excluded);
      }

      // Case 2: Path-specific hook with paths array
      if (Array.isArray(hook.paths)) {
        // Check if the path is included in the paths array and not excluded
        return this.isPathIncluded(path, hook.paths) && !this.isPathExcluded(path, hook.excluded);
      }

      // Case 3: Global hook (empty paths array)
      // This should never happen with the current type definitions, but included for safety
      return false;
    });

    // Cache the result
    this.pathMatchCache.set(path, matchingHooks);

    return matchingHooks;
  }

  /**
   * Check if a path is included in a list of path patterns
   * Supports exact matches and pattern matching with wildcards
   *
   * @param path The path to check
   * @param patterns Array of path patterns to match against
   * @returns True if the path matches any pattern
   */
  private isPathIncluded(path: string, patterns: Array<string>): boolean {
    if (patterns.length === 0) return true;

    return patterns.some((pattern) => {
      // Exact match
      if (pattern === path) return true;

      // Wildcard match (e.g., /api/* matches /api/users)
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        return path.startsWith(prefix);
      }

      return false;
    });
  }

  /**
   * Check if a path is excluded by a list of path patterns
   *
   * @param path The path to check
   * @param patterns Array of path patterns to match against
   * @returns True if the path matches any exclusion pattern
   */
  private isPathExcluded(path: string, patterns: Array<string>): boolean {
    return this.isPathIncluded(path, patterns);
  }

  /**
   * Process beforeAll hooks for a route
   *
   * @param route The route to process hooks for
   * @param ctx The request context
   * @returns A response body if a hook short-circuits, undefined otherwise
   */
  async processBeforeAll(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (!this.hooks.length) return;

    const matchingHooks = this.getHooksForPath(route.path);

    for (const hook of matchingHooks) {
      try {
        const result = await Promise.resolve(hook.fn(ctx));

        // Emit event for hook execution
        this.emit(HookManagerEvent.HOOK_EXECUTED, {
          phase: HookPhase.BEFORE_ALL,
          path: route.path,
          result: result ? 'short-circuit' : 'continue',
        });

        // Emit specific phase event
        this.emit(HookManagerEvent.BEFORE_ALL_EXECUTED, ctx, hook);

        // If hook returns a value, short-circuit the request
        if (result) {
          return result;
        }
      } catch (error) {
        // Log the error but continue processing
        console.error(`Hook error for path ${route.path}:`, error);
        // Re-throw to allow error handling hooks to catch it
        throw error;
      }
    }

    return undefined;
  }

  /**
   * Process beforeGroup hooks for a route
   *
   * @param route The route to process hooks for
   * @param ctx The request context
   * @returns A response body if a hook short-circuits, undefined otherwise
   */
  async processBeforeGroup(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (!route.beforeGroup) return;

    try {
      const result = await Promise.resolve(route.beforeGroup(ctx));

      this.emit(HookManagerEvent.HOOK_EXECUTED, {
        phase: HookPhase.BEFORE_GROUP,
        path: route.path,
        result: result ? 'short-circuit' : 'continue',
      });

      // Emit specific phase event
      this.emit(HookManagerEvent.BEFORE_GROUP_EXECUTED, ctx, route.beforeGroup);

      return result;
    } catch (error) {
      console.error(`BeforeGroup hook error for path ${route.path}:`, error);
      throw error;
    }
  }

  /**
   * Process beforeHandler hooks for a route
   *
   * @param route The route to process hooks for
   * @param ctx The request context
   * @returns A response body if a hook short-circuits, undefined otherwise
   */
  async processBeforeHandler(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (!route.beforeHandler) return;

    try {
      const result = await Promise.resolve(route.beforeHandler(ctx));

      this.emit(HookManagerEvent.HOOK_EXECUTED, {
        phase: HookPhase.BEFORE_HANDLER,
        path: route.path,
        result: result ? 'short-circuit' : 'continue',
      });

      // Emit specific phase event
      this.emit(HookManagerEvent.BEFORE_HANDLER_EXECUTED, ctx, route.beforeHandler);

      return result;
    } catch (error) {
      console.error(`BeforeHandler hook error for path ${route.path}:`, error);
      throw error;
    }
  }

  /**
   * Process afterHandler hooks for a route
   *
   * @param route The route to process hooks for
   * @param ctx The request context
   * @returns A response body if a hook short-circuits, undefined otherwise
   */
  async processAfterHandler(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (!route.afterHandler) return;

    try {
      const result = await Promise.resolve(route.afterHandler(ctx));

      this.emit(HookManagerEvent.HOOK_EXECUTED, {
        phase: HookPhase.AFTER_HANDLER,
        path: route.path,
        result: result ? 'modified' : 'unmodified',
      });

      // Emit specific phase event
      this.emit(HookManagerEvent.AFTER_HANDLER_EXECUTED, ctx, route.afterHandler);

      return result;
    } catch (error) {
      console.error(`AfterHandler hook error for path ${route.path}:`, error);
      throw error;
    }
  }

  /**
   * Remove all hooks
   *
   * @returns The hooks manager instance for chaining
   */
  clear(): this {
    while (this.hooks.length > 0) {
      this.hooks.pop();
    }
    this.clearPathMatchCache();
    return this;
  }

  /**
   * Get the number of registered hook functions
   */
  get hooksCount(): number {
    return this.hooks.length;
  }
}
