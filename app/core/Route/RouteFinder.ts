import type { Request } from 'core/Request.ts';
import type { RouteRegistry } from 'core/Route/RouteRegistry.ts';
import type { IRoute } from 'types/Route.ts';

/**
 * Handles route lookup and matching
 *
 * This class is responsible for finding routes based on HTTP requests.
 * It follows the Single Responsibility Principle by focusing only on
 * route lookup and matching logic.
 */
export class RouteFinder {
  // Cache for pattern routes to avoid recomputing regex patterns
  private readonly patternRouteCache = new Map<string, Array<{ pattern: RegExp; route: IRoute }>>();

  constructor(private readonly routeRegistry: RouteRegistry) {
    // Initialize pattern route cache
    this.buildPatternRouteCache();
  }

  /**
   * Builds a cache of pattern routes for faster lookup
   * This is called on initialization and when routes are updated
   */
  private buildPatternRouteCache(): void {
    const routes = this.routeRegistry.getRoutes();

    // Clear existing cache
    this.patternRouteCache.clear();

    // Group pattern routes by method for faster lookup
    for (const [, route] of routes) {
      if (route.path.includes(':')) {
        // This is a pattern route
        const { method } = route;
        const patternRoutes = this.patternRouteCache.get(method) ?? [];

        // Convert route pattern to regex for matching
        const regexPattern = this.createRouteRegex(route.path);

        patternRoutes.push({
          pattern: regexPattern,
          route,
        });

        this.patternRouteCache.set(method, patternRoutes);
      }
    }
  }

  /**
   * Creates a regex pattern from a route path
   * @param path The route path pattern (e.g., /users/:id)
   * @returns A RegExp object for matching paths
   */
  private createRouteRegex(path: string): RegExp {
    // Replace :param with named capture groups for better parameter extraction
    const regexPattern = path
      .replace(/:[^/]+/g, '([^/]+)')
      // Escape special regex characters except for the capture groups
      .replace(/(?:[.+*?^$()[\]{}|])/g, '\\$&');

    return new RegExp(`^${regexPattern}$`);
  }

  /**
   * Find a route by method and path
   */
  findRoute(method: string, path: string): IRoute | undefined {
    return this.routeRegistry.getRoute(method, path);
  }

  /**
   * Find a route based on the incoming request
   * First tries exact match, then falls back to pattern matching for route parameters
   */
  findRouteFromRequest(request: Request): IRoute | undefined {
    // Normalize path by removing trailing slash (except for root path)
    const normalizedPath = request.path !== '/' && request.path.endsWith('/') ? request.path.slice(0, -1) : request.path;

    // First try exact match with normalized path
    const exactMatch = this.findRoute(request.method, normalizedPath);
    if (exactMatch) return exactMatch;

    // If no exact match, check pattern routes for this method
    const patternRoutes = this.patternRouteCache.get(request.method);
    if (!patternRoutes) return undefined;

    // Try to match against pattern routes
    for (const { pattern, route } of patternRoutes) {
      if (pattern.test(normalizedPath)) {
        return route;
      }
    }

    return undefined;
  }

  /**
   * Extract parameters from a path based on a route pattern
   * @param path The actual path (e.g., /users/123)
   * @param pattern The route pattern (e.g., /users/:id)
   * @returns An object with parameter names as keys and their values
   */
  extractParamsFromPath(path: string, pattern: string): Record<string, string> {
    const params: Record<string, string> = {};

    // If there are no parameters in the pattern, return empty object
    if (!pattern.includes(':')) {
      return params;
    }

    // Remove query string if present
    const pathWithoutQuery = path.split('?')[0] ?? '';

    // Split the path and pattern into segments
    const pathSegments = pathWithoutQuery.split('/').filter(Boolean);
    const patternSegments = pattern.split('/').filter(Boolean);

    // Match each segment and extract parameters
    for (let i = 0; i < patternSegments.length; i++) {
      const patternSegment = patternSegments[i];

      // If this segment is a parameter (starts with :)
      if (patternSegment?.startsWith(':')) {
        const paramName = patternSegment.substring(1); // Remove the : prefix

        if (i < pathSegments.length) {
          const paramValue = pathSegments[i];

          if (paramValue) {
            params[paramName] = decodeURIComponent(paramValue);
          }
        }
      }
    }

    return params;
  }

  /**
   * Update the pattern route cache when routes are modified
   * This should be called whenever routes are added or removed
   */
  updatePatternRouteCache(): void {
    this.buildPatternRouteCache();
  }
}
