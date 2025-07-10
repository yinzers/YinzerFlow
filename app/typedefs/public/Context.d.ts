import type { InternalHandlerCallbackGenerics } from '@typedefs/internal/Generics.d.ts';
import type { Request } from '@typedefs/public/Request.js';
import type { Response } from '@typedefs/public/Response.js';

export interface Context<T extends InternalHandlerCallbackGenerics = InternalHandlerCallbackGenerics> {
  request: Request<T>;
  response: Response;
}

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
export type HandlerCallback<T extends InternalHandlerCallbackGenerics = InternalHandlerCallbackGenerics> = (
  ctx: Context<T>,
) => Promise<T['response'] | void> | T['response'] | void;
