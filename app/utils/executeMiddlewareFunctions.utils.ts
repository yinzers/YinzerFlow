import type { Context } from 'core/Context.ts';
import type { TResponseBody } from 'types/http/Response.ts';

/**
 * Execute middleware functions in sequence
 * @param ctx The request context
 * @param middlewares Array of middleware functions to execute
 * @returns Response body if a middleware returns one, otherwise undefined
 */
export default async (ctx: Context, middlewares: Array<(ctx: Context, next: () => Promise<unknown>) => unknown>): Promise<TResponseBody<unknown> | void> => {
  if (middlewares.length === 0) {
    return undefined;
  }

  // Create a chain of middleware functions
  let index = 0;

  const next = async (): Promise<TResponseBody<unknown> | void> => {
    // If we've executed all middleware, return undefined
    if (index >= middlewares.length) {
      return undefined;
    }

    // Get the current middleware
    const middleware = middlewares[index++];

    // Execute the middleware with the context and next function
    if (middleware) {
      return Promise.resolve(middleware(ctx, next));
    }
    return undefined;
  };

  // Start the middleware chain
  return next();
};
