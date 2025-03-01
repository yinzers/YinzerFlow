import type { IRoute } from '../types/Route.ts';

/**
 * Manages route registration
 *
 * This class is responsible for registering routes and storing them.
 * It follows the Single Responsibility Principle by focusing only on
 * route registration and storage.
 */
export class RouteRegistry {
  private readonly _routes = new Map<string, IRoute>();

  /**
   * Get all registered routes
   */
  getRoutes(): Map<string, IRoute> {
    return this._routes;
  }

  /**
   * Check if a route exists
   */
  hasRoute(method: string, path: string): boolean {
    const routeKey = `${method}:${path}`;
    return this._routes.has(routeKey);
  }

  /**
   * Get a specific route by method and path
   */
  getRoute(method: string, path: string): IRoute | undefined {
    const routeKey = `${method}:${path}`;
    return this._routes.get(routeKey);
  }

  /**
   * Register a route with the specified path, handler, and options
   */
  addRoute(options: {
    path: IRoute['path'];
    handler: IRoute['handler'];
    method: IRoute['method'];
    beforeHandler?: IRoute['beforeHandler'];
    afterHandler?: IRoute['afterHandler'];
  }): IRoute {
    const { path, handler, method, beforeHandler, afterHandler } = options;
    const route = {
      path,
      method,
      handler,
      beforeHandler: beforeHandler ?? undefined,
      afterHandler: afterHandler ?? undefined,
    };

    // Create unique key combining method and path
    const routeKey = `${method}:${path}`;
    this._routes.set(routeKey, route);
    return route;
  }

  /**
   * Register a group of routes with a common prefix and optional beforeGroup handler
   */
  addGroup(prefix: IRoute['path'], routes: Array<IRoute>, options?: { beforeGroup: IRoute['beforeGroup'] }): void {
    for (const route of routes) {
      const routeKey = `${route.method}:${prefix}${route.path}`;
      this._routes.set(routeKey, {
        ...route,
        path: `${prefix}${route.path}`,
        beforeGroup: options?.beforeGroup,
      });
    }
  }

  /**
   * Register multiple routes at once
   */
  addRoutes(routes: Array<IRoute>): void {
    for (const route of routes) {
      const routeKey = `${route.method}:${route.path}`;
      this._routes.set(routeKey, route);
    }
  }
}
