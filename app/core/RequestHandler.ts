import type { Socket } from 'net';
import { HttpStatusCode } from '../constants/http.ts';
import type { IRoute } from '../types/Route.ts';
import type { TErrorFunction } from '../types/Response.ts';
import type { RouteFinder } from './RouteFinder.ts';
import type { MiddlewareManager } from './MiddlewareManager.ts';
import { MiddlewareExecutor } from './MiddlewareExecutor.ts';
import { HttpRequest } from './HttpRequest.ts';
import { HttpResponse } from './HttpResponse.ts';
import { Context } from './Context.ts';
/**
 * Handles processing of incoming HTTP requests
 */
export class RequestHandler {
  private readonly middlewareExecutor = new MiddlewareExecutor();

  constructor(
    private readonly routeFinder: RouteFinder,
    private readonly middlewareManager: MiddlewareManager,
    private readonly errorHandler: TErrorFunction,
  ) {}

  /**
   * Main handler for incoming HTTP requests
   */
  async handleSocketRequest(socket: Socket, buffer: Buffer): Promise<void> {
    const createRequest = new HttpRequest(buffer.toString());
    try {
      // Find the route for this request
      const findRouteBasedOnRequest = this.routeFinder.findRouteFromRequest(createRequest);

      if (!findRouteBasedOnRequest) {
        const ctx = new Context(createRequest, new HttpResponse(createRequest));
        ctx.response.setStatus(HttpStatusCode.NOT_FOUND);
        ctx.response.setBody({ success: false, message: 'Not found' });
        await new Promise<void>((resolve) => {
          socket.write(ctx.response.formatHttpResponse(), () => resolve());
          socket.end();
        });
        return;
      }

      // Parse route parameters
      createRequest.parseParams(findRouteBasedOnRequest);

      // Process the request through middleware and handlers
      const createResponse = await this.handleRequest(createRequest, findRouteBasedOnRequest);

      // Send the response
      await new Promise<void>((resolve) => {
        socket.write(createResponse.formatHttpResponse(), () => resolve());
        socket.end();
      });
    } catch (error) {
      // Handle errors
      const createContext = new Context(createRequest, new HttpResponse(createRequest));
      createContext.response.setBody(await Promise.resolve(this.errorHandler(createContext, error)));
      await new Promise<void>((resolve) => {
        socket.write(createContext.response.formatHttpResponse(), () => resolve());
        socket.end();
      });
    }
  }

  /**
   * Process a request through middleware and route handlers
   */
  async handleRequest(request: HttpRequest, route: IRoute): Promise<HttpResponse> {
    const createContext = new Context(request, new HttpResponse(request));

    const middleware = this.middlewareManager.getMiddleware();

    let result = undefined;

    // Execute middleware
    result = await this.middlewareExecutor.executeMiddleware(route, createContext, middleware);

    if (result) {
      createContext.response.setBody(result);
      return <HttpResponse>createContext.response;
    }

    // Execute beforeGroup functions
    result = await this.middlewareExecutor.executeBeforeGroup(route, createContext);

    if (result) {
      createContext.response.setBody(result);
      return <HttpResponse>createContext.response;
    }

    // Execute beforeHandler functions
    result = await this.middlewareExecutor.executeBeforeHandler(route, createContext);

    if (result) {
      createContext.response.setBody(result);
      return <HttpResponse>createContext.response;
    }

    // Execute route handler
    result = await Promise.resolve(route.handler(createContext));

    // Execute afterHandler if defined
    await this.middlewareExecutor.executeAfterHandler(route, createContext);

    createContext.response.setBody(result);
    return <HttpResponse>createContext.response;
  }
}
