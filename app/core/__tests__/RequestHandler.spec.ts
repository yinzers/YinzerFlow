import type { Socket } from 'net';
import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { RequestHandler } from '../RequestHandler.ts';
import { Request } from '../Request.ts';
import { Response } from '../Response.ts';
import type { IRoute } from '../../types/Route.ts';
import type { Context } from '../Context.ts';

// Import reusable mocks directly from their files
import { createMockRouteFinder } from '../__mocks__/RouteFinder.spec.ts';
import { createMockMiddlewareManager } from '../__mocks__/MiddlewareManager.spec.ts';
import { createMockErrorHandler } from '../__mocks__/ErrorHandler.spec.ts';
import { MockSocket } from '../__mocks__/Socket.spec.ts';

describe('RequestHandler', () => {
  let requestHandler: RequestHandler;
  let mockSocket: MockSocket;

  // Create reusable mocks
  const { mock: mockRouteFinder, findRouteFromRequest: mockFindRouteFromRequest, reset: resetRouteFinder } = createMockRouteFinder();
  const {
    mock: mockMiddlewareManager,
    processBeforeAll: mockProcessBeforeAll,
    processBeforeGroup: mockProcessBeforeGroup,
    processBeforeHandler: mockProcessBeforeHandler,
    processAfterHandler: mockProcessAfterHandler,
    reset: resetMiddlewareManager,
  } = createMockMiddlewareManager();
  const { mock: mockErrorHandler, reset: resetErrorHandler } = createMockErrorHandler();

  beforeEach(() => {
    // Reset mocks
    resetRouteFinder();
    resetMiddlewareManager();
    resetErrorHandler();

    // Create a new instance for each test
    requestHandler = new RequestHandler(mockRouteFinder, mockMiddlewareManager, mockErrorHandler);

    // Create a new mock socket for each test
    mockSocket = new MockSocket();
  });

  describe('handleSocketRequest', () => {
    test('should handle 404 when no route is found', async () => {
      // Arrange
      const requestBuffer = Buffer.from('GET /not-found HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      mockFindRouteFromRequest.mockImplementation(() => undefined);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockFindRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('404 Not Found');
      expect(mockSocket.data).toContain('{"success":false,"message":"Not found"}');
      expect(mockSocket.ended).toBe(true);
    });

    test('should process a request through middleware and handler when route is found', async () => {
      // Arrange
      const requestBuffer = Buffer.from('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');

      const mockRouteHandler = mock(() => {
        return { success: true, message: 'Test successful' };
      });

      const mockRoute: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      mockFindRouteFromRequest.mockImplementation(() => mockRoute);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockFindRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeGroup).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeHandler).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).toHaveBeenCalledTimes(1);
      expect(mockProcessAfterHandler).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('200 OK');
      expect(mockSocket.data).toContain('{"success":true,"message":"Test successful"}');
      expect(mockSocket.ended).toBe(true);
    });

    test('should handle errors during request processing', async () => {
      // Arrange
      const requestBuffer = Buffer.from('GET /error HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');

      // Mock the error handler to return a specific response
      mockErrorHandler.mockImplementation(() => {
        return { success: false, message: 'Test error' };
      });

      mockFindRouteFromRequest.mockImplementation(() => {
        throw new Error('Test error');
      });

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockFindRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockErrorHandler).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('"success":false');
      expect(mockSocket.data).toContain('"message":"Test error"');
      expect(mockSocket.ended).toBe(true);
    });

    test('should parse route parameters when a route is found', async () => {
      // Arrange
      const requestBuffer = Buffer.from('GET /users/123 HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');

      const mockRouteHandler = mock((ctx: Context) => {
        const params = ctx.request.params as Record<string, string>;
        return { success: true, userId: params.id };
      });

      const mockRoute: IRoute = {
        path: '/users/:id',
        method: 'GET',
        handler: mockRouteHandler,
      };

      mockFindRouteFromRequest.mockImplementation(() => mockRoute);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockFindRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('200 OK');
      expect(mockSocket.data).toContain('success');
      expect(mockSocket.ended).toBe(true);
    });

    test('should handle requests with query parameters', async () => {
      // Arrange
      const requestBuffer = Buffer.from('GET /search?q=test&page=1 HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');

      const mockRouteHandler = mock((ctx: Context) => {
        const query = ctx.request.query as Record<string, string>;
        return {
          success: true,
          query: query.q,
          page: query.page,
        };
      });

      const mockRoute: IRoute = {
        path: '/search',
        method: 'GET',
        handler: mockRouteHandler,
      };

      mockFindRouteFromRequest.mockImplementation(() => mockRoute);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockFindRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('200 OK');
      expect(mockSocket.data).toContain('"query":"test"');
      expect(mockSocket.data).toContain('"page":"1"');
      expect(mockSocket.ended).toBe(true);
    });

    test('should handle POST requests with JSON body', async () => {
      // Arrange
      const requestBody = JSON.stringify({ name: 'Test User', email: 'test@example.com' });
      const requestBuffer = Buffer.from(
        `POST /users HTTP/1.1\r\nHost: localhost:3000\r\nContent-Type: application/json\r\nContent-Length: ${requestBody.length}\r\n\r\n${requestBody}`,
      );

      const mockRouteHandler = mock((ctx: Context) => {
        const body = ctx.request.body as Record<string, string>;
        return {
          success: true,
          user: {
            name: body.name,
            email: body.email,
          },
        };
      });

      const mockRoute: IRoute = {
        path: '/users',
        method: 'POST',
        handler: mockRouteHandler,
      };

      mockFindRouteFromRequest.mockImplementation(() => mockRoute);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockFindRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('200 OK');
      expect(mockSocket.data).toContain('"name":"Test User"');
      expect(mockSocket.data).toContain('"email":"test@example.com"');
      expect(mockSocket.ended).toBe(true);
    });
  });

  describe('_processRequest', () => {
    test('should return early if beforeAll middleware returns a result', async () => {
      // Arrange
      const request = new Request('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      const mockRouteHandler = mock(() => ({}));
      const route: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      const middlewareResult = { success: false, message: 'Blocked by middleware' };
      mockProcessBeforeAll.mockImplementation(async () => Promise.resolve(middlewareResult as unknown));

      // Act
      const response = await (requestHandler as any)._processRequest(request, route);

      // Assert
      expect(mockProcessBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeGroup).not.toHaveBeenCalled();
      expect(mockProcessBeforeHandler).not.toHaveBeenCalled();
      expect(mockRouteHandler).not.toHaveBeenCalled();
      expect(mockProcessAfterHandler).not.toHaveBeenCalled();
      expect(response.formatHttpResponse()).toContain(JSON.stringify(middlewareResult));
    });

    test('should return early if beforeGroup middleware returns a result', async () => {
      // Arrange
      const request = new Request('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      const mockRouteHandler = mock(() => ({}));
      const route: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      const middlewareResult = { success: false, message: 'Blocked by group middleware' };
      mockProcessBeforeGroup.mockImplementation(async () => Promise.resolve(middlewareResult as unknown));

      // Act
      const response = await (requestHandler as any)._processRequest(request, route);

      // Assert
      expect(mockProcessBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeGroup).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeHandler).not.toHaveBeenCalled();
      expect(mockRouteHandler).not.toHaveBeenCalled();
      expect(mockProcessAfterHandler).not.toHaveBeenCalled();
      expect(response.formatHttpResponse()).toContain(JSON.stringify(middlewareResult));
    });

    test('should return early if beforeHandler middleware returns a result', async () => {
      // Arrange
      const request = new Request('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      const mockRouteHandler = mock(() => ({}));
      const route: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      const middlewareResult = { success: false, message: 'Blocked by handler middleware' };
      mockProcessBeforeHandler.mockImplementation(async () => Promise.resolve(middlewareResult as unknown));

      // Act
      const response = await (requestHandler as any)._processRequest(request, route);

      // Assert
      expect(mockProcessBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeGroup).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeHandler).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).not.toHaveBeenCalled();
      expect(mockProcessAfterHandler).not.toHaveBeenCalled();
      expect(response.formatHttpResponse()).toContain(JSON.stringify(middlewareResult));
    });

    test('should process the full request pipeline when no middleware returns early', async () => {
      // Arrange
      const request = new Request('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      const handlerResult = { success: true, data: 'Test data' };
      const mockRouteHandler = mock(() => handlerResult);
      const route: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      // Act
      const response = await (requestHandler as any)._processRequest(request, route);

      // Assert
      expect(mockProcessBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeGroup).toHaveBeenCalledTimes(1);
      expect(mockProcessBeforeHandler).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).toHaveBeenCalledTimes(1);
      expect(mockProcessAfterHandler).toHaveBeenCalledTimes(1);
      expect(response.formatHttpResponse()).toContain(JSON.stringify(handlerResult));
    });
  });

  describe('_createNotFoundResponse', () => {
    test('should return a 404 response with the correct body', () => {
      // Arrange
      const request = new Request('GET /not-found HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');

      // Act
      const response = (requestHandler as any)._createNotFoundResponse(request);

      // Assert
      expect(response).toBeInstanceOf(Response);
      expect(response.formatHttpResponse()).toContain('404 Not Found');
      expect(response.formatHttpResponse()).toContain('{"success":false,"message":"Not found"}');
    });
  });
});
