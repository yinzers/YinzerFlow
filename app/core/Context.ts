import type { HttpRequest } from './HttpRequest.ts';
import type { HttpResponse } from './HttpResponse.ts';

/**
 * Request/response context
 *
 * This class encapsulates the request and response objects for a single HTTP request.
 * It is passed to middleware and route handlers to provide access to the request and response.
 */
export class Context {
  request: HttpRequest;
  response: HttpResponse;

  constructor(request: HttpRequest, response: HttpResponse) {
    this.request = request;
    this.response = response;
  }
}

/**
 * Type for request body
 */
export type TRequestBody<T = unknown> = Record<string, T>;
