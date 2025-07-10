import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { YinzerFlow } from '@core/YinzerFlow.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import { httpStatusCode } from '@constants/http.ts';
import type { ServerConfiguration } from '@typedefs/public/Configuration.js';

// Reusable test data builders
const createTestApp = (customConfig?: any) => {
  const testPort = 5000 + Math.floor(Math.random() * 1000);
  return {
    app: new YinzerFlow({ port: testPort, host: '127.0.0.1', ...customConfig }),
    testPort,
  };
};

const createTestHandler =
  (returnValue: any): HandlerCallback =>
  () =>
    returnValue;

const createHttpRequest = (method: string, path: string, headers: Array<string> = [], body = '') => {
  const headerString = headers.length > 0 ? `\r\n${headers.join('\r\n')}` : '';
  return `${method} ${path} HTTP/1.1\r\nHost: localhost${headerString}\r\n\r\n${body}`;
};

const createJsonRequest = (method: string, path: string, jsonBody: any) => {
  const body = JSON.stringify(jsonBody);
  return createHttpRequest(method, path, ['Content-Type: application/json', `Content-Length: ${body.length}`], body);
};

const createExecutionTracker = () => {
  const order: Array<string> = [];
  return {
    order,
    track: (step: string) => () => order.push(step),
    getOrder: () => [...order],
  };
};

describe('YinzerFlow', () => {
  let app: YinzerFlow;
  let testPort: number;

  beforeEach(() => {
    const testSetup = createTestApp();
    ({ app, testPort } = testSetup);
  });

  afterEach(async () => {
    // Force close the server even if the test failed
    try {
      if (app.status().isListening) {
        await app.close();
      }
    } catch (error) {
      // Ignore errors during cleanup
    }
  });

  describe('Server Lifecycle', () => {
    describe('Starting and Stopping', () => {
      it('should start server and update listening status', async () => {
        expect(app.status().isListening).toBe(false);

        await app.listen();

        expect(app.status().isListening).toBe(true);
        expect(app.status().port).toBe(testPort);
        expect(app.status().host).toBe('127.0.0.1');
      });

      it('should stop server and update listening status', async () => {
        await app.listen();
        expect(app.status().isListening).toBe(true);

        await app.close();

        expect(app.status().isListening).toBe(false);
      });

      it('should handle multiple close calls gracefully', async () => {
        await app.listen();
        await app.close();

        // Second close should not throw
        await app.close();

        expect(app.status().isListening).toBe(false);
      });

      it('should handle close without listen gracefully', async () => {
        // Should not throw when closing a server that was never started
        await app.close();

        expect(app.status().isListening).toBe(false);
      });

      it('should handle multiple listen calls by rejecting', async () => {
        // First listen should succeed
        await app.listen();
        expect(app.status().isListening).toBe(true);

        // Second listen should fail since server is already listening
        await expect(app.listen()).rejects.toThrow();
        expect(app.status().isListening).toBe(true); // Still listening from first call
      });
    });
  });

  describe('Configuration Handling', () => {
    const configTestCases = [
      {
        description: 'should use default configuration when none provided',
        config: {},
        expectedPort: 5000,
        expectedHost: '0.0.0.0',
      },
      {
        description: 'should use custom port and host configuration',
        config: { port: 8080, host: 'localhost' },
        expectedPort: 8080,
        expectedHost: 'localhost',
      },
      {
        description: 'should handle custom configuration with additional options',
        config: { port: 9000, host: '192.168.1.1', logLevel: 'network' },
        expectedPort: 9000,
        expectedHost: '192.168.1.1',
      },
    ];

    it.each(configTestCases)('$description', ({ config, expectedPort, expectedHost }) => {
      const customApp = new YinzerFlow(config as ServerConfiguration);
      const status = customApp.status();

      expect(status.port).toBe(expectedPort);
      expect(status.host).toBe(expectedHost);
    });
  });

  describe('Graceful Shutdown', () => {
    describe('Auto Graceful Shutdown Configuration', () => {
      it('should enable auto graceful shutdown by default', () => {
        app = new YinzerFlow();
        // Check that signal handlers are set up (indirectly by checking if they exist)
        expect(process.listenerCount('SIGTERM')).toBeGreaterThan(0);
        expect(process.listenerCount('SIGINT')).toBeGreaterThan(0);
      });

      it('should disable auto graceful shutdown when configured', () => {
        const originalSigtermCount = process.listenerCount('SIGTERM');
        const originalSigintCount = process.listenerCount('SIGINT');

        app = new YinzerFlow({ autoGracefulShutdown: false });

        // Should not add additional handlers
        expect(process.listenerCount('SIGTERM')).toBe(originalSigtermCount);
        expect(process.listenerCount('SIGINT')).toBe(originalSigintCount);
      });

      it('should not duplicate signal handlers when multiple instances are created', () => {
        const originalSigtermCount = process.listenerCount('SIGTERM');
        const originalSigintCount = process.listenerCount('SIGINT');

        // Create multiple instances
        /* eslint-disable  no-new*/
        new YinzerFlow();
        new YinzerFlow();
        new YinzerFlow();
        /* eslint-enable */

        // Should not add duplicate handlers
        expect(process.listenerCount('SIGTERM')).toBe(originalSigtermCount);
        expect(process.listenerCount('SIGINT')).toBe(originalSigintCount);
      });
    });

    describe('Manual Graceful Shutdown', () => {
      it('should handle manual graceful shutdown correctly', async () => {
        app = new YinzerFlow({ autoGracefulShutdown: false });

        await app.listen();
        expect(app.status().isListening).toBe(true);

        await app.close();
        expect(app.status().isListening).toBe(false);
      });

      it('should handle multiple close calls gracefully', async () => {
        app = new YinzerFlow({ autoGracefulShutdown: false });

        await app.listen();
        await app.close();

        // Second close should not throw
        await app.close();
        expect(app.status().isListening).toBe(false);
      });
    });
  });

  describe('Route Registration and Handling', () => {
    describe('Basic Route Handling', () => {
      it('should register and handle GET routes', async () => {
        const testResponse = { message: 'GET success' };
        app.get('/test', createTestHandler(testResponse));

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/test'));

        expect(response).toContain('200 OK');
        expect(response).toContain(JSON.stringify(testResponse));
      });

      it('should register and handle POST routes with body', async () => {
        const handler: HandlerCallback = (ctx) => ({ received: ctx.request.body });

        app.post('/api/data', handler);
        await app.listen();

        const response = await sendHttpRequest(testPort, createJsonRequest('POST', '/api/data', { test: 'data' }));

        expect(response).toContain('200 OK');
        expect(response).toContain('"received":{"test":"data"}');
      });
    });

    describe('Route Parameters', () => {
      it('should handle route parameters', async () => {
        app.get('/users/:id/posts/:postId', (ctx) => ({
          userId: ctx.request.params.id,
          postId: ctx.request.params.postId,
        }));

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/users/123/posts/456'));

        expect(response).toContain('200 OK');
        expect(response).toContain('"userId":"123"');
        expect(response).toContain('"postId":"456"');
      });

      it('should handle query parameters', async () => {
        app.get('/search', (ctx) => ({ query: ctx.request.query }));

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/search?q=test&limit=10'));

        expect(response).toContain('200 OK');
        expect(response).toContain('"q":"test"');
        expect(response).toContain('"limit":"10"');
      });
    });
  });

  describe('Hook System Integration', () => {
    describe('Global Hooks', () => {
      it('should execute beforeAll hooks', async () => {
        const tracker = createExecutionTracker();

        app.beforeAll([tracker.track('beforeAll')]);
        app.get('/hook-test', () => {
          tracker.track('route')();
          return { order: tracker.getOrder() };
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/hook-test'));

        expect(response).toContain('"order":["beforeAll","route"]');
      });

      it('should execute afterAll hooks', async () => {
        let afterAllExecuted = false;

        app.afterAll([
          () => {
            afterAllExecuted = true;
          },
        ]);
        app.get('/after-test', createTestHandler({ success: true }));

        await app.listen();

        await sendHttpRequest(testPort, createHttpRequest('GET', '/after-test'));

        // Give a moment for afterAll to execute
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(afterAllExecuted).toBe(true);
      });
    });

    describe('Route-Specific Hooks', () => {
      it('should execute route-specific hooks', async () => {
        const tracker = createExecutionTracker();

        app.get(
          '/route-hooks',
          (ctx) => {
            tracker.track('route')();
            // Store execution order in response headers so after hooks can modify it
            ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
            return { success: true };
          },
          {
            beforeHooks: [tracker.track('beforeRoute')],
            afterHooks: [
              (ctx) => {
                tracker.track('afterRoute')();
                // Update the header with the final execution order
                ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
              },
            ],
          },
        );

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/route-hooks'));

        expect(response).toContain('x-execution-order: ["beforeRoute","route","afterRoute"]');
      });
    });
  });

  describe('Error Handling', () => {
    describe('Route Handler Errors', () => {
      it('should handle route handler errors with default error handler', async () => {
        app.get('/error', () => {
          throw new Error('Route error');
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/error'));

        expect(response).toContain('500 Internal Server Error');
        expect(response).toContain('"success":false');
        expect(response).toContain('"message":"Internal Server Error"');
      });

      it('should handle route handler errors with custom error handler', async () => {
        const customErrorResponse = { error: 'Custom error response', code: 'E001' };

        app.onError((ctx) => {
          ctx.response.setStatusCode(httpStatusCode.internalServerError);
          return customErrorResponse;
        });
        app.get('/custom-error', () => {
          throw new Error('Custom route error');
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/custom-error'));

        expect(response).toContain('500 Internal Server Error');
        expect(response).toContain(JSON.stringify(customErrorResponse));
      });
    });

    describe('Not Found Handling', () => {
      it('should handle not found routes with default handler', async () => {
        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/nonexistent'));

        expect(response).toContain('404 Not Found');
        expect(response).toContain('"success":false');
        expect(response).toContain('"message":"404 Not Found"');
      });

      it('should handle not found routes with custom handler', async () => {
        const customNotFoundResponse = { error: 'Page not found', suggestion: 'Try /api/help' };

        app.onNotFound((ctx) => {
          ctx.response.setStatusCode(httpStatusCode.notFound);
          return customNotFoundResponse;
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/missing'));

        expect(response).toContain('404 Not Found');
        expect(response).toContain(JSON.stringify(customNotFoundResponse));
      });
    });

    describe('Malformed Requests', () => {
      it('should handle malformed HTTP requests gracefully', async () => {
        await app.listen();

        // Send malformed request
        const response = await sendHttpRequest(testPort, 'INVALID REQUEST DATA');

        // Should get some response (likely error or default handling)
        expect(response).toBeTruthy();
      });
    });
  });

  describe('Route Groups', () => {
    it('should handle grouped routes with prefix', async () => {
      app.group('/api', (group) => {
        group.get('/users', createTestHandler({ users: [] }));
        group.post('/users', createTestHandler({ created: true }));
      });

      await app.listen();

      const getResponse = await sendHttpRequest(testPort, createHttpRequest('GET', '/api/users'));
      expect(getResponse).toContain('200 OK');
      expect(getResponse).toContain('"users":[]');

      const postResponse = await sendHttpRequest(testPort, createHttpRequest('POST', '/api/users'));
      expect(postResponse).toContain('200 OK');
      expect(postResponse).toContain('"created":true');
    });

    it('should handle nested groups with hooks', async () => {
      const tracker = createExecutionTracker();

      app.group(
        '/api',
        (group) => {
          group.get('/test', (ctx) => {
            tracker.track('route')();
            ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
            return { success: true };
          });
        },
        {
          beforeHooks: [tracker.track('groupBefore')],
          afterHooks: [
            (ctx) => {
              tracker.track('groupAfter')();
              ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
            },
          ],
        },
      );

      await app.listen();

      const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/api/test'));

      expect(response).toContain('x-execution-order: ["groupBefore","route","groupAfter"]');
    });
  });

  describe('HTTP Methods Support', () => {
    const httpMethods = [
      { method: 'GET', expectBody: true },
      { method: 'HEAD', expectBody: false },
      { method: 'POST', expectBody: true },
      { method: 'PUT', expectBody: true },
      { method: 'DELETE', expectBody: true },
      { method: 'PATCH', expectBody: true },
      { method: 'OPTIONS', expectBody: true },
    ];

    it.each(httpMethods)('should handle $method requests', async ({ method, expectBody }) => {
      const methodLower = method.toLowerCase() as 'delete' | 'get' | 'head' | 'options' | 'patch' | 'post' | 'put';

      app[methodLower]('/method-test', createTestHandler({ method }));

      await app.listen();

      const response = await sendHttpRequest(testPort, createHttpRequest(method, '/method-test'));

      expect(response).toContain('200 OK');

      if (expectBody) {
        expect(response).toContain(`"method":"${method}"`);
      } else {
        // HEAD requests should not have a body
        const [_, body] = response.split('\r\n\r\n');
        expect(body ?? '').toBe('');
      }
    });
  });

  describe('Response Handling', () => {
    describe('Status Codes and Headers', () => {
      it('should handle custom status codes', async () => {
        app.get('/custom-status', (ctx) => {
          ctx.response.setStatusCode(httpStatusCode.created);
          return { created: true };
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/custom-status'));

        expect(response).toContain('201 Created');
        expect(response).toContain('"created":true');
      });

      it('should handle custom headers', async () => {
        app.get('/custom-headers', (ctx) => {
          ctx.response.addHeaders({
            'x-custom-header': 'test-value',
            'cache-control': 'no-cache',
          });
          return { success: true };
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/custom-headers'));

        expect(response).toContain('x-custom-header: test-value');
        expect(response).toContain('cache-control: no-cache');
      });
    });

    describe('Content Types', () => {
      const contentTypeTests = [
        {
          path: '/json',
          handler: () => ({ type: 'json' }),
          expectedContentType: 'Content-Type: application/json',
        },
        {
          path: '/text',
          handler: () => 'Plain text response',
          expectedContentType: 'Content-Type: text/plain',
        },
      ];

      it.each(contentTypeTests)('should handle different response content types for $path', async ({ path, handler, expectedContentType }) => {
        app.get(path, handler);

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', path));

        expect(response).toContain(expectedContentType);
      });

      it('should handle different response data types', async () => {
        app.get('/number', createTestHandler(42));
        app.get('/boolean', createTestHandler(true));

        await app.listen();

        const numberResponse = await sendHttpRequest(testPort, createHttpRequest('GET', '/number'));
        expect(numberResponse).toContain('42');

        const booleanResponse = await sendHttpRequest(testPort, createHttpRequest('GET', '/boolean'));
        expect(booleanResponse).toContain('true');
      });
    });
  });

  describe('Server Error Scenarios', () => {
    describe('Configuration Validation', () => {
      const invalidPortTests = [
        { port: -1, description: 'negative port' },
        { port: 70000, description: 'port too high' },
        { port: 0, description: 'zero port' },
      ];

      it.each(invalidPortTests)('should handle invalid port configuration: $description', ({ port }) => {
        expect(() => new YinzerFlow({ port, host: '127.0.0.1' })).toThrow('Invalid port number');
      });
    });

    describe('Port Conflicts', () => {
      it('should handle port already in use error', async () => {
        // Start first server
        await app.listen();

        // Try to start second server on same port
        const conflictApp = new YinzerFlow({ port: testPort, host: '127.0.0.1' });

        await expect(conflictApp.listen()).rejects.toThrow();
        expect(conflictApp.status().isListening).toBe(false);
      });
    });

    describe('Request Processing Errors', () => {
      it('should handle request processing errors by destroying socket', async () => {
        await app.listen();

        const net = await import('net');

        const errorPromise = new Promise<boolean>((resolve) => {
          const client = net.createConnection({ port: testPort, host: '127.0.0.1' }, () => {
            // Send data that will cause parsing/processing errors
            client.write(Buffer.from([0xff, 0xfe, 0xfd])); // Invalid binary data
          });

          client.on('error', () => resolve(true));
          client.on('close', () => resolve(true));

          // Timeout if no error occurs
          setTimeout(() => resolve(false), 1000);
        });

        const errorOccurred = await errorPromise;
        expect(errorOccurred).toBe(true);
      });

      it('should handle promise rejection in request handler', async () => {
        await app.listen();

        const net = await import('net');

        const promiseRejectionHandled = new Promise<boolean>((resolve) => {
          const client = net.createConnection({ port: testPort, host: '127.0.0.1' }, () => {
            client.write('MALFORMED REQUEST WITHOUT PROPER HTTP FORMAT');
          });

          client.on('close', () => resolve(true));
          client.on('error', () => resolve(true));

          setTimeout(() => resolve(false), 2000);
        });

        const handled = await promiseRejectionHandled;
        expect(handled).toBe(true);
      });
    });
  });

  describe('SetupImpl Integration', () => {
    describe('Hook Registration with Options', () => {
      it('should handle hook registration with options', async () => {
        const tracker = createExecutionTracker();

        app.beforeAll([tracker.track('beforeAll1')], {
          routesToInclude: ['/test'],
          routesToExclude: [],
        });

        app.afterAll(
          [
            (ctx) => {
              tracker.track('afterAll1')();
              ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
            },
          ],
          {
            routesToInclude: [],
            routesToExclude: ['/exclude'],
          },
        );

        app.get('/test', (ctx) => {
          tracker.track('route')();
          ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
          return { success: true };
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/test'));

        expect(response).toContain('200 OK');
        expect(response).toContain('x-execution-order: ["beforeAll1","route","afterAll1"]');
      });

      it('should handle route registration with undefined options', async () => {
        app.get('/undefined-options', createTestHandler({ success: true }), undefined);
        app.post('/undefined-options', createTestHandler({ success: true }), undefined);

        await app.listen();

        const getResponse = await sendHttpRequest(testPort, createHttpRequest('GET', '/undefined-options'));
        expect(getResponse).toContain('200 OK');

        const postResponse = await sendHttpRequest(testPort, createHttpRequest('POST', '/undefined-options'));
        expect(postResponse).toContain('200 OK');
      });

      it('should handle complex group nesting with multiple hook layers', async () => {
        const tracker = createExecutionTracker();

        app.group(
          '/api/v1',
          (group) => {
            group.get(
              '/users/:id',
              (ctx) => {
                tracker.track('route')();
                ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
                return { success: true };
              },
              {
                beforeHooks: [tracker.track('routeBefore')],
                afterHooks: [
                  (ctx) => {
                    tracker.track('routeAfter')();
                    ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
                  },
                ],
              },
            );
          },
          {
            beforeHooks: [tracker.track('groupBefore')],
            afterHooks: [
              (ctx) => {
                tracker.track('groupAfter')();
                ctx.response.addHeaders({ 'x-execution-order': JSON.stringify(tracker.getOrder()) });
              },
            ],
          },
        );

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/api/v1/users/123'));

        expect(response).toContain('200 OK');
        expect(response).toContain('x-execution-order: ["groupBefore","routeBefore","route","routeAfter","groupAfter"]');
      });
    });
  });

  describe('Edge Cases and Integration', () => {
    describe('Request Body Handling', () => {
      it('should handle empty request body', async () => {
        app.post('/empty-body', (ctx) => ({ receivedBody: ctx.request.body }));

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('POST', '/empty-body'));

        expect(response).toContain('200 OK');
      });

      it('should handle large request bodies', async () => {
        app.post('/large-body', (ctx) => ({
          bodyLength: JSON.stringify(ctx.request.body).length,
          received: true,
        }));

        await app.listen();

        const largeData = { data: 'x'.repeat(1000) };
        const response = await sendHttpRequest(testPort, createJsonRequest('POST', '/large-body', largeData));

        expect(response).toContain('200 OK');
        expect(response).toContain('"received":true');
      });
    });

    describe('Concurrency and Performance', () => {
      it('should handle concurrent requests', async () => {
        app.get('/concurrent/:id', (ctx) => ({
          id: ctx.request.params.id,
          timestamp: Date.now(),
        }));

        await app.listen();

        // Send multiple concurrent requests
        const requests = Array.from({ length: 3 }, async (_, i) => sendHttpRequest(testPort, createHttpRequest('GET', `/concurrent/${i}`)));

        const responses = await Promise.all(requests);

        responses.forEach((response, index) => {
          expect(response).toContain('200 OK');
          expect(response).toContain(`"id":"${index}"`);
        });
      });

      it('should handle async route handlers', async () => {
        app.get('/async', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { async: true, delayed: true };
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/async'));

        expect(response).toContain('200 OK');
        expect(response).toContain('"async":true');
        expect(response).toContain('"delayed":true');
      });
    });
  });
});

// Helper function to send HTTP requests to the test server
const sendHttpRequest = async (port: number, request: string): Promise<string> => {
  const net = await import('net');

  return new Promise((resolve, reject) => {
    const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
      client.write(request);
    });

    let response = '';
    client.on('data', (data) => {
      response += data.toString();
    });

    client.on('end', () => {
      resolve(response);
    });

    client.on('error', (error) => {
      reject(error);
    });

    // Set timeout to prevent hanging tests
    setTimeout(() => {
      client.destroy();
      if (response) {
        resolve(response);
      } else {
        reject(new Error('Request timeout'));
      }
    }, 5000);
  });
};
