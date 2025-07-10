import { compileRoutePattern } from '@core/setup/utils/compileRoutePatter.ts';
import { normalizePath, normalizeRouteStructure } from '@core/setup/utils/normalizeStringPatterns.ts';
import { validateParameterNames } from '@core/setup/utils/validateParameterNames.ts';
import type { InternalHttpMethod } from '@typedefs/constants/http.ts';
import type { InternalPreCompiledRoute, InternalRouteRegistry, InternalRouteRegistryImpl } from '@typedefs/internal/InternalRouteRegistryImpl.js';

/**
 * RouteRegistry: Efficient route storage and matching
 *
 * DESIGN DECISION: Parameter extraction happens here (not in RequestImpl) because:
 * 1. We already compile regexes for route matching - reusing them for param extraction is free
 * 2. Avoids duplicate regex compilation at request time (performance critical)
 * 3. Single source of truth for route patterns and their compiled forms
 *
 * PERFORMANCE STRATEGY:
 * - Exact routes (no params): O(1) Map lookup
 * - Parameterized routes: O(n) iteration with pre-compiled regex matching
 * - Most apps have few parameterized routes, so O(n) is acceptable
 *
 * EXAMPLES:
 * - "/users" (exact) → stored in exactRoutes Map for instant lookup
 * - "/users/:id" (parameterized) → compiled to regex, stored in parameterizedRoutes Array
 */
export class RouteRegistryImpl implements InternalRouteRegistryImpl {
  /**
   * Fast O(1) lookup for routes without parameters
   * Example: GET /users, POST /login, etc.
   */
  readonly _exactRoutes = new Map<InternalHttpMethod, Map<string, InternalRouteRegistry>>();

  /**
   * Array of pre-compiled parameterized routes for O(n) matching
   * Example: GET /users/:id, POST /users/:id/posts/:postId, etc.
   *
   * We use an array because:
   * 1. Route patterns can't be used as Map keys (they're not exact matches)
   * 2. Most apps have relatively few parameterized routes
   * 3. Pre-compiled regexes make matching fast
   */
  readonly _parameterizedRoutes = new Map<InternalHttpMethod, Array<InternalPreCompiledRoute>>();

  /**
   * Register a new route
   *
   * PERFORMANCE NOTE: This happens at server startup, so we can afford
   * more expensive operations like regex compilation here.
   */
  _register({ method, path, handler, options }: InternalRouteRegistry): void {
    const normalizedPath = normalizePath(path);
    const isParameterized = normalizedPath.includes(':');

    // Validate route before registration
    if (isParameterized) {
      validateParameterNames(normalizedPath);
    }

    // Prevent duplicate route registration
    // We check for exact pattern duplicates, not request path matches
    if (this._hasExactRoutePattern(method, normalizedPath)) {
      throw new Error(`Route ${normalizedPath} already exists for method ${method}`);
    }

    const route = { method, path: normalizedPath, handler, options, params: {} };

    if (isParameterized) {
      // Store in parameterized routes with pre-compiled regex
      this._storeParameterizedRoute(method, route);
    } else {
      // Store in exact routes for O(1) lookup
      this._storeExactRoute(method, normalizedPath, route);
    }
  }

  /**
   * Find a route and extract parameters from the request path
   *
   * RUNTIME PERFORMANCE: This is called for every HTTP request, so it must be fast!
   * 1. Try exact match first (O(1) - fastest case)
   * 2. Fall back to parameterized routes (O(n) with pre-compiled regex)
   */
  _findRoute(method: InternalHttpMethod, path: string): InternalRouteRegistry | undefined {
    const normalizedPath = normalizePath(path);

    // FAST PATH: Try exact match first (most common case)
    const exactRoute = this._exactRoutes.get(method)?.get(normalizedPath);
    if (exactRoute) {
      return exactRoute;
    }

    // PARAMETERIZED PATH: Check routes with parameters
    return this._findParameterizedRoute(method, normalizedPath);
  }

  /**
   * Check if a route pattern already exists (for conflict detection)
   * This is different from findRoute which matches request paths to patterns
   */
  private _hasExactRoutePattern(method: InternalHttpMethod, pattern: string): boolean {
    // Check exact routes
    if (this._exactRoutes.get(method)?.has(pattern)) {
      return true;
    }

    // For parameterized routes, check if the structure conflicts
    // Example: /users/:id conflicts with /users/:userId (same structure, different param names)
    if (pattern.includes(':')) {
      const normalizedPattern = normalizeRouteStructure(pattern);
      const paramRoutes = this._parameterizedRoutes.get(method);

      if (paramRoutes) {
        return paramRoutes.some((route) => normalizeRouteStructure(route.path) === normalizedPattern);
      }
    } else {
      // Check parameterized routes for exact pattern match
      const paramRoutes = this._parameterizedRoutes.get(method);
      if (paramRoutes) {
        return paramRoutes.some((route) => route.path === pattern);
      }
    }

    return false;
  }

  /**
   * Store an exact route (no parameters) for O(1) lookup
   */
  private _storeExactRoute(method: InternalHttpMethod, path: string, route: InternalRouteRegistry): void {
    if (!this._exactRoutes.has(method)) {
      this._exactRoutes.set(method, new Map());
    }

    this._exactRoutes.get(method)?.set(path, route);
  }

  /**
   * Store a parameterized route with pre-compiled regex pattern
   */
  private _storeParameterizedRoute(method: InternalHttpMethod, route: InternalRouteRegistry): void {
    if (!this._parameterizedRoutes.has(method)) {
      this._parameterizedRoutes.set(method, []);
    }

    /**
     * Compile a route pattern into a regex with parameter extraction
     *
     * This is the magic that converts route patterns to regexes:
     * - "/users/:id" → /^\/users\/([^\/]+)$/
     * - "/users/:id/posts/:postId" → /^\/users\/([^\/]+)\/posts\/([^\/]+)$/
     *
     * WHY AT REGISTRATION TIME: Regex compilation is expensive, so we do it once
     * at server startup rather than on every request.
     */
    const compiled = compileRoutePattern(route);
    this._parameterizedRoutes.get(method)?.push(compiled);
  }

  /**
   * Find and match a parameterized route, extracting parameters
   * This is slower than the exact route match (O(n)) because it has to iterate through all the parameterized routes
   * and should only be used if the route is parameterized, otherwise it will be slower than the exact route match.
   */
  private _findParameterizedRoute(method: InternalHttpMethod, path: string): InternalRouteRegistry | undefined {
    const paramRoutes = this._parameterizedRoutes.get(method);
    if (!paramRoutes) return undefined;

    // Try each parameterized route until we find a match
    for (const compiledRoute of paramRoutes) {
      const match = path.match(compiledRoute.pattern);
      if (match) {
        const params: Record<string, string> = {};

        // Extract parameters from regex capture groups
        // match[0] is the full match, match[1+] are the captured groups
        for (let i = 0; i < compiledRoute.paramNames.length; i++) {
          const paramValue = match[i + 1];
          const paramName = compiledRoute.paramNames[i];

          if (paramValue !== undefined && paramName !== undefined) {
            params[paramName] = paramValue;
          }
        }

        return { ...compiledRoute, params };
      }
    }

    return undefined;
  }
}
