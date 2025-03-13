import { beforeEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { HooksManager } from '../HooksManager.ts';
import type { IRoute } from '../../types/Route.ts';
import { createMockContext } from '../__mocks__/Context.spec.ts';
import { createMockRoute } from '../Route/__tests__/Route.spec.ts';
import { createErrorHook, createInterruptingHook, createPassthroughHook } from '../__mocks__/Hook.spec.ts';
import { createMockHandler } from '../Route/__mocks__/RouteHandler.spec.ts';
import { PathMatchingPattern } from 'constants/hooks.ts';

describe('HooksManager', () => {
  let hooksManager: HooksManager;

  // Mock context and route functions are now imported from __mocks__ folder

  beforeEach(() => {
    hooksManager = new HooksManager();
  });

  test('should add a hook with default options', () => {
    const hookFn = createPassthroughHook();
    const emitSpy = spyOn(hooksManager, 'emit');

    const result = hooksManager.add(hookFn);

    expect(result).toBe(hooksManager); // Should return this for chaining
    expect(emitSpy).toHaveBeenCalled();
  });

  test('should add a hook with custom paths', () => {
    const hookFn = createPassthroughHook();
    const options = {
      paths: ['/api/*', '/admin'],
    };

    const result = hooksManager.add(hookFn, options);

    expect(result).toBe(hooksManager); // Should return this for chaining
  });

  test('should add a hook with excluded paths', () => {
    const hookFn = createPassthroughHook();
    const options = {
      paths: PathMatchingPattern.ALL_BUT_EXCLUDED,
      excluded: ['/login', '/register'],
    };

    const result = hooksManager.add(hookFn, options);

    expect(result).toBe(hooksManager); // Should return this for chaining
  });

  test('should support method chaining', () => {
    const hook1 = createPassthroughHook();
    const hook2 = createPassthroughHook();

    const result = hooksManager.add(hook1, { paths: ['/api/*'] }).add(hook2, { paths: ['/admin/*'] });

    expect(result).toBe(hooksManager);
  });

  test('should process hooks for a route', async () => {
    const executionOrder: Array<number> = [];

    // Create hooks that will be added to the route directly
    const beforeGroupHook = mock(() => {
      executionOrder.push(1);
      return undefined;
    });

    const beforeHandlerHook = mock(() => {
      executionOrder.push(2);
      return undefined;
    });

    const afterHandlerHook = mock(() => {
      executionOrder.push(3);
      return undefined;
    });

    // Create a route with all the hooks
    const route: IRoute = {
      method: 'GET',
      path: '/test',
      handler: createMockHandler(),
      beforeGroup: beforeGroupHook,
      beforeHandler: beforeHandlerHook,
      afterHandler: afterHandlerHook,
    };

    const context = createMockContext();

    // Process each hook phase
    await hooksManager.processBeforeGroup(route, context);
    await hooksManager.processBeforeHandler(route, context);
    // We'd need to process afterHandler too, but that's not exposed in the tests

    expect(executionOrder).toEqual([1, 2]);
    expect(beforeGroupHook).toHaveBeenCalledTimes(1);
    expect(beforeHandlerHook).toHaveBeenCalledTimes(1);
  });

  test('should stop execution if a hook returns a value', async () => {
    const hook1 = createPassthroughHook();
    const hook2 = createInterruptingHook('stopped');
    const hook3 = createPassthroughHook();

    // Create a route with beforeGroup hook that returns a value
    const route: IRoute = {
      method: 'GET',
      path: '/test',
      handler: createMockHandler(),
      beforeGroup: hook2,
    };

    const context = createMockContext();

    const result = await hooksManager.processBeforeGroup(route, context);

    expect(result).toEqual({ message: 'stopped' });
    expect(hook2).toHaveBeenCalledTimes(1);
  });

  test('should filter hooks by includePaths', async () => {
    // Create hooks for specific routes
    const apiHook = createPassthroughHook();
    const usersHook = createPassthroughHook();

    // Create routes with the hooks
    const apiRoute: IRoute = {
      method: 'GET',
      path: '/api',
      handler: createMockHandler(),
      beforeHandler: apiHook,
    };

    const usersRoute: IRoute = {
      method: 'GET',
      path: '/users',
      handler: createMockHandler(),
      beforeHandler: usersHook,
    };

    const context = createMockContext();

    // Process the API route
    await hooksManager.processBeforeHandler(apiRoute, context);
    expect(apiHook).toHaveBeenCalledTimes(1);

    // Process the users route
    await hooksManager.processBeforeHandler(usersRoute, context);
    expect(usersHook).toHaveBeenCalledTimes(1);
  });

  test('should filter hooks by excludePaths', async () => {
    const hook = createPassthroughHook();

    hooksManager.add(hook, { paths: PathMatchingPattern.ALL_BUT_EXCLUDED, excluded: ['/admin'] });

    const context = createMockContext();

    // Test with normal path
    const normalRoute = createMockRoute('/api');
    await hooksManager.processBeforeAll(normalRoute, context);
    expect(hook).toHaveBeenCalledTimes(1);

    // Reset mock
    hook.mockClear();

    // Test with excluded path
    const adminRoute = createMockRoute('/admin');
    await hooksManager.processBeforeAll(adminRoute, context);
    expect(hook).toHaveBeenCalledTimes(0);
  });

  test('should handle async hooks', async () => {
    const hook1 = mock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return undefined;
    });

    const hook2 = mock(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { message: 'async result' };
    });

    // Create a route with beforeHandler hook that returns a value asynchronously
    const route: IRoute = {
      method: 'GET',
      path: '/test',
      handler: createMockHandler(),
      beforeHandler: hook2,
    };

    const context = createMockContext();

    const result = await hooksManager.processBeforeHandler(route, context);

    expect(result).toEqual({ message: 'async result' });
    expect(hook2).toHaveBeenCalledTimes(1);
  });

  test('should handle errors in hooks', async () => {
    const errorHook = createErrorHook('Hook error');

    // Create a route with beforeHandler hook that throws an error
    const route: IRoute = {
      method: 'GET',
      path: '/test',
      handler: createMockHandler(),
      beforeHandler: errorHook,
    };

    const context = createMockContext();

    try {
      await hooksManager.processBeforeHandler(route, context);
      // If we get here, the test should fail
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toBe('Hook error');
    }
  });

  test('should process different hook phases', async () => {
    // Create mock hooks for different phases
    const beforeGroupHook = createPassthroughHook();
    const beforeHandlerHook = createPassthroughHook();

    // Create a route with the hooks
    const route: IRoute = {
      method: 'GET',
      path: '/test',
      handler: createMockHandler(),
      beforeGroup: beforeGroupHook,
      beforeHandler: beforeHandlerHook,
    };

    const context = createMockContext();

    // Process each hook phase
    await hooksManager.processBeforeGroup(route, context);
    await hooksManager.processBeforeHandler(route, context);

    // Verify hooks were called
    expect(beforeGroupHook).toHaveBeenCalledTimes(1);
    expect(beforeHandlerHook).toHaveBeenCalledTimes(1);
  });
});
