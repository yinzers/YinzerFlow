import { describe, expect, it } from 'bun:test';
import type { HttpRequest } from 'core/HttpRequest.ts';
import { RouteFinder } from 'core/RouteFinder.ts';
import { RouteRegistry } from 'core/RouteRegistry.ts';

describe('RouteFinder.findRouteFromRequest', () => {
  it('should return an exact route without params', () => {
    const request = <HttpRequest>{
      path: '/test/goes/here',
      method: 'GET',
    };

    const routeRegistry = new RouteRegistry();
    routeRegistry.addRoute({
      method: 'GET',
      path: '/test/goes/here',
      handler: () => ({}),
    });
    routeRegistry.addRoute({
      method: 'PUT',
      path: '/test/goes/here',
      handler: () => ({}),
    });
    routeRegistry.addRoute({
      method: 'POST',
      path: '/user',
      handler: () => ({}),
    });

    const routeFinder = new RouteFinder(routeRegistry);
    const result = routeFinder.findRouteFromRequest(request);

    expect(result).toEqual({
      method: 'GET',
      path: '/test/goes/here',
      handler: expect.any(Function),
    });
  });

  it('should return an exact route with params', () => {
    const request = <HttpRequest>{
      path: '/test/123/here/456',
      method: 'POST',
    };

    const routeRegistry = new RouteRegistry();
    routeRegistry.addRoute({
      method: 'GET',
      path: '/test/goes/here',
      handler: () => ({}),
    });
    routeRegistry.addRoute({
      method: 'PUT',
      path: '/test/:id/here',
      handler: () => ({}),
    });
    routeRegistry.addRoute({
      method: 'POST',
      path: '/test/:id/here/:id2',
      handler: () => ({}),
    });

    const routeFinder = new RouteFinder(routeRegistry);
    const result = routeFinder.findRouteFromRequest(request);

    expect(result).toEqual({
      method: 'POST',
      path: '/test/:id/here/:id2',
      handler: expect.any(Function),
    });
  });
});
