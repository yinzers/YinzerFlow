import { beforeEach, describe, expect, it } from 'bun:test';
import { RequestHandlerImpl } from '../RequestHandlerImpl.ts';
import { ContextImpl } from '../ContextImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import { httpStatusCode } from '@constants/http.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { InternalContextImpl } from '@typedefs/internal/InternalContextImpl.ts';

const createPostRequest = (path = '/api/test', body = ''): string => {
  return `POST ${path} HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\n\r\n${body}`;
};

const createHeadRequest = (path = '/api/test', headers: Record<string, string> = {}): string => {
  const headerLines = Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n');
  const headersSection = headerLines ? `\r\n${headerLines}` : '';
  return `HEAD ${path} HTTP/1.1\r\nHost: localhost${headersSection}\r\n\r\n`;
};

const createOptionsRequest = (path = '/api/test', headers: Record<string, string> = {}): string => {
  const headerLines = Object.entries(headers)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\r\n');
  const headersSection = headerLines ? `\r\n${headerLines}` : '';
  return `OPTIONS ${path} HTTP/1.1\r\nHost: localhost${headersSection}\r\n\r\n`;
};

describe('RequestHandler', () => {
  let setup: SetupImpl;
  let requestHandler: RequestHandlerImpl;

  beforeEach(() => {
    setup = new SetupImpl();
    requestHandler = new RequestHandlerImpl(setup);
  });

  describe('constructor', () => {
    it('should initialize with setup instance', () => {
      expect(requestHandler).toBeInstanceOf(RequestHandlerImpl);
    });
  });

  describe('handle - route matching', () => {
    it('should call not found handler when no route matches', async () => {
      const context = new ContextImpl('GET /nonexistent HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual({
        success: false,
        message: '404 Not Found',
      });
    });

    it('should execute matched route handler', async () => {
      const testResponse = { message: 'Route executed' };
      const routeHandler: HandlerCallback = () => testResponse;

      setup.get('/test', routeHandler);
      const context = new ContextImpl('GET /test HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual(testResponse);
    });

    it('should handle async route handlers', async () => {
      const asyncResponse = { async: true, data: 'test' };
      const asyncHandler: HandlerCallback = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return asyncResponse;
      };

      setup.post('/async', asyncHandler);
      const context = new ContextImpl(createPostRequest('/async'), setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual(asyncResponse);
    });
  });

  describe('handle - hook execution order', () => {
    it('should execute hooks in correct order: beforeAll -> beforeRoute -> handler -> afterRoute -> afterAll', async () => {
      const executionOrder: Array<string> = [];

      const beforeAllHandler: HandlerCallback = () => {
        executionOrder.push('beforeAll');
      };

      const beforeRouteHandler: HandlerCallback = () => {
        executionOrder.push('beforeRoute');
      };

      const routeHandler: HandlerCallback = () => {
        executionOrder.push('route');
        return { success: true };
      };

      const afterRouteHandler: HandlerCallback = () => {
        executionOrder.push('afterRoute');
      };

      const afterAllHandler: HandlerCallback = () => {
        executionOrder.push('afterAll');
      };

      setup.beforeAll([beforeAllHandler]);
      setup.afterAll([afterAllHandler]);
      setup.get('/order-test', routeHandler, {
        beforeHooks: [beforeRouteHandler],
        afterHooks: [afterRouteHandler],
      });

      const context = new ContextImpl('GET /order-test HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(executionOrder).toEqual(['beforeAll', 'beforeRoute', 'route', 'afterRoute', 'afterAll']);
      expect(context._response._body).toEqual({ success: true });
    });

    it('should execute multiple beforeAll hooks in order', async () => {
      const executionOrder: Array<string> = [];

      const beforeHook1: HandlerCallback = () => executionOrder.push('before1');
      const beforeHook2: HandlerCallback = () => executionOrder.push('before2');
      const routeHandler: HandlerCallback = () => {
        executionOrder.push('route');
        return { executed: true };
      };

      setup.beforeAll([beforeHook1, beforeHook2]);
      setup.get('/multi-before', routeHandler);

      const context = new ContextImpl('GET /multi-before HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(executionOrder).toEqual(['before1', 'before2', 'route']);
    });

    it('should execute multiple afterAll hooks in order', async () => {
      const executionOrder: Array<string> = [];

      const routeHandler: HandlerCallback = () => {
        executionOrder.push('route');
        return { executed: true };
      };
      const afterHook1: HandlerCallback = () => executionOrder.push('after1');
      const afterHook2: HandlerCallback = () => executionOrder.push('after2');

      setup.afterAll([afterHook1, afterHook2]);
      setup.get('/multi-after', routeHandler);

      const context = new ContextImpl('GET /multi-after HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(executionOrder).toEqual(['route', 'after1', 'after2']);
    });
  });

  describe('handle - response building', () => {
    it('should set response body from route handler return value', async () => {
      const responseData = {
        id: 123,
        name: 'Test User',
        active: true,
      };

      const handler: HandlerCallback = () => responseData;

      setup.post('/user', handler);
      const context = new ContextImpl(createPostRequest('/user', '{"test": true}'), setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual(responseData);
    });

    it('should handle void return from route handler', async () => {
      const handler: HandlerCallback = () => {
        // No return value
      };

      setup.get('/void', handler);
      const context = new ContextImpl('GET /void HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toBeUndefined();
    });

    it('should allow hooks to modify response', async () => {
      const handler: HandlerCallback = () => ({ original: true });

      const afterHook: HandlerCallback = (ctx) => {
        ctx.response.setStatusCode(httpStatusCode.created);
        ctx.response.addHeaders({ 'x-custom': 'modified' });
      };

      setup.get('/modify', handler, {
        beforeHooks: [],
        afterHooks: [afterHook],
      });

      const context = new ContextImpl('GET /modify HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual({ original: true });
      expect(context._response._statusCode).toBe(httpStatusCode.created);
      expect(context._response._headers['x-custom']).toBe('modified');
    });
  });

  describe('handle - error handling', () => {
    it('should use default error handler when route throws', async () => {
      const errorHandler: HandlerCallback = () => {
        throw new Error('Route error');
      };

      setup.get('/error', errorHandler);
      const context = new ContextImpl('GET /error HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual({
        success: false,
        message: 'Internal Server Error',
      });
    });

    it('should use custom error handler when provided', async () => {
      const customErrorResponse = { error: 'Custom error', code: 'E001' };

      setup.onError(() => customErrorResponse);

      const errorHandler: HandlerCallback = () => {
        throw new Error('Test error');
      };

      setup.get('/custom-error', errorHandler);
      const context = new ContextImpl('GET /custom-error HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual(customErrorResponse);
    });

    it('should handle errors in beforeAll hooks', async () => {
      const errorBeforeHook: HandlerCallback = () => {
        throw new Error('Before hook error');
      };

      const routeHandler: HandlerCallback = () => ({ should: 'not execute' });

      setup.beforeAll([errorBeforeHook]);
      setup.get('/before-error', routeHandler);

      const context = new ContextImpl('GET /before-error HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual({
        success: false,
        message: 'Internal Server Error',
      });
    });

    it('should handle errors in afterAll hooks', async () => {
      const routeHandler: HandlerCallback = () => ({ success: true });

      const errorAfterHook: HandlerCallback = () => {
        throw new Error('After hook error');
      };

      setup.afterAll([errorAfterHook]);
      setup.get('/after-error', routeHandler);

      const context = new ContextImpl('GET /after-error HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual({
        success: false,
        message: 'Internal Server Error',
      });
    });

    it('should handle error handler failure with fallback', async () => {
      const brokenErrorHandler: HandlerCallback = () => {
        throw new Error('Error handler is broken');
      };

      setup.onError(brokenErrorHandler);

      const errorRoute: HandlerCallback = () => {
        throw new Error('Original error');
      };

      setup.get('/double-error', errorRoute);
      const context = new ContextImpl('GET /double-error HTTP/1.1\r\n\r\n', setup) as InternalContextImpl;

      await requestHandler.handle(context);

      expect(context._response._body).toEqual({
        success: false,
        message: 'Internal Server Error',
      });
      expect(context._response._statusCode).toBe(httpStatusCode.internalServerError);
    });
  });

  describe('handle - different HTTP methods', () => {
    const httpMethods = [
      { method: 'GET', setupMethod: 'get', request: 'GET /test HTTP/1.1\r\n\r\n' },
      { method: 'POST', setupMethod: 'post', request: createPostRequest('/test', '{"data": true}') },
      { method: 'PUT', setupMethod: 'put', request: 'PUT /test HTTP/1.1\r\n\r\n' },
      { method: 'DELETE', setupMethod: 'delete', request: 'DELETE /test HTTP/1.1\r\n\r\n' },
      { method: 'PATCH', setupMethod: 'patch', request: 'PATCH /test HTTP/1.1\r\n\r\n' },
    ];

    httpMethods.forEach(({ method, setupMethod, request }) => {
      it(`should handle ${method} requests`, async () => {
        const responseData = { method, handled: true };
        const handler: HandlerCallback = () => responseData;

        (setup as any)[setupMethod]('/test', handler);
        const context = new ContextImpl(request, setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._body).toEqual(responseData);
      });
    });
  });

  describe('HEAD Request Handling', () => {
    describe('Basic HEAD Request Processing', () => {
      it('should handle HEAD requests for existing GET routes', async () => {
        const responseData = { message: 'GET route data', id: 123 };
        const getHandler: HandlerCallback = () => responseData;

        setup.get('/api/data', getHandler);
        const context = new ContextImpl(createHeadRequest('/api/data'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        // Should process the route but remove the body
        expect(context._response._body).toBeNull();
        expect(context._response._statusCode).toBe(httpStatusCode.ok);
      });

      it('should preserve headers for HEAD requests', async () => {
        const getHandler: HandlerCallback = (ctx) => {
          ctx.response.addHeaders({
            'Content-Type': 'application/json',
            'X-Custom-Header': 'test-value',
            'Cache-Control': 'max-age=3600',
          });
          return { data: 'test' };
        };

        setup.get('/api/headers', getHandler);
        const context = new ContextImpl(createHeadRequest('/api/headers'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._body).toBeNull();
        expect(context._response._headers['Content-Type']).toBe('application/json');
        expect(context._response._headers['X-Custom-Header']).toBe('test-value');
        expect(context._response._headers['Cache-Control']).toBe('max-age=3600');
      });

      it('should execute all hooks for HEAD requests', async () => {
        const executionOrder: Array<string> = [];

        const beforeHook: HandlerCallback = () => executionOrder.push('before');
        const routeHandler: HandlerCallback = () => {
          executionOrder.push('route');
          return { data: 'test' };
        };
        const afterHook: HandlerCallback = () => executionOrder.push('after');

        setup.beforeAll([beforeHook]);
        setup.afterAll([afterHook]);
        setup.get('/api/hooks', routeHandler);

        const context = new ContextImpl(createHeadRequest('/api/hooks'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(executionOrder).toEqual(['before', 'route', 'after']);
        expect(context._response._body).toBeNull();
      });
    });

    describe('HEAD Request Edge Cases', () => {
      it('should handle HEAD requests to routes that return large responses', async () => {
        const largeData = {
          items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` })),
          metadata: { total: 1000, page: 1 },
        };

        const handler: HandlerCallback = () => largeData;
        setup.get('/api/large', handler);
        const context = new ContextImpl(createHeadRequest('/api/large'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._body).toBeNull();
        expect(context._response._statusCode).toBe(httpStatusCode.ok);
      });

      it('should handle HEAD requests with custom status codes', async () => {
        const handler: HandlerCallback = (ctx) => {
          ctx.response.setStatusCode(httpStatusCode.created);
          return { created: true };
        };

        setup.get('/api/created', handler);
        const context = new ContextImpl(createHeadRequest('/api/created'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._body).toBe(null); // HEAD requests have body set to null
        expect(context._response._statusCode).toBe(httpStatusCode.created);
      });

      it('should handle HEAD request errors properly', async () => {
        const errorHandler: HandlerCallback = () => {
          throw new Error('Route error in HEAD request');
        };

        setup.get('/api/error', errorHandler);
        const context = new ContextImpl(createHeadRequest('/api/error'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._body).toEqual({
          success: false,
          message: 'Internal Server Error',
        });
        expect(context._response._statusCode).toBe(httpStatusCode.internalServerError);
      });
    });

    describe('HEAD with CORS Integration', () => {
      it('should handle HEAD requests with CORS enabled', async () => {
        // Enable CORS
        setup._configuration.cors = {
          enabled: true,
          origin: 'https://example.com',
          credentials: false,
          methods: ['GET', 'HEAD', 'POST'],
          allowedHeaders: ['Content-Type'],
          exposedHeaders: [],
          maxAge: 86400,
          optionsSuccessStatus: 204,
          preflightContinue: false,
        };

        const handler: HandlerCallback = () => ({ data: 'test' });
        setup.get('/api/cors', handler);

        const context = new ContextImpl(createHeadRequest('/api/cors', { origin: 'https://example.com' }), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        // SECURITY: With secure CORS implementation, non-OPTIONS requests from authorized origins
        // now correctly get CORS headers set
        expect(context._response._body).toBe(''); // Default body value
        expect(context._response._statusCode).toBe(200); // Default status code
        // CORS headers are now correctly set for non-OPTIONS requests from authorized origins
        expect(context._response._headers['Access-Control-Allow-Origin']).toBe('https://example.com');
      });
    });
  });

  describe('OPTIONS Request Handling', () => {
    describe('Regular OPTIONS Requests', () => {
      it('should handle registered OPTIONS routes', async () => {
        const optionsResponse = { methods: ['GET', 'POST', 'OPTIONS'], description: 'API options' };
        const optionsHandler: HandlerCallback = () => optionsResponse;

        setup.options('/api/options', optionsHandler);
        const context = new ContextImpl(createOptionsRequest('/api/options'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._body).toEqual(optionsResponse);
        expect(context._response._statusCode).toBe(httpStatusCode.ok);
      });

      it('should handle OPTIONS routes with hooks', async () => {
        const executionOrder: Array<string> = [];

        const beforeHook: HandlerCallback = () => executionOrder.push('before');
        const optionsHandler: HandlerCallback = () => {
          executionOrder.push('options');
          return { allowed: ['GET', 'POST'] };
        };
        const afterHook: HandlerCallback = () => executionOrder.push('after');

        setup.options('/api/methods', optionsHandler, {
          beforeHooks: [beforeHook],
          afterHooks: [afterHook],
        });

        const context = new ContextImpl(createOptionsRequest('/api/methods'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(executionOrder).toEqual(['before', 'options', 'after']);
        expect(context._response._body).toEqual({ allowed: ['GET', 'POST'] });
      });

      it('should return 404 for OPTIONS requests to non-existent routes', async () => {
        const context = new ContextImpl(createOptionsRequest('/api/nonexistent'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._body).toEqual({
          success: false,
          message: '404 Not Found',
        });
        expect(context._response._statusCode).toBe(httpStatusCode.notFound);
      });
    });

    describe('CORS Preflight OPTIONS Handling', () => {
      it('should handle CORS preflight OPTIONS requests', async () => {
        // Enable CORS
        setup._configuration.cors = {
          enabled: true,
          origin: 'https://example.com',
          credentials: false,
          methods: ['GET', 'POST', 'PUT'],
          allowedHeaders: ['Content-Type', 'Authorization'],
          exposedHeaders: ['X-Total-Count'],
          maxAge: 3600,
          optionsSuccessStatus: 200,
          preflightContinue: false,
        };

        const context = new ContextImpl(
          createOptionsRequest('/api/data', {
            origin: 'https://example.com',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'Content-Type',
          }),
          setup,
        ) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._statusCode).toBe(200);
        expect(context._response._body).toEqual('');
      });

      it('should reject CORS preflight from unauthorized origins', async () => {
        // Enable CORS with restricted origin
        setup._configuration.cors = {
          enabled: true,
          origin: 'https://allowed.com',
          credentials: false,
          methods: ['GET', 'POST'],
          allowedHeaders: ['Content-Type'],
          exposedHeaders: [],
          maxAge: 3600,
          optionsSuccessStatus: 204,
          preflightContinue: false,
        };

        const context = new ContextImpl(
          createOptionsRequest('/api/data', {
            origin: 'https://malicious.com',
            'Access-Control-Request-Method': 'POST',
          }),
          setup,
        ) as InternalContextImpl;

        await requestHandler.handle(context);

        // SECURITY: With secure CORS implementation, unauthorized origins are now properly rejected
        // with 403 Forbidden instead of getting CORS headers set
        expect(context._response._statusCode).toBe(403);
        expect(context._response._body).toEqual({
          error: 'CORS: Origin not allowed',
          origin: 'https://malicious.com',
        });
        // SECURITY: Unauthorized origins should not get CORS headers
        expect(context._response._headers['Access-Control-Allow-Origin']).toBeUndefined();
      });

      it('should handle preflight with preflightContinue enabled', async () => {
        // Setup a regular OPTIONS route
        setup.options('/api/data', () => ({ message: 'Options route' }));

        // Enable CORS with preflightContinue
        setup._configuration.cors = {
          enabled: true,
          origin: '*',
          credentials: false,
          methods: ['GET', 'POST'],
          allowedHeaders: ['Content-Type'],
          exposedHeaders: [],
          maxAge: 3600,
          optionsSuccessStatus: 204,
          preflightContinue: true, // Should return true and cause early return
        };

        const context = new ContextImpl(
          createOptionsRequest('/api/data', {
            'Access-Control-Request-Method': 'POST',
          }),
          setup,
        ) as InternalContextImpl;

        await requestHandler.handle(context);

        // With preflightContinue: true, CORS returns true, causing RequestHandler to return early
        // The response remains in the state CORS left it
        expect(context._response._statusCode).toBe(204); // optionsSuccessStatus
        expect(context._response._headers['Access-Control-Allow-Origin']).toBe('*');
        expect(context._response._headers['Access-Control-Allow-Methods']).toBe('GET, POST');
        expect(context._response._body).toEqual({ message: 'Options route' });
      });
    });

    describe('OPTIONS Edge Cases', () => {
      it('should handle OPTIONS requests with custom error handlers', async () => {
        const customErrorResponse = { error: 'Options error', type: 'OPTIONS_ERROR' };
        setup.onError(() => customErrorResponse);

        const errorHandler: HandlerCallback = () => {
          throw new Error('Options route error');
        };

        setup.options('/api/error', errorHandler);
        const context = new ContextImpl(createOptionsRequest('/api/error'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(context._response._body).toEqual(customErrorResponse);
      });

      it('should handle OPTIONS requests with authentication hooks', async () => {
        const authResults: Array<string> = [];

        const authHook: HandlerCallback = (ctx) => {
          authResults.push('authenticated');
          ctx.response.addHeaders({ 'X-Authenticated': 'true' });
        };

        const optionsHandler: HandlerCallback = () => {
          authResults.push('options-executed');
          return { authenticated: true };
        };

        setup.beforeAll([authHook]);
        setup.options('/api/secure', optionsHandler);

        const context = new ContextImpl(createOptionsRequest('/api/secure'), setup) as InternalContextImpl;

        await requestHandler.handle(context);

        expect(authResults).toEqual(['authenticated', 'options-executed']);
        expect(context._response._headers['X-Authenticated']).toBe('true');
        expect(context._response._body).toEqual({ authenticated: true });
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete request lifecycle with all features', async () => {
      const executionLog: Array<string> = [];
      const responseData = {
        message: 'Complete workflow',
        timestamp: expect.any(Number),
      };

      // Setup all types of hooks
      const authHook: HandlerCallback = () => {
        executionLog.push('auth');
      };

      const loggingHook: HandlerCallback = () => {
        executionLog.push('logging');
      };

      const beforeRouteHook: HandlerCallback = (ctx) => {
        executionLog.push('beforeRoute');
        ctx.response.addHeaders({ 'x-before': 'true' });
      };

      const routeHandler: HandlerCallback = (_) => {
        executionLog.push('route');
        return {
          message: 'Complete workflow',
          timestamp: Date.now(),
        };
      };

      const afterRouteHook: HandlerCallback = (ctx) => {
        executionLog.push('afterRoute');
        ctx.response.addHeaders({ 'x-after': 'true' });
      };

      const cleanupHook: HandlerCallback = () => {
        executionLog.push('cleanup');
      };

      setup.beforeAll([authHook, loggingHook]);
      setup.afterAll([cleanupHook]);
      setup.post('/complete', routeHandler, {
        beforeHooks: [beforeRouteHook],
        afterHooks: [afterRouteHook],
      });

      const context = new ContextImpl(createPostRequest('/complete', '{"test": "data"}'), setup) as InternalContextImpl;

      await requestHandler.handle(context);

      // Verify execution order
      expect(executionLog).toEqual(['auth', 'logging', 'beforeRoute', 'route', 'afterRoute', 'cleanup']);

      // Verify response
      expect(context._response._body).toEqual(responseData);

      // Verify headers from hooks
      expect(context._response._headers['x-before']).toBe('true');
      expect(context._response._headers['x-after']).toBe('true');
    });

    it('should handle mixed HEAD, OPTIONS, and regular requests in complex scenarios', async () => {
      // Setup CORS
      setup._configuration.cors = {
        enabled: true,
        origin: '*',
        credentials: false,
        methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
        exposedHeaders: [],
        maxAge: 3600,
        optionsSuccessStatus: 204,
        preflightContinue: false,
      };

      // Setup routes
      const apiHandler: HandlerCallback = () => ({ data: 'API response', items: [1, 2, 3] });
      setup.get('/api/data', apiHandler);
      setup.options('/api/info', () => ({ methods: ['GET', 'POST'] }));

      // Test HEAD request
      const headContext = new ContextImpl(createHeadRequest('/api/data'), setup) as InternalContextImpl;
      await requestHandler.handle(headContext);
      // With CORS enabled, HEAD requests return early from CORS handler, so body remains default value
      expect(headContext._response._body).toBe('');
      expect(headContext._response._statusCode).toBe(httpStatusCode.ok);

      // Test CORS preflight
      const preflightContext = new ContextImpl(createOptionsRequest('/api/data', { 'Access-Control-Request-Method': 'GET' }), setup) as InternalContextImpl;
      await requestHandler.handle(preflightContext);
      expect(preflightContext._response._statusCode).toBe(204);
      expect(preflightContext._response._body).toEqual('');

      // Test regular OPTIONS route
      const optionsContext = new ContextImpl(createOptionsRequest('/api/info'), setup) as InternalContextImpl;
      await requestHandler.handle(optionsContext);
      expect(optionsContext._response._body).toEqual('');
    });
  });
});
