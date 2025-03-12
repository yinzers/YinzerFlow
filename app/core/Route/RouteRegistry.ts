import { EventEmitter } from 'events';
import type { IRoute } from 'types/Route.ts';
import { RouteRegistryEvent } from 'constants/route.ts';

/**
 * Manages route registration
 *
 * This class is responsible for registering routes and storing them.
 * It follows the Single Responsibility Principle by focusing only on
 * route registration and storage.
 */
export class RouteRegistry extends EventEmitter {
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
    const routeKey = this.createRouteKey(method, path);
    return this._routes.has(routeKey);
  }

  /**
   * Get a specific route by method and path
   */
  getRoute(method: string, path: string): IRoute | undefined {
    const routeKey = this.createRouteKey(method, path);
    return this._routes.get(routeKey);
  }

  /**
   * Create a unique key for a route based on method and path
   */
  private createRouteKey(method: string, path: string): string {
    return `${method}:${path}`;
  }

  /**
   * Validate a route path
   * @throws Error if the path is invalid
   */
  private validatePath(path: string): void {
    // Path must start with a slash
    if (!path.startsWith('/')) {
      throw new Error(`Route path must start with a slash: ${path}`);
    }

    // Path must not have consecutive slashes
    if (path.includes('//')) {
      throw new Error(`Route path must not contain consecutive slashes: ${path}`);
    }

    // Path parameters must have names
    const paramRegex = /:\w+/g;
    const params = path.match(paramRegex) ?? [];

    for (const param of params) {
      if (param === ':') {
        throw new Error(`Route path parameter must have a name: ${path}`);
      }
    }
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

    // Validate the route path
    this.validatePath(path);

    const route = {
      path,
      method,
      handler,
      beforeHandler: beforeHandler ?? undefined,
      afterHandler: afterHandler ?? undefined,
    };

    // Create unique key combining method and path
    const routeKey = this.createRouteKey(method, path);

    // Check for duplicate routes
    if (this._routes.has(routeKey)) {
      console.warn(`Route already exists and will be overwritten: ${method} ${path}`);
    }

    this._routes.set(routeKey, route);

    // Emit events
    this.emit(RouteRegistryEvent.ROUTE_ADDED, route);
    this.emit(RouteRegistryEvent.ROUTES_CHANGED);

    return route;
  }

  /**
   * Remove a route by method and path
   * @returns true if the route was removed, false if it didn't exist
   */
  removeRoute(method: string, path: string): boolean {
    const routeKey = this.createRouteKey(method, path);
    const route = this._routes.get(routeKey);

    if (!route) {
      return false;
    }

    const deleted = this._routes.delete(routeKey);

    if (deleted) {
      // Emit events
      this.emit(RouteRegistryEvent.ROUTE_REMOVED, route);
      this.emit(RouteRegistryEvent.ROUTES_CHANGED);
    }

    return deleted;
  }

  /**
   * Register a group of routes with a common prefix and optional beforeGroup handler
   */
  addGroup(prefix: IRoute['path'], routes: Array<IRoute>, options?: { beforeGroup: IRoute['beforeGroup'] }): void {
    // Validate the prefix
    this.validatePath(prefix);

    // Ensure prefix ends with a slash if it's not just a slash
    let normalizedPrefix = '';
    if (prefix === '/') {
      normalizedPrefix = '';
    } else if (prefix.endsWith('/')) {
      normalizedPrefix = prefix;
    } else {
      normalizedPrefix = `${prefix}/`;
    }

    for (const route of routes) {
      // Ensure route path starts with a slash
      const routePath = route.path.startsWith('/') ? route.path : `/${route.path}`;

      // Combine prefix and route path
      const fullPath = `${normalizedPrefix}${routePath.substring(1)}`;

      const routeKey = this.createRouteKey(route.method, fullPath);

      this._routes.set(routeKey, {
        ...route,
        path: fullPath,
        beforeGroup: options?.beforeGroup,
      });

      // Emit events
      this.emit(RouteRegistryEvent.ROUTE_ADDED, this._routes.get(routeKey));
    }

    this.emit(RouteRegistryEvent.ROUTES_CHANGED);
  }

  /**
   * Register multiple routes at once
   */
  addRoutes(routes: Array<IRoute>): void {
    for (const route of routes) {
      // Validate the route path
      this.validatePath(route.path);

      const routeKey = this.createRouteKey(route.method, route.path);
      this._routes.set(routeKey, route);

      // Emit events
      this.emit(RouteRegistryEvent.ROUTE_ADDED, route);
    }

    this.emit(RouteRegistryEvent.ROUTES_CHANGED);
  }

  /**
   * Remove all routes
   */
  clearRoutes(): void {
    this._routes.clear();
    this.emit(RouteRegistryEvent.ROUTES_CHANGED);
  }

  /**
   * Get the number of registered routes
   */
  get routeCount(): number {
    return this._routes.size;
  }
}
