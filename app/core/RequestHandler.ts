import type { Socket } from 'net';
import { Request } from 'core/Request.ts';
import { Response } from 'core/Response.ts';
import { Context as ContextClass } from 'core/Context.ts';
import type { HooksManager } from 'core/HooksManager.ts';
import type { RouteFinder } from 'core/Route/RouteFinder.ts';
import { HttpStatusCode } from 'constants/http.ts';
import type { TErrorFunction } from 'types/Response.ts';
import type { IRoute } from 'types/Route.ts';

/**
 * Handles HTTP requests and routes them to the appropriate handler
 *
 * This class is responsible for:
 * 1. Receiving HTTP requests from a socket
 * 2. Finding the appropriate route
 * 3. Processing the request through hooks
 * 4. Executing the route handler
 * 5. Sending the response back to the client
 * 6. Handling any errors that occur during processing
 */
export class RequestHandler {
  constructor(
    private readonly routeFinder: RouteFinder,
    private readonly hooksManager: HooksManager,
    private readonly errorHandler: TErrorFunction,
  ) {}

  /**
   * Main handler for incoming HTTP requests from a socket
   *
   * @param socket - The client socket connection
   * @param buffer - The raw request data
   */
  async handleSocketRequest(socket: Socket, buffer: Buffer): Promise<void> {
    const request = new Request(buffer.toString());

    try {
      // Find the route for this request
      const route = this.routeFinder.findRouteFromRequest(request);

      // Process the request or return 404
      const response = route ? (request.parseParams(route), await this._processRequest(request, route)) : this._createNotFoundResponse(request);

      // Send the response
      await this._sendResponse(socket, response);
    } catch (error) {
      // Handle errors and send error response
      const errorResponse = await this._handleError(request, error);
      await this._sendResponse(socket, errorResponse);
    }
  }

  /**
   * Sends an HTTP response through the socket
   *
   * @param socket - The client socket connection
   * @param response - The HTTP response to send
   */
  private async _sendResponse(socket: Socket, response: Response): Promise<void> {
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
  private async _handleError(request: Request, error: unknown): Promise<Response> {
    const context = new ContextClass(request, new Response(request));
    const errorResult = await Promise.resolve(this.errorHandler(context, error));
    context.response.setBody(errorResult);
    return context.response;
  }

  /**
   * Process a request through hooks and handlers
   *
   * @param request - The HTTP request
   * @param route - The matched route
   * @returns An HTTP response
   */
  private async _processRequest(request: Request, route: IRoute): Promise<Response> {
    const context = new ContextClass(request, new Response(request));

    // Process hooks chain
    const hooksResult = await this._processHooksChain(route, context);
    if (hooksResult) {
      return hooksResult;
    }

    // Process route handler
    const handlerResult = await Promise.resolve(route.handler(context));

    // Process afterHandler if defined
    await this.hooksManager.processAfterHandler(route, context);

    context.response.setBody(handlerResult);
    return context.response;
  }

  /**
   * Process the hooks chain (beforeAll, beforeGroup, beforeHandler)
   *
   * @param route - The matched route
   * @param context - The request context
   * @returns An HTTP response if a hook returns a result, otherwise undefined
   */
  private async _processHooksChain(route: IRoute, context: ContextClass): Promise<Response | undefined> {
    // Process global hooks
    const beforeAllResult = await this.hooksManager.processBeforeAll(route, context);
    if (beforeAllResult) {
      context.response.setBody(beforeAllResult);
      return context.response;
    }

    // Process group hooks
    const beforeGroupResult = await this.hooksManager.processBeforeGroup(route, context);
    if (beforeGroupResult) {
      context.response.setBody(beforeGroupResult);
      return context.response;
    }

    // Process handler-specific hooks
    const beforeHandlerResult = await this.hooksManager.processBeforeHandler(route, context);
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
  private _createNotFoundResponse(request: Request): Response {
    const context = new ContextClass(request, new Response(request));
    context.response.setStatus(HttpStatusCode.NOT_FOUND);
    context.response.setBody({ success: false, message: 'Not found' });
    return context.response;
  }
}
