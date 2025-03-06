import type { IRoute, TUndefinableResponseFunction } from '../types/Route.ts';
import type { Context } from './Context.ts';
import type { TResponseBody } from 'types/http/Response.ts';
import type { TMiddleware } from 'types/Middleware.ts';

/**
 * Manages middleware registration and execution
 */
export class MiddlewareManager {
  private readonly middleware: Array<TMiddleware> = [];

  /**
   * Add middleware to be executed before route handlers
   */
  add(
    fn: TUndefinableResponseFunction,
    options?: {
      paths?: Array<string> | 'allButExcluded';
      excluded?: Array<string>;
    },
  ): void {
    if (!options) {
      this.middleware.push({ paths: [], excluded: [], fn });
      return;
    }

    if (options.paths === 'allButExcluded' && Array.isArray(options.excluded)) {
      this.middleware.push({ paths: 'allButExcluded', excluded: options.excluded, fn });
      return;
    }

    if (Array.isArray(options.paths)) {
      this.middleware.push({ paths: options.paths, excluded: [], fn });
      return;
    }

    // Default case
    this.middleware.push({ paths: [], excluded: [], fn });
  }

  /**
   * Process middleware functions for a route
   */
  async processBeforeAll(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (!this.middleware.length) return;

    for (const middleware of this.middleware) {
      // Handle "all but excluded" middleware
      if (middleware.paths === 'allButExcluded' && !middleware.excluded.includes(route.path)) {
        const result = await Promise.resolve(middleware.fn(ctx));

        if (result) {
          return typeof result === 'object' ? result : result;
        }
      }

      // Handle included paths middleware
      if (Array.isArray(middleware.paths) && middleware.paths.includes(route.path)) {
        const result = await Promise.resolve(middleware.fn(ctx));

        if (result) {
          return typeof result === 'object' ? result : result;
        }
      }
    }

    return undefined;
  }

  /**
   * Process beforeGroup functions for a route
   */
  async processBeforeGroup(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (route.beforeGroup) {
      return Promise.resolve(route.beforeGroup(ctx));
    }

    return undefined;
  }

  /**
   * Process beforeHandler functions for a route
   */
  async processBeforeHandler(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (route.beforeHandler) {
      return Promise.resolve(route.beforeHandler(ctx));
    }

    return undefined;
  }

  /**
   * Process afterHandler functions for a route
   */
  async processAfterHandler(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (route.afterHandler) {
      return Promise.resolve(route.afterHandler(ctx));
    }

    return undefined;
  }
}
