import type { IRoute } from '../types/Route.ts';
import type { TMiddleware } from '../types/Middleware.ts';
import type { TResponseBody } from '../types/http/Response.ts';
import type { Context } from './Context.ts';

/**
 * Handles execution of middleware, before group, and before handler functions
 */
export class MiddlewareExecutor {
  /**
   * Execute a chain of middleware functions with a final handler
   */
  async execute(
    ctx: Context,
    middlewares: Array<(ctx: Context, next: () => Promise<unknown>) => unknown>,
    finalHandler: (ctx: Context) => Promise<TResponseBody<unknown>> | TResponseBody<unknown>,
  ): Promise<TResponseBody<unknown>> {
    // Create a function to execute the middleware chain
    const executeMiddlewareChain = async (index: number): Promise<TResponseBody<unknown>> => {
      // If we've processed all middleware, execute the final handler
      if (index >= middlewares.length) {
        return Promise.resolve(finalHandler(ctx));
      }

      // Get the current middleware
      const middleware = middlewares[index];

      // Execute the current middleware with a next function that calls the next middleware
      if (middleware) {
        return Promise.resolve(middleware(ctx, async () => executeMiddlewareChain(index + 1)));
      }

      // If middleware is undefined, move to the next one
      return executeMiddlewareChain(index + 1);
    };

    // Start executing the middleware chain from the first middleware
    return executeMiddlewareChain(0);
  }

  /**
   * Execute middleware functions for a route
   */
  async executeMiddleware(route: IRoute, ctx: Context, middlewares: Array<TMiddleware>): Promise<TResponseBody<unknown> | void> {
    if (!middlewares.length) return;

    for (const middleware of middlewares) {
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
  }

  /**
   * Execute beforeGroup functions for a route
   */
  async executeBeforeGroup(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (route.beforeGroup) {
      return Promise.resolve(route.beforeGroup(ctx));
    }
  }

  /**
   * Execute beforeHandler functions for a route
   */
  async executeBeforeHandler(route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> {
    if (route.beforeHandler) {
      return Promise.resolve(route.beforeHandler(ctx));
    }
  }

  /**
   * Execute afterHandler functions for a route
   */
  async executeAfterHandler(route: IRoute, ctx: Context): Promise<void> {
    if (route.afterHandler) {
      await Promise.resolve(route.afterHandler(ctx));
    }
  }
}
