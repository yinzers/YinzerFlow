import type { Request } from './Request.ts';
import type { Response } from './Response.ts';

/**
 * Request/response context
 *
 * This class encapsulates the request and response objects for a single HTTP request.
 * It is passed to middleware and route handlers to provide access to the request and response.
 */
export class Context {
  request: Request;
  response: Response;

  constructor(request: Request, response: Response) {
    this.request = request;
    this.response = response;
  }
}

/**
 * Type for request body
 */
export type TRequestBody<T = unknown> = Record<string, T>;
