import { beforeEach, describe, expect, test } from 'bun:test';

import { RouteFinder } from '../RouteFinder.ts';
import { RouteRegistry } from '../RouteRegistry.ts';
import { HttpMethod } from '../../../constants/http.ts';
import { createMockHandler } from '../__mocks__/RouteHandler.spec.ts';
import { createMockRequest } from 'core/Request/__mocks__/Request.spec.ts';

describe('RouteFinder', () => {
  let routeRegistry: RouteRegistry;
  let routeFinder: RouteFinder;

  beforeEach(() => {
    routeRegistry = new RouteRegistry();
    routeFinder = new RouteFinder(routeRegistry);
  });

  test('should find exact route match', () => {
    // Add a simple route
    const handler = createMockHandler('Hello');
    routeRegistry.addRoute({
      path: '/users',
      method: HttpMethod.GET,
      handler,
    });

    const route = routeFinder.findRoute(HttpMethod.GET, '/users');

    expect(route).not.toBeUndefined();
    expect(route?.path).toBe('/users');
    expect(route?.method).toBe(HttpMethod.GET);
    expect(route?.handler).toBe(handler);
  });

  test('should extract parameters from path', () => {
    const params = routeFinder.extractParamsFromPath('/users/123/posts/456', '/users/:userId/posts/:postId');

    expect(params).toEqual({
      userId: '123',
      postId: '456',
    });
  });

  test('should return undefined for non-existent routes', () => {
    const route = routeFinder.findRoute(HttpMethod.GET, '/non-existent');
    expect(route).toBeUndefined();
  });

  test('should return undefined for method mismatch', () => {
    routeRegistry.addRoute({
      path: '/users',
      method: HttpMethod.GET,
      handler: () => ({}),
    });

    const route = routeFinder.findRoute(HttpMethod.POST, '/users');
    expect(route).toBeUndefined();
  });

  test('should find route from request object', () => {
    routeRegistry.addRoute({
      path: '/api/users',
      method: HttpMethod.GET,
      handler: () => ({}),
    });

    const mockRequest = createMockRequest(HttpMethod.GET, '/api/users');

    const route = routeFinder.findRouteFromRequest(mockRequest);

    expect(route).not.toBeUndefined();
    expect(route?.path).toBe('/api/users');
  });

  test('should prioritize exact matches over patterns', () => {
    // Add a specific route
    routeRegistry.addRoute({
      path: '/users/profile',
      method: HttpMethod.GET,
      handler: () => ({ specific: true }),
    });

    // The specific route should be matched
    const route = routeFinder.findRoute(HttpMethod.GET, '/users/profile');

    expect(route).not.toBeUndefined();
    expect(route?.path).toBe('/users/profile');
    expect(route?.handler({} as any)).toEqual({ specific: true });
  });
});
