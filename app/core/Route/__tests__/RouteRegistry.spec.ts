import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { RouteRegistry } from '../RouteRegistry.ts';
import { HttpMethod } from '../../../constants/http.ts';
import type { IRoute } from '../../../types/Route.ts';
import { createMockHandler } from '../__mocks__/RouteHandler.spec.ts';
import { createPassthroughHook } from '../../__mocks__/Hook.spec.ts';

describe('RouteRegistry', () => {
  let routeRegistry: RouteRegistry;

  beforeEach(() => {
    routeRegistry = new RouteRegistry();
  });

  test('should initialize with empty routes', () => {
    expect(routeRegistry.routeCount).toBe(0);
    expect(routeRegistry.getRoutes().size).toBe(0);
  });

  test('should add a route', () => {
    const handler = createMockHandler('Hello');
    const emitSpy = spyOn(routeRegistry, 'emit');

    const route = routeRegistry.addRoute({
      path: '/users',
      method: HttpMethod.GET,
      handler,
    });

    expect(routeRegistry.routeCount).toBe(1);
    expect(routeRegistry.hasRoute(HttpMethod.GET, '/users')).toBe(true);
    expect(route.handler).toBe(handler);
    expect(emitSpy).toHaveBeenCalled();
  });

  test('should get a route by method and path', () => {
    const handler = createMockHandler('Hello');

    routeRegistry.addRoute({
      path: '/users',
      method: HttpMethod.GET,
      handler,
    });

    const route = routeRegistry.getRoute(HttpMethod.GET, '/users');

    expect(route).not.toBeUndefined();
    expect(route?.path).toBe('/users');
    expect(route?.method).toBe(HttpMethod.GET);
    expect(route?.handler).toBe(handler);
  });

  test('should return undefined for non-existent routes', () => {
    const route = routeRegistry.getRoute(HttpMethod.GET, '/non-existent');
    expect(route).toBeUndefined();
  });

  test('should remove a route', () => {
    routeRegistry.addRoute({
      path: '/users',
      method: HttpMethod.GET,
      handler: () => ({}),
    });

    const emitSpy = spyOn(routeRegistry, 'emit');
    const result = routeRegistry.removeRoute(HttpMethod.GET, '/users');

    expect(result).toBe(true);
    expect(routeRegistry.routeCount).toBe(0);
    expect(routeRegistry.hasRoute(HttpMethod.GET, '/users')).toBe(false);
    expect(emitSpy).toHaveBeenCalled();
  });

  test('should return false when removing non-existent route', () => {
    const result = routeRegistry.removeRoute(HttpMethod.GET, '/non-existent');
    expect(result).toBe(false);
  });

  test('should add a group of routes with a common prefix', () => {
    const handler1 = createMockHandler('Profile');
    const handler2 = createMockHandler('Settings');

    const routes: Array<IRoute> = [
      {
        path: '/profile',
        method: HttpMethod.GET,
        handler: handler1,
      },
      {
        path: '/settings',
        method: HttpMethod.GET,
        handler: handler2,
      },
    ];

    const emitSpy = spyOn(routeRegistry, 'emit');
    routeRegistry.addGroup('/user', routes);

    expect(routeRegistry.routeCount).toBe(2);
    expect(routeRegistry.hasRoute(HttpMethod.GET, '/user/profile')).toBe(true);
    expect(routeRegistry.hasRoute(HttpMethod.GET, '/user/settings')).toBe(true);
    expect(emitSpy).toHaveBeenCalled();
  });

  test('should add a group with a beforeGroup hook', () => {
    const beforeGroup = createPassthroughHook();

    const routes: Array<IRoute> = [
      {
        path: '/profile',
        method: HttpMethod.GET,
        handler: createMockHandler(),
      },
    ];

    routeRegistry.addGroup('/user', routes, { beforeGroup });

    const route = routeRegistry.getRoute(HttpMethod.GET, '/user/profile');
    expect(route?.beforeGroup).toBe(beforeGroup);
  });

  test('should add multiple routes at once', () => {
    const routes: Array<IRoute> = [
      {
        path: '/users',
        method: HttpMethod.GET,
        handler: createMockHandler(),
      },
      {
        path: '/posts',
        method: HttpMethod.GET,
        handler: createMockHandler(),
      },
    ];

    const emitSpy = spyOn(routeRegistry, 'emit');
    routeRegistry.addRoutes(routes);

    expect(routeRegistry.routeCount).toBe(2);
    expect(routeRegistry.hasRoute(HttpMethod.GET, '/users')).toBe(true);
    expect(routeRegistry.hasRoute(HttpMethod.GET, '/posts')).toBe(true);
    expect(emitSpy).toHaveBeenCalled();
  });

  test('should clear all routes', () => {
    routeRegistry.addRoute({
      path: '/users',
      method: HttpMethod.GET,
      handler: createMockHandler(),
    });

    routeRegistry.addRoute({
      path: '/posts',
      method: HttpMethod.GET,
      handler: createMockHandler(),
    });

    const emitSpy = spyOn(routeRegistry, 'emit');
    routeRegistry.clearRoutes();

    expect(routeRegistry.routeCount).toBe(0);
    expect(routeRegistry.getRoutes().size).toBe(0);
    expect(emitSpy).toHaveBeenCalled();
  });

  test('should throw error for invalid path', () => {
    expect(() => {
      routeRegistry.addRoute({
        path: 'invalid-path', // Missing leading slash
        method: HttpMethod.GET,
        handler: createMockHandler(),
      });
    }).toThrow();
  });
});
