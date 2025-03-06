import type { Socket } from 'net';
import type { IRoute } from '../types/Route.ts';
import type { TErrorFunction } from '../types/Response.ts';
import { HttpStatusCode } from '../constants/http.ts';
import { HttpRequest } from './HttpRequest.ts';
import { HttpResponse } from './HttpResponse.ts';
import { Context as ContextClass } from './Context.ts';
import type { MiddlewareManager } from './MiddlewareManager.ts';
import type { RouteFinder } from './RouteFinder.ts';

/**
 * Handles HTTP requests and routes them to the appropriate handler
 *
 * This class is responsible for:
 * 1. Receiving HTTP requests from a socket
 * 2. Finding the appropriate route
 * 3. Processing the request through middleware
 * 4. Executing the route handler
 * 5. Sending the response back to the client
 * 6. Handling any errors that occur during processing
 */
export class RequestHandler {
  constructor(
    private readonly routeFinder: RouteFinder,
    private readonly middlewareManager: MiddlewareManager,
    private readonly errorHandler: TErrorFunction,
  ) {}

  /**
   * Main handler for incoming HTTP requests from a socket
   *
   * @param socket - The client socket connection
   * @param buffer - The raw request data
   */
  async handleSocketRequest(socket: Socket, buffer: Buffer): Promise<void> {
    const request = new HttpRequest(buffer.toString());

    try {
      // Find the route for this request
      const route = this.routeFinder.findRouteFromRequest(request);

      // Process the request or return 404
      const response = route ? (request.parseParams(route), await this.processRequest(request, route)) : this.createNotFoundResponse(request);

      // Send the response
      await this.sendResponse(socket, response);
    } catch (error) {
      // Handle errors and send error response
      const errorResponse = await this.handleError(request, error);
      await this.sendResponse(socket, errorResponse);
    }
  }

  /**
   * Sends an HTTP response through the socket
   *
   * @param socket - The client socket connection
   * @param response - The HTTP response to send
   */
  private async sendResponse(socket: Socket, response: HttpResponse): Promise<void> {
    await new Promise<void>((resolve) => {
      socket.write(response.formatHttpResponse(), () => resolve());
      socket.end();
    });
  }

  /**
   * Handles errors that occur during request processing
   *
   * @param request - The HTTP request
   * @param error - The error that occurred
   * @returns An HTTP response with error details
   */
  private async handleError(request: HttpRequest, error: unknown): Promise<HttpResponse> {
    const context = new ContextClass(request, new HttpResponse(request));
    const errorResult = await Promise.resolve(this.errorHandler(context, error));
    context.response.setBody(errorResult);
    return context.response;
  }

  /**
   * Process a request through middleware and handlers
   *
   * @param request - The HTTP request
   * @param route - The matched route
   * @returns An HTTP response
   */
  private async processRequest(request: HttpRequest, route: IRoute): Promise<HttpResponse> {
    const context = new ContextClass(request, new HttpResponse(request));

    // Process middleware chain
    const middlewareResult = await this.processMiddlewareChain(route, context);
    if (middlewareResult) {
      return middlewareResult;
    }

    // Process route handler
    const handlerResult = await Promise.resolve(route.handler(context));

    // Process afterHandler if defined
    await this.middlewareManager.processAfterHandler(route, context);

    context.response.setBody(handlerResult);
    return context.response;
  }

  /**
   * Process the middleware chain (beforeAll, beforeGroup, beforeHandler)
   *
   * @param route - The matched route
   * @param context - The request context
   * @returns An HTTP response if middleware returns a result, otherwise undefined
   */
  private async processMiddlewareChain(route: IRoute, context: ContextClass): Promise<HttpResponse | undefined> {
    // Process global middleware
    const beforeAllResult = await this.middlewareManager.processBeforeAll(route, context);
    if (beforeAllResult) {
      context.response.setBody(beforeAllResult);
      return context.response;
    }

    // Process group middleware
    const beforeGroupResult = await this.middlewareManager.processBeforeGroup(route, context);
    if (beforeGroupResult) {
      context.response.setBody(beforeGroupResult);
      return context.response;
    }

    // Process handler-specific middleware
    const beforeHandlerResult = await this.middlewareManager.processBeforeHandler(route, context);
    if (beforeHandlerResult) {
      context.response.setBody(beforeHandlerResult);
      return context.response;
    }

    return undefined;
  }

  /**
   * Creates a 404 Not Found response
   *
   * @param request - The HTTP request
   * @returns A 404 Not Found HTTP response
   */
  private createNotFoundResponse(request: HttpRequest): HttpResponse {
    const context = new ContextClass(request, new HttpResponse(request));
    context.response.setStatus(HttpStatusCode.NOT_FOUND);
    context.response.setBody({ success: false, message: 'Not found' });
    return context.response;
  }
}
