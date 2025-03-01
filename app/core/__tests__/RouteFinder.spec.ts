/**
 * RouteFinder Tests
 *
 * Tests for the RouteFinder class which finds the appropriate route for a given request.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { RouteFinder } from 'core/RouteFinder.ts';
import { RouteRegistry } from 'core/RouteRegistry.ts';
import { HttpMethod } from 'constants/http.ts';
import type { IRoute } from 'types/Route';
import type { HttpRequest } from 'core/HttpRequest';

describe('RouteFinder', () => {
  let registry: RouteRegistry;
  let finder: RouteFinder;

  // Sample routes for testing
  const routes: Array<IRoute> = [
    {
      method: HttpMethod.GET,
      path: '/users',
      handler: () => ({ users: [] }),
    },
    {
      method: HttpMethod.GET,
      path: '/users/:id',
      handler: () => ({ user: { id: '1' } }),
    },
    {
      method: HttpMethod.POST,
      path: '/users',
      handler: () => ({ success: true }),
    },
    {
      method: HttpMethod.GET,
      path: '/products/:category/:id',
      handler: () => ({ product: { id: '1', category: 'electronics' } }),
    },
    {
      method: HttpMethod.GET,
      path: '/search',
      handler: () => ({ results: [] }),
    },
  ];

  // Reset registry and finder before each test
  beforeEach(() => {
    registry = new RouteRegistry();

    // Add all sample routes to the registry
    routes.forEach((route) => registry.addRoute(route));

    finder = new RouteFinder(registry);
  });

  it('should find an exact route match', () => {
    const request = {
      method: HttpMethod.GET,
      path: '/users',
    } as HttpRequest;

    const route = finder.findRouteFromRequest(request);
    expect(route).toBeDefined();
    expect(route?.path).toBe('/users');
    expect(route?.method).toBe(HttpMethod.GET);
  });

  it('should find a route with parameters', () => {
    const request = {
      method: HttpMethod.GET,
      path: '/users/123',
    } as HttpRequest;

    const route = finder.findRouteFromRequest(request);
    expect(route).toBeDefined();
    expect(route?.path).toBe('/users/:id');
    expect(route?.method).toBe(HttpMethod.GET);
  });

  it('should find a route with multiple parameters', () => {
    const request = {
      method: HttpMethod.GET,
      path: '/products/electronics/456',
    } as HttpRequest;

    const route = finder.findRouteFromRequest(request);
    expect(route).toBeDefined();
    expect(route?.path).toBe('/products/:category/:id');
    expect(route?.method).toBe(HttpMethod.GET);
  });

  it('should respect HTTP method when finding routes', () => {
    const request = {
      method: HttpMethod.POST,
      path: '/users',
    } as HttpRequest;

    const route = finder.findRouteFromRequest(request);
    expect(route).toBeDefined();
    expect(route?.path).toBe('/users');
    expect(route?.method).toBe(HttpMethod.POST);
  });

  it('should return undefined for non-existent routes', () => {
    const request = {
      method: HttpMethod.GET,
      path: '/nonexistent',
    } as HttpRequest;

    const route = finder.findRouteFromRequest(request);
    expect(route).toBeUndefined();
  });

  it('should return undefined for existing path but wrong method', () => {
    const request = {
      method: HttpMethod.DELETE,
      path: '/users',
    } as HttpRequest;

    const route = finder.findRouteFromRequest(request);
    expect(route).toBeUndefined();
  });

  it('should extract parameters from a path correctly', () => {
    const params = finder.extractParamsFromPath('/users/123', '/users/:id');
    expect(params).toEqual({ id: '123' });
  });

  it('should extract multiple parameters from a path correctly', () => {
    const params = finder.extractParamsFromPath('/products/electronics/456', '/products/:category/:id');
    expect(params).toEqual({ category: 'electronics', id: '456' });
  });

  it('should handle paths with query strings when extracting parameters', () => {
    const params = finder.extractParamsFromPath('/users/123?name=john', '/users/:id');
    expect(params).toEqual({ id: '123' });
  });

  it('should handle special characters in parameter values', () => {
    const params = finder.extractParamsFromPath('/users/john-doe_123', '/users/:id');
    expect(params).toEqual({ id: 'john-doe_123' });
  });

  it('should return empty object when no parameters exist', () => {
    const params = finder.extractParamsFromPath('/users', '/users');
    expect(params).toEqual({});
  });

  it('should handle trailing slashes in paths', () => {
    const request = {
      method: HttpMethod.GET,
      path: '/users/',
    } as HttpRequest;

    const route = finder.findRouteFromRequest(request);
    expect(route).toBeDefined();
    expect(route?.path).toBe('/users');
  });
});
