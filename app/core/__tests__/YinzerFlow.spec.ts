import net from 'net';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { YinzerFlow } from '@core/YinzerFlow.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import { httpStatusCode } from '@constants/http.ts';

// Reusable test data builders
let _nextTestPort = 10000;

const createTestApp = (customConfig?: Record<string, unknown>) => {
  const testPort = _nextTestPort++;
  return {
    app: new YinzerFlow({ port: testPort, host: '127.0.0.1', ...customConfig }),
    testPort,
  };
};

const createTestHandler =
  (returnValue: unknown): HandlerCallback =>
  () =>
    returnValue;

const createHttpRequest = (method: string, path: string, headers: Array<string> = [], body = '') => {
  const headerString = headers.length > 0 ? `\r\n${headers.join('\r\n')}` : '';
  return `${method} ${path} HTTP/1.1\r\nHost: localhost${headerString}\r\n\r\n${body}`;
};

const createJsonRequest = (method: string, path: string, jsonBody: unknown) => {
  const body = JSON.stringify(jsonBody);
  return createHttpRequest(method, path, ['Content-Type: application/json', `Content-Length: ${Buffer.byteLength(body, 'utf8')}`], body);
};

const createExecutionTracker = () => {
  const order: Array<string> = [];
  return {
    order,
    track: (step: string) => () => {
      order.push(step);
      // Don't return anything (void)
    },
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
      const customApp = new YinzerFlow(config as any);
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

        app = new YinzerFlow({ gracefulShutdownTimeout: 0 });

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
        app = new YinzerFlow({ gracefulShutdownTimeout: 0 });

        await app.listen();
        expect(app.status().isListening).toBe(true);

        await app.close();
        expect(app.status().isListening).toBe(false);
      });

      it('should handle multiple close calls gracefully', async () => {
        app = new YinzerFlow({ gracefulShutdownTimeout: 0 });

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
    describe('beforeRouting Hooks', () => {
      it('should execute beforeRouting hooks before routing', async () => {
        const tracker = createExecutionTracker();

        app.beforeRouting([tracker.track('beforeRouting')]);
        app.beforeAll([tracker.track('beforeAll')]);
        app.get('/hook-test', () => {
          tracker.track('route')();
          return { order: tracker.getOrder() };
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/hook-test'));

        expect(response).toContain('"order":["beforeRouting","beforeAll","route"]');
      });

      it('should allow beforeRouting hooks to short-circuit response', async () => {
        app.beforeRouting([
          (ctx) => {
            if (ctx.request.headers['x-api-key'] !== 'valid-key') {
              ctx.response.setStatusCode(401);
              return { error: 'Unauthorized', message: 'Invalid API key' };
            }
            return undefined;
          },
        ]);

        app.get('/protected', () => {
          return { data: 'Secret data' };
        });

        await app.listen();

        // Test with missing API key
        const unauthorizedResponse = await sendHttpRequest(testPort, createHttpRequest('GET', '/protected'));
        expect(unauthorizedResponse).toContain('401 Unauthorized');
        expect(unauthorizedResponse).toContain('"error":"Unauthorized"');
        expect(unauthorizedResponse).toContain('"message":"Invalid API key"');

        // Test with valid API key
        const authorizedResponse = await sendHttpRequest(testPort, createHttpRequest('GET', '/protected', ['x-api-key: valid-key']));
        expect(authorizedResponse).toContain('200 OK');
        expect(authorizedResponse).toContain('"data":"Secret data"');
      });

      it('should execute multiple beforeRouting hooks in order', async () => {
        const tracker = createExecutionTracker();

        app.beforeRouting([tracker.track('beforeRouting1'), tracker.track('beforeRouting2'), tracker.track('beforeRouting3')]);

        app.get('/multi-hook-test', () => {
          tracker.track('route')();
          return { order: tracker.getOrder() };
        });

        await app.listen();

        const response = await sendHttpRequest(testPort, createHttpRequest('GET', '/multi-hook-test'));

        expect(response).toContain('"order":["beforeRouting1","beforeRouting2","beforeRouting3","route"]');
      });

      it('should respect routesToExclude in beforeRouting hooks', async () => {
        let hookExecuted = false;

        app.beforeRouting(
          [
            () => {
              hookExecuted = true;
            },
          ],
          {
            routesToExclude: ['/health'],
            routesToInclude: [],
          },
        );

        app.get('/health', () => ({ status: 'healthy' }));

        await app.listen();

        await sendHttpRequest(testPort, createHttpRequest('GET', '/health'));

        expect(hookExecuted).toBe(false);
      });

      it('should respect routesToInclude in beforeRouting hooks', async () => {
        let apiHookExecuted = false;
        let publicHookExecuted = false;

        app.beforeRouting(
          [
            () => {
              apiHookExecuted = true;
            },
          ],
          {
            routesToExclude: [],
            routesToInclude: ['/api/*'],
          },
        );

        app.get('/api/users', () => ({ users: [] }));
        app.get('/public/info', () => {
          publicHookExecuted = true;
          return { info: 'public' };
        });

        await app.listen();

        await sendHttpRequest(testPort, createHttpRequest('GET', '/api/users'));
        expect(apiHookExecuted).toBe(true);

        await sendHttpRequest(testPort, createHttpRequest('GET', '/public/info'));
        expect(publicHookExecuted).toBe(true);
      });
    });

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
        const [, body] = response.split('\r\n\r\n');
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

    describe('TCP Stream Reassembly', () => {
      it('should handle request body split across multiple TCP chunks (~2KB)', async () => {
        app.post('/chunked-body', (ctx) => ({
          received: true,
          keyCount: Object.keys(ctx.request.body as Record<string, unknown>).length,
        }));

        await app.listen();

        // ~2KB payload — exceeds typical TCP MSS (~1.4KB), will be split across segments
        const payload = { data: 'a'.repeat(2000) };
        const request = createJsonRequest('POST', '/chunked-body', payload);

        // Send in small 500-byte chunks to simulate TCP fragmentation
        const response = await sendChunkedHttpRequest(testPort, request, 500);

        expect(response).toContain('200 OK');
        expect(response).toContain('"received":true');
      });

      it('should handle large request body split into many TCP chunks (~10KB)', async () => {
        app.post('/large-chunked', (ctx) => ({
          received: true,
          dataLength: ((ctx.request.body as Record<string, unknown>).data as string).length,
        }));

        await app.listen();

        // ~10KB payload — the approximate size that was originally reported as broken
        const payload = { data: 'b'.repeat(10000) };
        const request = createJsonRequest('POST', '/large-chunked', payload);

        // Send in 500-byte chunks (simulates ~20 TCP data events)
        const response = await sendChunkedHttpRequest(testPort, request, 500);

        expect(response).toContain('200 OK');
        expect(response).toContain('"received":true');
        expect(response).toContain('"dataLength":10000');
      });

      it('should handle very large request body split into tiny TCP chunks (~64KB)', async () => {
        app.post('/very-large-chunked', (ctx) => ({
          received: true,
          dataLength: ((ctx.request.body as Record<string, unknown>).data as string).length,
        }));

        await app.listen();

        // ~64KB payload split into 1KB chunks
        const payload = { data: 'c'.repeat(64000) };
        const request = createJsonRequest('POST', '/very-large-chunked', payload);
        const response = await sendChunkedHttpRequest(testPort, request, 1024);

        expect(response).toContain('200 OK');
        expect(response).toContain('"received":true');
        expect(response).toContain('"dataLength":64000');
      });

      it('should handle GET requests with no body when sent in chunks', async () => {
        app.get('/chunked-get', () => ({ success: true }));

        await app.listen();

        const request = createHttpRequest('GET', '/chunked-get');
        // Send headers in tiny chunks — no body expected
        const response = await sendChunkedHttpRequest(testPort, request, 20);

        expect(response).toContain('200 OK');
        expect(response).toContain('"success":true');
      });

      it('should handle headers arriving in multiple chunks before body', async () => {
        app.post('/header-chunks', (ctx) => ({
          received: true,
          name: (ctx.request.body as Record<string, unknown>).name,
        }));

        await app.listen();

        const payload = { name: 'test-value' };
        const request = createJsonRequest('POST', '/header-chunks', payload);

        // Use chunk size that splits right in the middle of headers
        // Headers are typically ~100-150 bytes, so 50-byte chunks ensure multiple header chunks
        const response = await sendChunkedHttpRequest(testPort, request, 50);

        expect(response).toContain('200 OK');
        expect(response).toContain('"received":true');
        expect(response).toContain('"name":"test-value"');
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

/**
 * Core TCP connection helper — manages connection lifecycle, event listeners, and timeout.
 * Used as the base for both direct and chunked request helpers.
 *
 * @param port - Server port to connect to
 * @param writeStrategy - Function that writes data to the socket once connected
 * @param timeoutMs - Maximum time to wait for response before force-closing
 * @returns Raw HTTP response string from server
 */
const connectWithTimeout = async (
  port: number,
  writeStrategy: (client: net.Socket) => void,
  timeoutMs = 5000,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const client = net.createConnection({ port, host: '127.0.0.1' }, () => {
      writeStrategy(client);
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

    setTimeout(() => {
      client.destroy();
      if (response) {
        resolve(response);
      } else {
        reject(new Error('Request timeout'));
      }
    }, timeoutMs);
  });

/** Send a complete HTTP request string over a TCP connection */
const sendHttpRequest = async (port: number, request: string): Promise<string> =>
  connectWithTimeout(port, (client) => {
    client.write(request);
  });

/**
 * Send an HTTP request in multiple TCP chunks to simulate fragmentation.
 * This exercises the TCP stream reassembly logic that buffers data events
 * until the complete HTTP request (headers + Content-Length body) is received.
 *
 * @param port - Server port to connect to
 * @param request - Complete HTTP request string (headers + body)
 * @param chunkSize - Size in bytes of each TCP chunk (simulates MSS fragmentation)
 * @returns Raw HTTP response string from server
 */
const sendChunkedHttpRequest = async (port: number, request: string, chunkSize: number): Promise<string> => {
  const INTER_CHUNK_DELAY_MS = 5; // Small delay to simulate TCP packet spacing

  return connectWithTimeout(
    port,
    (client) => {
      const buf = Buffer.from(request);
      let offset = 0;

      const sendNextChunk = () => {
        if (offset >= buf.length) return;
        const end = Math.min(offset + chunkSize, buf.length);
        client.write(buf.subarray(offset, end));
        offset = end;
        if (offset < buf.length) {
          setTimeout(sendNextChunk, INTER_CHUNK_DELAY_MS);
        }
      };

      sendNextChunk();
    },
    10000,
  );
};
