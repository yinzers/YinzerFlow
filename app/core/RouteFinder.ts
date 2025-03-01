import type { IRoute } from '../types/Route.ts';
import type { HttpRequest } from './HttpRequest.ts';
import type { RouteRegistry } from './RouteRegistry.ts';

/**
 * Handles route lookup and matching
 *
 * This class is responsible for finding routes based on HTTP requests.
 * It follows the Single Responsibility Principle by focusing only on
 * route lookup and matching logic.
 */
export class RouteFinder {
  constructor(private readonly routeRegistry: RouteRegistry) {}

  /**
   * Find a route by method and path
   */
  findRoute(method: string, path: string): IRoute | undefined {
    const routes = this.routeRegistry.getRoutes();
    return routes.get(`${method}:${path}`);
  }

  /**
   * Find a route based on the incoming request
   * First tries exact match, then falls back to pattern matching for route parameters
   */
  findRouteFromRequest(request: HttpRequest): IRoute | undefined {
    const routes = this.routeRegistry.getRoutes();

    // Normalize path by removing trailing slash (except for root path)
    const normalizedPath = request.path !== '/' && request.path.endsWith('/') ? request.path.slice(0, -1) : request.path;

    // First try exact match with normalized path
    const exactKey = `${request.method}:${normalizedPath}`;
    const exactMatch = routes.get(exactKey);
    if (exactMatch) return exactMatch;

    // If no exact match, look for pattern matches
    for (const [, route] of routes) {
      if (route.method !== request.method) continue;

      // Convert route pattern to regex
      const pattern = route.path.replace(/:[^/]+/g, '([^/]+)');
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(normalizedPath)) return route;
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

    // Remove query string if present
    const pathParts = path.split('?');
    const pathWithoutQuery = pathParts[0] ?? '';

    // If there are no parameters in the pattern, return empty object
    if (!pattern.includes(':')) {
      return params;
    }

    // Split the path and pattern into segments
    const pathSegments = pathWithoutQuery.split('/');
    const patternSegments = pattern.split('/');

    // Match each segment and extract parameters
    for (let i = 0; i < patternSegments.length; i++) {
      if (i < patternSegments.length) {
        const patternSegment = patternSegments[i];

        // If this segment is a parameter (starts with :)
        if (patternSegment?.startsWith(':')) {
          const paramName = patternSegment.substring(1); // Remove the : prefix

          if (i < pathSegments.length) {
            const paramValue = pathSegments[i];

            if (paramValue) {
              params[paramName] = paramValue;
            }
          }
        }
      }
    }

    return params;
  }
}
