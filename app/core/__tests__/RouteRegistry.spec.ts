/**
 * RouteRegistry Tests
 *
 * Tests for the RouteRegistry class which manages route registration and storage.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { RouteRegistry } from 'core/RouteRegistry.ts';
import { HttpMethod } from 'constants/http.ts';
import type { IRoute } from 'types/Route';

describe('RouteRegistry', () => {
  let registry: RouteRegistry;

  // Sample route for testing
  const sampleRoute: IRoute = {
    method: HttpMethod.GET,
    path: '/test',
    handler: () => ({ message: 'test' }),
  };

  const sampleRouteWithParams: IRoute = {
    method: HttpMethod.POST,
    path: '/users/:id',
    handler: () => ({ message: 'user' }),
  };

  // Reset registry before each test
  beforeEach(() => {
    registry = new RouteRegistry();
  });

  it('should initialize with an empty routes map', () => {
    expect(registry.getRoutes().size).toBe(0);
  });

  it('should add a route correctly', () => {
    registry.addRoute(sampleRoute);

    const routes = registry.getRoutes();
    expect(routes.size).toBe(1);
    expect(routes.has(`${sampleRoute.method}:${sampleRoute.path}`)).toBe(true);
    expect(routes.get(`${sampleRoute.method}:${sampleRoute.path}`)).toEqual(sampleRoute);
  });

  it('should add multiple routes correctly', () => {
    registry.addRoute(sampleRoute);
    registry.addRoute(sampleRouteWithParams);

    const routes = registry.getRoutes();
    expect(routes.size).toBe(2);
    expect(routes.has(`${sampleRoute.method}:${sampleRoute.path}`)).toBe(true);
    expect(routes.has(`${sampleRouteWithParams.method}:${sampleRouteWithParams.path}`)).toBe(true);
  });

  it('should check if a route exists correctly', () => {
    registry.addRoute(sampleRoute);

    expect(registry.hasRoute(sampleRoute.method, sampleRoute.path)).toBe(true);
    expect(registry.hasRoute(HttpMethod.POST, sampleRoute.path)).toBe(false);
    expect(registry.hasRoute(sampleRoute.method, '/nonexistent')).toBe(false);
  });

  it('should get a route correctly', () => {
    registry.addRoute(sampleRoute);

    const route = registry.getRoute(sampleRoute.method, sampleRoute.path);
    expect(route).toEqual(sampleRoute);
  });

  it('should return undefined for non-existent routes', () => {
    const route = registry.getRoute(HttpMethod.GET, '/nonexistent');
    expect(route).toBeUndefined();
  });

  it('should handle route overwriting correctly', () => {
    registry.addRoute(sampleRoute);

    const updatedRoute: IRoute = {
      ...sampleRoute,
      handler: () => ({ message: 'updated' }),
    };

    registry.addRoute(updatedRoute);

    const routes = registry.getRoutes();
    expect(routes.size).toBe(1);
    expect(routes.get(`${sampleRoute.method}:${sampleRoute.path}`)).toEqual(updatedRoute);
  });

  it('should handle routes with different methods but same path', () => {
    registry.addRoute(sampleRoute);

    const postRoute: IRoute = {
      ...sampleRoute,
      method: HttpMethod.POST,
    };

    registry.addRoute(postRoute);

    const routes = registry.getRoutes();
    expect(routes.size).toBe(2);
    expect(routes.has(`${HttpMethod.GET}:${sampleRoute.path}`)).toBe(true);
    expect(routes.has(`${HttpMethod.POST}:${sampleRoute.path}`)).toBe(true);
  });

  it('should handle special characters in route paths', () => {
    const specialRoute: IRoute = {
      method: HttpMethod.GET,
      path: '/test/with-special_chars/123',
      handler: () => ({ message: 'special' }),
    };

    registry.addRoute(specialRoute);

    expect(registry.hasRoute(specialRoute.method, specialRoute.path)).toBe(true);
    expect(registry.getRoute(specialRoute.method, specialRoute.path)).toEqual(specialRoute);
  });

  it('should handle route parameters correctly', () => {
    registry.addRoute(sampleRouteWithParams);

    expect(registry.hasRoute(sampleRouteWithParams.method, sampleRouteWithParams.path)).toBe(true);
    expect(registry.getRoute(sampleRouteWithParams.method, sampleRouteWithParams.path)).toEqual(sampleRouteWithParams);
  });
});
