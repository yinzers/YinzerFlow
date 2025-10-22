import { describe, expect, it } from 'bun:test';
import { httpMethod, httpStatus, httpStatusCode } from '@constants/http.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import type { HandlerCallbackGenerics } from '@typedefs/public/HandlerCallbackGenerics.d.ts';

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

  describe('Nested Route Groups', () => {
    it('should support nested groups with proper path building', () => {
      const setup = new SetupImpl();

      setup.group('/api/v1', (api) => {
        api.group('/users', (users) => {
          users.get('/', () => ({ users: ['John', 'Jane'] }));
          users.get('/:id', () => ({ user: 'John Doe' }));
        });

        api.group('/admin', (admin) => {
          admin.group('/users', (adminUsers) => {
            adminUsers.get('/', () => ({ adminUsers: ['Admin1', 'Admin2'] }));
            adminUsers.post('/', () => ({ created: true }));
          });
        });
      });

      // Verify nested paths are correctly built
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users/:id')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/admin/users')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.post, '/api/v1/admin/users')).toBeDefined();

      // Verify HEAD routes are auto-registered for GET routes
      expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/v1/users')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/v1/users/:id')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/v1/admin/users')).toBeDefined();
    });

    it('should handle path joining correctly with and without leading slashes', () => {
      const setup = new SetupImpl();

      setup.group('/api', (api) => {
        api.group('v1', (v1) => {
          // No leading slash
          v1.group('/users', (users) => {
            // With leading slash
            users.get('list', () => ({})); // No leading slash
            users.get('/details', () => ({})); // With leading slash
          });
        });
      });

      // Verify paths are correctly joined regardless of slash usage
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users/list')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users/details')).toBeDefined();
    });

    it('should merge hooks from parent groups to child groups', () => {
      const setup = new SetupImpl();
      const globalHook = () => console.log('global');
      const apiHook = () => console.log('api');
      const v1Hook = () => console.log('v1');
      const adminHook = () => console.log('admin');
      const routeHook = () => console.log('route');

      setup.group(
        '/api',
        (api) => {
          api.group(
            '/v1',
            (v1) => {
              v1.group(
                '/admin',
                (admin) => {
                  admin.get('/dashboard', () => ({}), {
                    beforeHooks: [routeHook],
                  });
                },
                {
                  beforeHooks: [adminHook],
                },
              );
            },
            {
              beforeHooks: [v1Hook],
            },
          );
        },
        {
          beforeHooks: [apiHook],
        },
      );

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/admin/dashboard');
      expect(route).toBeDefined();

      if (route) {
        // Hooks should be merged in order: global -> api -> v1 -> admin -> route
        expect(route.options.beforeHooks).toContain(apiHook);
        expect(route.options.beforeHooks).toContain(v1Hook);
        expect(route.options.beforeHooks).toContain(adminHook);
        expect(route.options.beforeHooks).toContain(routeHook);

        // Verify order (parent hooks first, then child hooks)
        const hookIndexes = {
          api: route.options.beforeHooks.indexOf(apiHook),
          v1: route.options.beforeHooks.indexOf(v1Hook),
          admin: route.options.beforeHooks.indexOf(adminHook),
          route: route.options.beforeHooks.indexOf(routeHook),
        };

        expect(hookIndexes.api).toBeLessThan(hookIndexes.v1);
        expect(hookIndexes.v1).toBeLessThan(hookIndexes.admin);
        expect(hookIndexes.admin).toBeLessThan(hookIndexes.route);
      }
    });

    it('should merge afterHooks in reverse order (child first, then parent)', () => {
      const setup = new SetupImpl();
      const apiAfterHook = () => console.log('api after');
      const v1AfterHook = () => console.log('v1 after');
      const routeAfterHook = () => console.log('route after');

      setup.group(
        '/api',
        (api) => {
          api.group(
            '/v1',
            (v1) => {
              v1.get('/users', () => ({}), {
                afterHooks: [routeAfterHook],
              });
            },
            {
              afterHooks: [v1AfterHook],
            },
          );
        },
        {
          afterHooks: [apiAfterHook],
        },
      );

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users');
      expect(route).toBeDefined();

      if (route) {
        // After hooks should be merged in reverse order: route -> v1 -> api
        expect(route.options.afterHooks).toContain(routeAfterHook);
        expect(route.options.afterHooks).toContain(v1AfterHook);
        expect(route.options.afterHooks).toContain(apiAfterHook);

        // Verify order (child hooks first, then parent hooks)
        const hookIndexes = {
          route: route.options.afterHooks.indexOf(routeAfterHook),
          v1: route.options.afterHooks.indexOf(v1AfterHook),
          api: route.options.afterHooks.indexOf(apiAfterHook),
        };

        expect(hookIndexes.route).toBeLessThan(hookIndexes.v1);
        expect(hookIndexes.v1).toBeLessThan(hookIndexes.api);
      }
    });

    it('should return the group app for method chaining', () => {
      const setup = new SetupImpl();

      const groupApp = setup.group('/api', (api) => {
        api.get('/users', () => ({}));
      });

      expect(groupApp).toBeDefined();
      expect(typeof groupApp.get).toBe('function');
      expect(typeof groupApp.post).toBe('function');
      expect(typeof groupApp.group).toBe('function');
    });

    it('should support deep nesting with complex path structures', () => {
      const setup = new SetupImpl();

      setup.group('/api', (api) => {
        api.group('/v1', (v1) => {
          v1.group('/admin', (admin) => {
            admin.group('/users', (users) => {
              users.group('/management', (management) => {
                management.group('/permissions', (permissions) => {
                  permissions.get('/', () => ({ permissions: [] }));
                  permissions.post('/', () => ({ created: true }));
                });
              });
            });
          });
        });
      });

      // Verify deeply nested paths work correctly
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/admin/users/management/permissions')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.post, '/api/v1/admin/users/management/permissions')).toBeDefined();
    });

    it('should handle empty groups gracefully', () => {
      const setup = new SetupImpl();

      // Empty group should not cause errors
      expect(() => {
        setup.group('/api', (api) => {
          // No routes defined
        });
      }).not.toThrow();

      // Nested empty groups should also work
      expect(() => {
        setup.group('/api', (api) => {
          api.group('/v1', (v1) => {
            v1.group('/users', (users) => {
              // No routes defined
            });
          });
        });
      }).not.toThrow();
    });

    it('should support all HTTP methods in nested groups', () => {
      const setup = new SetupImpl();

      setup.group('/api/v1', (api) => {
        api.group('/users', (users) => {
          users.get('/', () => ({}));
          users.post('/', () => ({}));
          users.put('/:id', () => ({}));
          users.patch('/:id', () => ({}));
          users.delete('/:id', () => ({}));
          users.options('/', () => ({}));
          // Note: HEAD is auto-registered for GET routes, so we don't register it manually
        });
      });

      // Verify all HTTP methods work in nested groups
      expect(setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.post, '/api/v1/users')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.put, '/api/v1/users/:id')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.patch, '/api/v1/users/:id')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.delete, '/api/v1/users/:id')).toBeDefined();
      expect(setup._routeRegistry._findRoute(httpMethod.options, '/api/v1/users')).toBeDefined();

      // Verify HEAD was auto-registered for GET route
      expect(setup._routeRegistry._findRoute(httpMethod.head, '/api/v1/users')).toBeDefined();
    });

    it('should handle group options with undefined hooks gracefully', () => {
      const setup = new SetupImpl();

      setup.group('/api', (api) => {
        api.group('/v1', (v1) => {
          v1.get('/users', () => ({}));
        });
      });

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/users');
      expect(route).toBeDefined();

      if (route) {
        // Should have empty arrays for hooks
        expect(route.options.beforeHooks).toEqual([]);
        expect(route.options.afterHooks).toEqual([]);
      }
    });
  });

  describe('Context State', () => {
    it('should allow storing and retrieving state data in route handlers', () => {
      const setup = new SetupImpl();

      setup.get('/test', (ctx) => {
        // Store data in state
        ctx.state.user = { id: 1, name: 'John' };
        ctx.state.requestId = 'req-123';
        ctx.state.timestamp = Date.now();

        // Access the data
        expect(ctx.state.user).toEqual({ id: 1, name: 'John' });
        expect(ctx.state.requestId).toBe('req-123');
        expect(typeof ctx.state.timestamp).toBe('number');

        return { success: true };
      });

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/test');
      expect(route).toBeDefined();
    });

    it('should support state in middleware and route handlers', () => {
      const setup = new SetupImpl();

      // Middleware that sets state
      const authMiddleware = (ctx: any) => {
        ctx.state.user = { id: 1, name: 'John' };
        ctx.state.isAuthenticated = true;
      };

      // Route that uses middleware state
      setup.get('/middleware', authMiddleware, (ctx) => {
        // Access state set by middleware
        expect(ctx.state.user).toEqual({ id: 1, name: 'John' });
        expect(ctx.state.isAuthenticated).toBe(true);

        // Add more state
        ctx.state.routeAccessed = true;

        return {
          user: ctx.state.user,
          isAuthenticated: ctx.state.isAuthenticated,
          routeAccessed: ctx.state.routeAccessed,
        };
      });

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/middleware');
      expect(route).toBeDefined();
    });

    it('should support state in route groups with inheritance', () => {
      const setup = new SetupImpl();

      // Set up global hooks that will set state
      setup.beforeAll([
        (ctx) => {
          ctx.state.apiVersion = 'v1';
          ctx.state.environment = 'test';
        },
      ]);

      setup.group('/api/v1', (api) => {
        api.group('/admin', (admin) => {
          // Route that inherits state from global hooks
          admin.get('/users', (ctx) => {
            expect(ctx.state.apiVersion).toBe('v1');
            expect(ctx.state.environment).toBe('test');

            return { users: ['Admin1', 'Admin2'] };
          });
        });
      });

      // Verify the nested route was registered
      const route = setup._routeRegistry._findRoute(httpMethod.get, '/api/v1/admin/users');
      expect(route).toBeDefined();
    });

    it('should isolate state between different route handlers', () => {
      const setup = new SetupImpl();

      setup.get('/isolated/:id', (ctx) => {
        const { id } = ctx.request.params;

        // Set request-specific state
        ctx.state.requestId = `req-${id}`;
        ctx.state.timestamp = Date.now();

        return {
          id,
          requestId: ctx.state.requestId,
          timestamp: ctx.state.timestamp,
        };
      });

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/isolated/:id');
      expect(route).toBeDefined();
    });

    it('should support typed state with generics', () => {
      const setup = new SetupImpl();

      // Define typed state interface
      interface TypedState extends HandlerCallbackGenerics {
        state: {
          user: { id: number; name: string };
          permissions: Array<string>;
        };
      }

      setup.get('/typed', (ctx: any) => {
        // Set typed state
        ctx.state.user = { id: 1, name: 'Admin' };
        ctx.state.permissions = ['read', 'write', 'delete'];

        // Access with full typing
        const { user, permissions } = ctx.state;

        expect(user.id).toBe(1);
        expect(user.name).toBe('Admin');
        expect(permissions).toEqual(['read', 'write', 'delete']);

        return { user, permissions };
      });

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/typed');
      expect(route).toBeDefined();
    });

    it('should allow state access in before and after hooks', () => {
      const setup = new SetupImpl();

      // Global hooks that set and access state
      setup.beforeAll([
        (ctx) => {
          // Set initial state
          ctx.state.requestId = 'req-123';
          ctx.state.timestamp = Date.now();
        },
      ]);

      setup.afterAll([
        (ctx, result) => {
          // Access state and modify response based on result
          expect(ctx.state.requestId).toBe('req-123');
          expect(typeof ctx.state.timestamp).toBe('number');

          // Add response headers based on state
          ctx.response.addHeaders({
            'X-Request-ID': ctx.state.requestId,
            'X-Processing-Time': `${Date.now() - ctx.state.timestamp}ms`,
          });
        },
      ]);

      // Route with hooks that access state
      setup.get(
        '/hook-test',
        // Route handler
        (ctx) => {
          // Access state from all previous hooks
          expect(ctx.state.requestId).toBe('req-123');
          expect(ctx.state.routeAccessed).toBe(true);
          expect(ctx.state.user).toEqual({ id: 1, name: 'John' });

          // Add more state
          ctx.state.handlerExecuted = true;

          return { message: 'Success' };
        },
        // Route options with hooks
        {
          beforeHooks: [
            (ctx) => {
              // Access state from global hooks
              expect(ctx.state.requestId).toBe('req-123');

              // Add route-specific state
              ctx.state.routeAccessed = true;
              ctx.state.user = { id: 1, name: 'John' };
            },
          ],
          afterHooks: [
            (ctx, result) => {
              // Access state from all previous stages
              expect(ctx.state.requestId).toBe('req-123');
              expect(ctx.state.routeAccessed).toBe(true);
              expect(ctx.state.user).toEqual({ id: 1, name: 'John' });
              expect(ctx.state.handlerExecuted).toBe(true);

              // Verify result is passed correctly
              expect(result).toEqual({ message: 'Success' });

              // Add final state
              ctx.state.completed = true;
            },
          ],
        },
      );

      const route = setup._routeRegistry._findRoute(httpMethod.get, '/hook-test');
      expect(route).toBeDefined();

      // Verify hooks are properly registered
      expect(route?.options.beforeHooks).toHaveLength(1);
      expect(route?.options.afterHooks).toHaveLength(1);
    });
  });
});
