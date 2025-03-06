import type { Context } from 'core/Context.ts';
import type { THttpMethod } from 'types/http/Request.ts';
import type { TResponseBody } from 'types/http/Response.ts';

/**
 * Represents a route handler function that returns a response body
 * 
 * This type defines the signature for route handlers that process requests
 * and return a response. The function can return either a promise that resolves
 * to a response body or a response body directly.
 * 
 * @param ctx - The request context containing request and response objects
 * @returns A response body or a promise that resolves to a response body
 */
export type TResponseFunction = (ctx: Context) => Promise<TResponseBody<unknown>> | TResponseBody<unknown>;

/**
 * Represents a route handler function that may or may not return a response body
 * 
 * This type extends TResponseFunction to also allow handlers that don't return
 * anything (void). This is useful for middleware functions that may modify the
 * request or response but don't need to return a response body themselves.
 * 
 * @param ctx - The request context containing request and response objects
 * @returns A response body, a promise that resolves to a response body, void, or a promise that resolves to void
 */
export type TUndefinableResponseFunction = TResponseFunction | ((ctx: Context) => Promise<void> | void);

/**
 * Represents a route definition
 * 
 * This interface defines the structure of a route, including its path, HTTP method,
 * handler function, and optional middleware functions that can be executed before
 * or after the main handler.
 */
export interface IRoute {
  /** The URL path pattern for the route (can include parameters) */
  path: string;
  /** The HTTP method for the route (GET, POST, etc.) */
  method: THttpMethod;
  /** The main handler function for the route */
  handler: TResponseFunction;
  /** Optional middleware function to execute before the main handler */
  beforeHandler?: TResponseFunction | TUndefinableResponseFunction | undefined;
  /** Optional middleware function to execute after the main handler */
  afterHandler?: TUndefinableResponseFunction | undefined;
  /** Optional middleware function to execute before all handlers in a group */
  beforeGroup?: TResponseFunction | TUndefinableResponseFunction | undefined;
}
