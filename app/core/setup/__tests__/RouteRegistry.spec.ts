import { describe, expect, it } from 'bun:test';
import { httpMethod } from '@constants/http.ts';
import { RouteRegistryImpl } from '@core/setup/RouteRegistryImpl.ts';
import type { InternalHttpMethod } from '@typedefs/constants/http.js';

// Reusable test data builders
const createTestHandler = (name: string) => () => name;

const createRouteOptions = (beforeHooks: Array<() => void> = [], afterHooks: Array<() => void> = []) => ({
  beforeHooks,
  afterHooks,
});

const createRouteRegistration = (method: InternalHttpMethod, path: string, handlerName = 'default') => ({
  method,
  path,
  handler: createTestHandler(handlerName),
  options: createRouteOptions(),
  params: {},
});

describe('RouteRegistryImpl', () => {
  describe('Exact Routes (no parameters)', () => {
    it('should register and find exact routes', () => {
      const routeRegistry = new RouteRegistryImpl();
      const handler = createTestHandler('exact');

      routeRegistry._register({
        method: httpMethod.get,
        path: '/',
        handler,
        options: createRouteOptions(),
        params: {},
      });

      const match = routeRegistry._findRoute(httpMethod.get, '/');
      expect(match).toBeDefined();
      expect(match?.handler).toBe(handler);
      expect(match?.params).toEqual({});
    });

    it('should throw an error if an exact route already exists', () => {
      const routeRegistry = new RouteRegistryImpl();
      const routeConfig = createRouteRegistration(httpMethod.get, '/');

      routeRegistry._register(routeConfig);

      expect(() => routeRegistry._register(routeConfig)).toThrow('Route / already exists for method GET');
    });
  });

  describe('Parameterized Routes', () => {
    describe('Single Parameter Routes', () => {
      it('should register and find routes with single parameter', () => {
        const routeRegistry = new RouteRegistryImpl();
        const handler = createTestHandler('single-param');

        routeRegistry._register({
          method: httpMethod.get,
          path: '/users/:id',
          handler,
          options: createRouteOptions(),
          params: {},
        });

        const match = routeRegistry._findRoute(httpMethod.get, '/users/123');
        expect(match).toBeDefined();
        expect(match?.handler).toBe(handler);
        expect(match?.params).toEqual({ id: '123' });
      });
    });

    describe('Multiple Parameter Routes', () => {
      const multiParamTestCases = [
        {
          description: 'should extract multiple parameters correctly',
          routePath: '/users/:userId/posts/:postId',
          requestPath: '/users/123/posts/456',
          expectedParams: { userId: '123', postId: '456' },
        },
        {
          description: 'should handle complex parameter patterns (non-numeric)',
          routePath: '/api/v1/users/:id/posts/:postId/comments/:commentId',
          requestPath: '/api/v1/users/user123/posts/post456/comments/comment789',
          expectedParams: {
            id: 'user123',
            postId: 'post456',
            commentId: 'comment789',
          },
        },
      ];

      it.each(multiParamTestCases)('$description', ({ routePath, requestPath, expectedParams }) => {
        const routeRegistry = new RouteRegistryImpl();

        routeRegistry._register({
          method: httpMethod.get,
          path: routePath,
          handler: createTestHandler('multi-param'),
          options: createRouteOptions(),
          params: {},
        });

        const match = routeRegistry._findRoute(httpMethod.get, requestPath);
        expect(match).toBeDefined();
        expect(match?.params).toEqual(expectedParams);
      });
    });

    describe('Route Matching Validation', () => {
      it('should not match if path structure is different', () => {
        const routeRegistry = new RouteRegistryImpl();

        routeRegistry._register({
          method: httpMethod.get,
          path: '/users/:id/posts/:postId',
          handler: createTestHandler('validation'),
          options: createRouteOptions(),
          params: {},
        });

        const invalidPaths = [
          '/users/123', // Too few segments
          '/users/123/posts/456/extra', // Too many segments
          '/posts/123/users/456', // Different structure
        ];

        invalidPaths.forEach((invalidPath) => {
          expect(routeRegistry._findRoute(httpMethod.get, invalidPath)).toBeUndefined();
        });
      });
    });

    describe('Route Conflict Detection', () => {
      const conflictTestCases = [
        {
          description: 'should throw error if parameterized route pattern already exists',
          firstRoute: '/users/:id',
          secondRoute: '/users/:userId',
          expectedError: 'Route /users/:userId already exists for method GET',
        },
        {
          description: 'should prevent conflicting parameterized route structures',
          firstRoute: '/api/:version/users',
          secondRoute: '/api/:apiKey/users',
          expectedError: 'Route /api/:apiKey/users already exists for method GET',
        },
      ];

      it.each(conflictTestCases)('$description', ({ firstRoute, secondRoute, expectedError }) => {
        const routeRegistry = new RouteRegistryImpl();

        routeRegistry._register(createRouteRegistration(httpMethod.get, firstRoute, 'first'));

        expect(() => routeRegistry._register(createRouteRegistration(httpMethod.get, secondRoute, 'second'))).toThrow(expectedError);
      });
    });

    describe('Parameter Validation Integration', () => {
      it('should integrate with parameter validation (validateParameterNames)', () => {
        const routeRegistry = new RouteRegistryImpl();

        // Integration test: RouteRegistry should call validateParameterNames during registration
        expect(() =>
          routeRegistry._register({
            method: httpMethod.get,
            path: '/users/:id/posts/:id', // Duplicate parameter names
            handler: createTestHandler('validation'),
            options: createRouteOptions(),
            params: {},
          }),
        ).toThrow('duplicate parameter names');
      });
    });
  });

  describe('Route Priority and Matching', () => {
    it('should prioritize exact routes over parameterized routes', () => {
      const routeRegistry = new RouteRegistryImpl();
      const exactHandler = createTestHandler('exact');
      const paramHandler = createTestHandler('param');

      // Register parameterized route first
      routeRegistry._register({
        method: httpMethod.get,
        path: '/users/:id',
        handler: paramHandler,
        options: createRouteOptions(),
        params: {},
      });

      // Register exact route second
      routeRegistry._register({
        method: httpMethod.get,
        path: '/users/profile',
        handler: exactHandler,
        options: createRouteOptions(),
        params: {},
      });

      // Exact route should win
      const exactMatch = routeRegistry._findRoute(httpMethod.get, '/users/profile');
      expect(exactMatch?.handler).toBe(exactHandler);
      expect(exactMatch?.params).toEqual({});

      // Parameterized route should still work for other paths
      const paramMatch = routeRegistry._findRoute(httpMethod.get, '/users/123');
      expect(paramMatch?.handler).toBe(paramHandler);
      expect(paramMatch?.params).toEqual({ id: '123' });
    });
  });

  describe('HTTP Method Separation', () => {
    it('should separate routes by HTTP method', () => {
      const routeRegistry = new RouteRegistryImpl();
      const getHandler = createTestHandler('get');
      const postHandler = createTestHandler('post');

      routeRegistry._register({
        method: httpMethod.get,
        path: '/users/:id',
        handler: getHandler,
        options: createRouteOptions(),
        params: {},
      });
      routeRegistry._register({
        method: httpMethod.post,
        path: '/users/:id',
        handler: postHandler,
        options: createRouteOptions(),
        params: {},
      });

      const getMatch = routeRegistry._findRoute(httpMethod.get, '/users/123');
      const postMatch = routeRegistry._findRoute(httpMethod.post, '/users/123');

      expect(getMatch?.handler).toBe(getHandler);
      expect(postMatch?.handler).toBe(postHandler);
      expect(getMatch?.params).toEqual({ id: '123' });
      expect(postMatch?.params).toEqual({ id: '123' });
    });
  });

  describe('Edge Cases', () => {
    const edgeCaseTests = [
      {
        description: 'should not match empty parameter values',
        routePath: '/users/:id/posts',
        requestPath: '/users//posts',
        shouldMatch: false,
      },
      {
        description: 'should integrate with path normalization',
        routePath: '//users//:id/',
        requestPath: '/users/123',
        shouldMatch: true,
        expectedParams: { id: '123' },
      },
    ];

    it.each(edgeCaseTests)('$description', ({ routePath, requestPath, shouldMatch, expectedParams }) => {
      const routeRegistry = new RouteRegistryImpl();

      routeRegistry._register({
        method: httpMethod.get,
        path: routePath,
        handler: createTestHandler('edge-case'),
        options: createRouteOptions(),
        params: {},
      });

      const match = routeRegistry._findRoute(httpMethod.get, requestPath);

      if (shouldMatch) {
        expect(match).toBeDefined();
        if (expectedParams) {
          expect(match?.params).toEqual(expectedParams);
        }
      } else {
        expect(match).toBeUndefined();
      }
    });
  });
});
