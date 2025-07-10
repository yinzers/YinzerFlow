import { describe, expect, it } from 'bun:test';
import { httpMethod, httpStatus, httpStatusCode } from '@constants/http.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';

// Reusable test data builders
const createTestHooks = () => ({
  beforeHook: () => {},
  afterHook: () => {},
  beforeHook2: () => true,
  afterHook2: () => true,
});

const createHookOptions = (routesToExclude: Array<string> = [], routesToInclude: Array<string> = []) => ({
  routesToExclude,
  routesToInclude,
});

const createErrorHandlerResponse = (statusCode: number, status: string, message: string) => () => ({
  statusCode,
  status,
  headers: {},
  body: message,
});

describe('SetupImpl', () => {
  // Configurations are tested in handleCustomConfiguration.spec.ts

  describe('Route Registration', () => {
    const httpMethods = [
      { method: 'get', httpMethodConstant: httpMethod.get },
      { method: 'post', httpMethodConstant: httpMethod.post },
      { method: 'put', httpMethodConstant: httpMethod.put },
      { method: 'patch', httpMethodConstant: httpMethod.patch },
      { method: 'delete', httpMethodConstant: httpMethod.delete },
      { method: 'options', httpMethodConstant: httpMethod.options },
    ];

    it.each(httpMethods)('should register $method routes', ({ method, httpMethodConstant }) => {
      const setup = new SetupImpl();
      const hooks = createTestHooks();

      // Register route with the specific method
      (setup as any)[method]('/', () => {}, {
        beforeHooks: [hooks.beforeHook],
        afterHooks: [hooks.afterHook],
      });

      expect(setup._routeRegistry._findRoute(httpMethodConstant, '/')).toBeDefined();
    });

    describe('HEAD Request Integration', () => {
      it('should automatically register HEAD routes for GET routes', () => {
        const setup = new SetupImpl();
        setup.get('/', () => {});

        const getRoute = setup._routeRegistry._findRoute(httpMethod.get, '/');
        const headRoute = setup._routeRegistry._findRoute(httpMethod.head, '/');

        expect(getRoute).toBeDefined();
        expect(headRoute).toBeDefined();
        if (getRoute && headRoute) {
          expect(getRoute.handler).toBe(headRoute.handler); // Same handler
        }
      });

      it('should inherit hooks from GET route for HEAD route', () => {
        const setup = new SetupImpl();
        const hooks = createTestHooks();

        setup.get('/api/data', () => ({ data: 'test' }), {
          beforeHooks: [hooks.beforeHook],
          afterHooks: [hooks.afterHook],
        });

        const getRoute = setup._routeRegistry._findRoute(httpMethod.get, '/api/data');
        const headRoute = setup._routeRegistry._findRoute(httpMethod.head, '/api/data');

        if (getRoute && headRoute) {
          expect(getRoute.options.beforeHooks).toEqual(headRoute.options.beforeHooks);
          expect(getRoute.options.afterHooks).toEqual(headRoute.options.afterHooks);
        }
      });

      it('should register HEAD routes in groups with GET routes', () => {
        const setup = new SetupImpl();

        setup.group('/api', (group) => {
          group.get('/users', () => {});
          group.get('/posts', () => {});
        });

        expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/users')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/users')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/posts')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/posts')).toBeDefined();
      });
    });

    describe('OPTIONS Method Integration', () => {
      it('should register OPTIONS routes independently', () => {
        const setup = new SetupImpl();
        const optionsHandler = () => ({ methods: ['GET', 'POST', 'OPTIONS'] });

        setup.options('/api/methods', optionsHandler);

        const optionsRoute = setup._routeRegistry._findRoute(httpMethod.options, '/api/methods');
        expect(optionsRoute).toBeDefined();
        expect(optionsRoute?.handler).toBe(optionsHandler);
      });

      it('should handle OPTIONS routes with hooks', () => {
        const setup = new SetupImpl();
        const hooks = createTestHooks();
        const optionsHandler = () => ({ available: true });

        setup.options('/api/options', optionsHandler, {
          beforeHooks: [hooks.beforeHook],
          afterHooks: [hooks.afterHook],
        });

        const optionsRoute = setup._routeRegistry._findRoute(httpMethod.options, '/api/options');
        expect(optionsRoute?.options.beforeHooks).toEqual([hooks.beforeHook]);
        expect(optionsRoute?.options.afterHooks).toEqual([hooks.afterHook]);
      });

      it('should register OPTIONS routes in groups', () => {
        const setup = new SetupImpl();
        const groupHooks = createTestHooks();

        setup.group(
          '/api',
          (group) => {
            group.options('/status', () => ({ status: 'available' }));
            group.get('/data', () => ({ data: 'test' }));
          },
          {
            beforeHooks: [groupHooks.beforeHook],
            afterHooks: [groupHooks.afterHook],
          },
        );

        const optionsRoute = setup._routeRegistry._findRoute(httpMethod.options, '/api/status');
        const getRoute = setup._routeRegistry._findRoute(httpMethod.get, '/api/data');

        expect(optionsRoute).toBeDefined();
        expect(getRoute).toBeDefined();

        // Both should inherit group hooks
        expect(optionsRoute?.options.beforeHooks).toContain(groupHooks.beforeHook);
        expect(optionsRoute?.options.afterHooks).toContain(groupHooks.afterHook);
      });
    });

    describe('Route Groups', () => {
      it('should register a group of routes', () => {
        const setup = new SetupImpl();
        setup.group('/api', (group) => {
          group.get('/users', () => {});
          group.post('/users', () => {});
        });

        expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/users')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.post, '/api/users')).toBeDefined();
      });

      it('should merge group and route hooks in correct execution order', () => {
        const setup = new SetupImpl();
        const executionOrder: Array<string> = [];

        const groupBeforeHook = () => executionOrder.push('beforeGroup');
        const routeBeforeHook = () => executionOrder.push('beforeRoute');
        const routeAfterHook = () => executionOrder.push('afterRoute');
        const groupAfterHook = () => executionOrder.push('afterGroup');

        setup.group(
          '/api',
          (group) => {
            group.get('/users', () => executionOrder.push('handler'), {
              beforeHooks: [routeBeforeHook],
              afterHooks: [routeAfterHook],
            });
          },
          {
            beforeHooks: [groupBeforeHook],
            afterHooks: [groupAfterHook],
          },
        );

        const routeMatch = setup._routeRegistry._findRoute(httpMethod.get, '/api/users');

        // Should be: [groupBefore, routeBefore]
        expect(routeMatch?.options.beforeHooks).toEqual([groupBeforeHook, routeBeforeHook]);

        // Should be: [routeAfter, groupAfter]
        expect(routeMatch?.options.afterHooks).toEqual([routeAfterHook, groupAfterHook]);
      });

      it('should handle mixed HTTP methods in groups including HEAD and OPTIONS', () => {
        const setup = new SetupImpl();

        setup.group('/api', (group) => {
          group.get('/data', () => ({ data: 'test' })); // Should auto-register HEAD
          group.post('/data', () => ({ created: true }));
          group.options('/info', () => ({ methods: ['GET', 'POST'] }));
          group.delete('/data', () => ({ deleted: true }));
        });

        // Verify all methods are registered
        expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/data')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/data')).toBeDefined(); // Auto-registered
        expect(setup._routeRegistry._findRoute(httpMethod.post, '/api/data')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.options, '/api/info')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.delete, '/api/data')).toBeDefined();
      });
    });
  });

  describe('Hook Management', () => {
    describe('Global Hooks', () => {
      it('should register beforeAll and afterAll hooks', () => {
        const setup = new SetupImpl();
        const hooks = createTestHooks();

        setup.beforeAll([hooks.beforeHook], createHookOptions());
        setup.beforeAll([hooks.beforeHook2], createHookOptions(['/api/users']));
        setup.afterAll([hooks.afterHook], createHookOptions());
        setup.afterAll([hooks.afterHook2], createHookOptions([], ['/api/users']));

        expect(setup._hooks._beforeAll.size).toBe(2);
        expect(setup._hooks._afterAll.size).toBe(2);
        expect(setup._hooks._beforeAll).toEqual(
          new Set([
            { handler: hooks.beforeHook, options: createHookOptions() },
            { handler: hooks.beforeHook2, options: createHookOptions(['/api/users']) },
          ]),
        );
        expect(setup._hooks._afterAll).toEqual(
          new Set([
            { handler: hooks.afterHook, options: createHookOptions() },
            { handler: hooks.afterHook2, options: createHookOptions([], ['/api/users']) },
          ]),
        );
      });

      it('should apply global hooks to HEAD and OPTIONS routes', () => {
        const setup = new SetupImpl();
        const globalHooks = createTestHooks();

        setup.beforeAll([globalHooks.beforeHook]);
        setup.afterAll([globalHooks.afterHook]);

        // Register routes
        setup.get('/api/data', () => ({ data: 'test' })); // Auto-registers HEAD
        setup.options('/api/methods', () => ({ methods: ['GET', 'POST'] }));

        // Global hooks should apply to all routes
        expect(setup._hooks._beforeAll.size).toBe(1);
        expect(setup._hooks._afterAll.size).toBe(1);

        // Verify routes exist and will use global hooks
        expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/data')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/data')).toBeDefined();
        expect(setup._routeRegistry._findRoute(httpMethod.options, '/api/methods')).toBeDefined();
      });
    });

    describe('Error Handling Hooks', () => {
      const errorHandlerTestCases = [
        {
          hookName: 'onError' as const,
          hookProperty: '_onError' as const,
          statusCode: httpStatusCode.internalServerError,
          status: httpStatus.internalServerError,
          message: 'This is a custom onError hook',
        },
        {
          hookName: 'onNotFound' as const,
          hookProperty: '_onNotFound' as const,
          statusCode: httpStatusCode.notFound,
          status: httpStatus.notFound,
          message: 'This is a custom onNotFound hook',
        },
      ];

      it.each(errorHandlerTestCases)('should have default $hookName hook', ({ hookProperty }) => {
        const setup = new SetupImpl();

        expect(setup._hooks[hookProperty]).toBeDefined();
        expect(setup._hooks[hookProperty]).toBeInstanceOf(Function);
      });

      it.each(errorHandlerTestCases)('should override $hookName hook', ({ hookName, hookProperty, statusCode, status, message }) => {
        const setup = new SetupImpl();
        const customHandler = createErrorHandlerResponse(statusCode, status, message);

        (setup as any)[hookName](customHandler);

        expect(setup._hooks[hookProperty]).toEqual(customHandler);
      });

      it('should apply error handlers to HEAD and OPTIONS routes', () => {
        const setup = new SetupImpl();
        const customErrorHandler = createErrorHandlerResponse(500, 'Internal Server Error', 'Custom error');
        const customNotFoundHandler = createErrorHandlerResponse(404, 'Not Found', 'Custom not found');

        setup.onError(customErrorHandler);
        setup.onNotFound(customNotFoundHandler);

        // Register routes that could trigger errors
        setup.get('/api/data', () => ({ data: 'test' })); // Auto-registers HEAD
        setup.options('/api/methods', () => ({ methods: ['GET'] }));

        // Error handlers should be available for all routes
        expect(setup._hooks._onError).toBe(customErrorHandler);
        expect(setup._hooks._onNotFound).toBe(customNotFoundHandler);
      });
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle complete setup with HEAD, OPTIONS, and regular routes', () => {
      const setup = new SetupImpl();
      const globalHooks = createTestHooks();
      const groupHooks = createTestHooks();

      // Setup global hooks
      setup.beforeAll([globalHooks.beforeHook]);
      setup.afterAll([globalHooks.afterHook]);

      // Setup custom error handlers
      setup.onError(createErrorHandlerResponse(500, 'Internal Server Error', 'Custom error'));
      setup.onNotFound(createErrorHandlerResponse(404, 'Not Found', 'Custom not found'));

      // Setup routes with groups
      setup.group(
        '/api',
        (group) => {
          group.get('/users', () => ({ users: [] })); // Auto-registers HEAD
          group.post('/users', () => ({ created: true }));
          group.options('/info', () => ({ methods: ['GET', 'POST', 'OPTIONS'] }));
        },
        {
          beforeHooks: [groupHooks.beforeHook],
          afterHooks: [groupHooks.afterHook],
        },
      );

      // Register admin routes separately to test nested-like behavior
      setup.group(
        '/api/admin',
        (adminGroup) => {
          adminGroup.get('/stats', () => ({ stats: {} })); // Auto-registers HEAD
          adminGroup.options('/capabilities', () => ({ admin: true }));
        },
        {
          beforeHooks: [groupHooks.beforeHook],
          afterHooks: [groupHooks.afterHook],
        },
      );

      // Verify all routes are registered
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/users')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/users')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.post, '/api/users')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.options, '/api/info')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/admin/stats')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/admin/stats')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.options, '/api/admin/capabilities')).toBeDefined();

      // Verify hook inheritance
      const userGetRoute = setup._routeRegistry._findRoute(httpMethod.get, '/api/users');
      const userHeadRoute = setup._routeRegistry._findRoute(httpMethod.head, '/api/users');
      const optionsRoute = setup._routeRegistry._findRoute(httpMethod.options, '/api/info');

      expect(userGetRoute?.options.beforeHooks).toContain(groupHooks.beforeHook);
      expect(userHeadRoute?.options.beforeHooks).toContain(groupHooks.beforeHook);
      expect(optionsRoute?.options.beforeHooks).toContain(groupHooks.beforeHook);

      // Verify global hooks and error handlers are set
      expect(setup._hooks._beforeAll.size).toBe(1);
      expect(setup._hooks._afterAll.size).toBe(1);
      expect(setup._hooks._onError).toBeDefined();
      expect(setup._hooks._onNotFound).toBeDefined();
    });

    it('should automatically register HEAD routes that share handlers with GET routes', () => {
      const setup = new SetupImpl();
      const getHandler = () => ({ type: 'GET', data: 'full response' });

      // Register GET route (auto-registers HEAD)
      setup.get('/api/resource', getHandler);

      const getRoute = setup._routeRegistry._findRoute(httpMethod.get, '/api/resource');
      const headRoute = setup._routeRegistry._findRoute(httpMethod.head, '/api/resource');

      expect(getRoute).toBeDefined();
      expect(headRoute).toBeDefined();
      if (getRoute && headRoute) {
        expect(getRoute.handler).toBe(getHandler);
        expect(headRoute.handler).toBe(getHandler); // Should share the same handler
        expect(getRoute.handler).toBe(headRoute.handler);
      }
    });
  });
});
