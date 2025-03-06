import type { Context } from 'types/Common.ts';
import type { TResponseBody } from 'types/http/Response.ts';
import type { IRoute } from 'types/Route.ts';

/**
 * Execute a route handler function
 * @param ctx The request context
 * @param route The route containing the handler function
 * @returns Response body from the handler
 */
export default async (ctx: Context, route: IRoute): Promise<TResponseBody<unknown> | void> =>
  // Execute the handler function with the context
  Promise.resolve(route.handler(ctx));
