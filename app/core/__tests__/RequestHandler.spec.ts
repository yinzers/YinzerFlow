import type { Socket } from 'net';
import { beforeEach, describe, expect, it, jest, mock, test } from 'bun:test';
import { RequestHandler } from '../RequestHandler.ts';
import { Request } from '../Request.ts';
import { Response } from '../Response.ts';
import type { IRoute } from '../../types/Route.ts';
import type { Context } from '../Context.ts';

// Import reusable mocks directly from their files
import { createMockRouteFinder } from '../__mocks__/RouteFinder.spec.ts';
import { createMockHooksManager } from '../__mocks__/HooksManager.spec.ts';
import { MockSocket } from '../__mocks__/Socket.spec.ts';
import type { RouteFinder } from '../RouteFinder.ts';

// Define a partial type for the mock HooksManager
interface MockHooksManager {
  processBeforeAll: ReturnType<typeof mock>;
  processBeforeGroup: ReturnType<typeof mock>;
  processBeforeHandler: ReturnType<typeof mock>;
  processAfterHandler: ReturnType<typeof mock>;
  add: ReturnType<typeof mock>;
  clear: ReturnType<typeof mock>;
  on: ReturnType<typeof mock>;
  emit: ReturnType<typeof mock>;
  hooksCount: number;
}

describe('RequestHandler', () => {
  let requestHandler: RequestHandler;
  let mockRouteFinder: RouteFinder;
  let mockHooksManager: MockHooksManager;
  let mockErrorHandler: jest.Mock;
  let mockSocket: MockSocket;

  beforeEach(() => {
    // Set up mocks
    const { mock: routeFinderMock, reset: resetRouteFinder } = createMockRouteFinder();
    const { mock: hooksManagerMock, reset: resetHooksManager } = createMockHooksManager();

    mockRouteFinder = routeFinderMock;
    mockHooksManager = hooksManagerMock as unknown as MockHooksManager;
    mockErrorHandler = jest.fn();
    mockSocket = new MockSocket();

    resetRouteFinder();
    resetHooksManager();

    // Create the request handler
    requestHandler = new RequestHandler(mockRouteFinder as any, mockHooksManager as any, mockErrorHandler as any);
  });

  describe('handleSocketRequest', () => {
    test('should handle 404 when no route is found', async () => {
      // Arrange
      const requestBuffer = Buffer.from('GET /not-found HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      (mockRouteFinder.findRouteFromRequest as jest.Mock).mockReturnValue(undefined);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockRouteFinder.findRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('404 Not Found');
      expect(mockSocket.data).toContain('{"success":false,"message":"Not found"}');
      expect(mockSocket.ended).toBe(true);
    });

    test('should process a request through hooks and handler when route is found', async () => {
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

      (mockRouteFinder.findRouteFromRequest as jest.Mock).mockReturnValue(mockRoute);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockRouteFinder.findRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeGroup).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeHandler).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processAfterHandler).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('200 OK');
      expect(mockSocket.data).toContain('{"success":true,"message":"Test successful"}');
      expect(mockSocket.ended).toBe(true);
    });

    test('should handle errors during request processing', async () => {
      // Arrange
      const requestBuffer = Buffer.from('GET /error HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');

      // Mock the error handler to return a specific response
      mockErrorHandler.mockReturnValue({ success: false, message: 'Test error' });

      (mockRouteFinder.findRouteFromRequest as jest.Mock).mockImplementation(() => {
        throw new Error('Test error');
      });

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockRouteFinder.findRouteFromRequest).toHaveBeenCalledTimes(1);
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

      (mockRouteFinder.findRouteFromRequest as jest.Mock).mockReturnValue(mockRoute);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockRouteFinder.findRouteFromRequest).toHaveBeenCalledTimes(1);
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

      (mockRouteFinder.findRouteFromRequest as jest.Mock).mockReturnValue(mockRoute);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockRouteFinder.findRouteFromRequest).toHaveBeenCalledTimes(1);
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

      (mockRouteFinder.findRouteFromRequest as jest.Mock).mockReturnValue(mockRoute);

      // Act
      await requestHandler.handleSocketRequest(mockSocket as unknown as Socket, requestBuffer);

      // Assert
      expect(mockRouteFinder.findRouteFromRequest).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).toHaveBeenCalledTimes(1);
      expect(mockSocket.data).toContain('200 OK');
      expect(mockSocket.data).toContain('"name":"Test User"');
      expect(mockSocket.data).toContain('"email":"test@example.com"');
      expect(mockSocket.ended).toBe(true);
    });
  });

  describe('_processRequest', () => {
    test('should return early if beforeAll hook returns a result', async () => {
      // Arrange
      const request = new Request('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      const mockRouteHandler = mock(() => ({}));
      const route: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      const hookResult = { success: false, message: 'Blocked by hook' };
      mockHooksManager.processBeforeAll.mockImplementation(async () => Promise.resolve(hookResult));

      // Act
      const response = await (requestHandler as any)._processRequest(request, route);

      // Assert
      expect(mockHooksManager.processBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeGroup).not.toHaveBeenCalled();
      expect(mockHooksManager.processBeforeHandler).not.toHaveBeenCalled();
      expect(mockRouteHandler).not.toHaveBeenCalled();
      expect(mockHooksManager.processAfterHandler).not.toHaveBeenCalled();
      expect(response.formatHttpResponse()).toContain(JSON.stringify(hookResult));
    });

    test('should return early if beforeGroup hook returns a result', async () => {
      // Arrange
      const request = new Request('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      const mockRouteHandler = mock(() => ({}));
      const route: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      const hookResult = { success: false, message: 'Blocked by group hook' };
      mockHooksManager.processBeforeGroup.mockResolvedValue(hookResult);

      // Act
      const response = await (requestHandler as any)._processRequest(request, route);

      // Assert
      expect(mockHooksManager.processBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeGroup).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeHandler).not.toHaveBeenCalled();
      expect(mockRouteHandler).not.toHaveBeenCalled();
      expect(mockHooksManager.processAfterHandler).not.toHaveBeenCalled();
      expect(response.formatHttpResponse()).toContain(JSON.stringify(hookResult));
    });

    test('should return early if beforeHandler hook returns a result', async () => {
      // Arrange
      const request = new Request('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      const mockRouteHandler = mock(() => ({}));
      const route: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      const hookResult = { success: false, message: 'Blocked by handler hook' };
      mockHooksManager.processBeforeHandler.mockResolvedValue(hookResult);

      // Act
      const response = await (requestHandler as any)._processRequest(request, route);

      // Assert
      expect(mockHooksManager.processBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeGroup).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeHandler).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).not.toHaveBeenCalled();
      expect(mockHooksManager.processAfterHandler).not.toHaveBeenCalled();
      expect(response.formatHttpResponse()).toContain(JSON.stringify(hookResult));
    });

    test('should process the full request pipeline when no hook returns early', async () => {
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
      expect(mockHooksManager.processBeforeAll).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeGroup).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processBeforeHandler).toHaveBeenCalledTimes(1);
      expect(mockRouteHandler).toHaveBeenCalledTimes(1);
      expect(mockHooksManager.processAfterHandler).toHaveBeenCalledTimes(1);
      expect(response.formatHttpResponse()).toContain(JSON.stringify(handlerResult));
    });

    it('should process hooks and handler', async () => {
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
      await (requestHandler as any)._processRequest(request, route);

      // Verify hooks were called
      expect(mockHooksManager.processBeforeAll).toHaveBeenCalled();
      expect(mockHooksManager.processBeforeGroup).toHaveBeenCalled();
      expect(mockHooksManager.processBeforeHandler).toHaveBeenCalled();
      expect(mockHooksManager.processAfterHandler).toHaveBeenCalled();
    });

    it('should short-circuit if beforeAll hook returns a response', async () => {
      // Arrange
      const request = new Request('GET /test HTTP/1.1\r\nHost: localhost:3000\r\n\r\n');
      const mockRouteHandler = mock(() => ({}));
      const testRoute: IRoute = {
        path: '/test',
        method: 'GET',
        handler: mockRouteHandler,
      };

      // Mock beforeAll to return a response
      mockHooksManager.processBeforeAll.mockResolvedValueOnce({ message: 'Stopped by beforeAll' });

      // Act
      await (requestHandler as any)._processRequest(request, testRoute);

      // Verify only beforeAll was called
      expect(mockHooksManager.processBeforeAll).toHaveBeenCalled();
      expect(mockHooksManager.processBeforeGroup).not.toHaveBeenCalled();
      expect(mockHooksManager.processBeforeHandler).not.toHaveBeenCalled();
      expect(mockRouteHandler).not.toHaveBeenCalled();
      expect(mockHooksManager.processAfterHandler).not.toHaveBeenCalled();
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
