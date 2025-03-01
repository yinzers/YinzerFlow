/**
 * executeMiddlewareFunctions Tests
 *
 * Tests for the executeMiddlewareFunctions utility which executes middleware functions.
 */

import { describe, expect, it, mock } from 'bun:test';
import type { TMiddleware } from 'lib/index.js';
import type { Context } from 'types/Common.ts';
import executeMiddlewareFunctions from 'utils/executeMiddlewareFunctions.utils.ts';

describe('executeMiddlewareFunctions', () => {
  // Create a mock context for testing
  const createMockContext = (): Context => ({
    request: {
      method: 'GET',
      path: '/test',
      headers: {},
      body: {},
      query: {},
      params: {},
    },
    response: {
      setStatus: mock((_status: number) => {}),
      getStatus: mock(() => 200),
      setBody: mock((_body: any) => {}),
      getBody: mock(() => ({})),
      setContentType: mock((_contentType: string) => {}),
      getContentType: mock(() => 'application/json'),
      addHeaders: mock((_headers: Array<Record<string, string>>) => {}),
      getHeaders: mock(() => ({})),
      removeHeaders: mock((_headers: Array<string>) => {}),
      setCookie: mock((_name: string, _value: string, _options?: any) => {}),
      getCookies: mock(() => ({})),
      removeCookie: mock((_name: string) => {}),
      formatHttpResponse: mock(() => ''),
    },
  });

  it('should execute all middleware functions and return undefined if all pass', async () => {
    const context = createMockContext();

    // Create mock middleware functions
    const middleware1: TMiddleware = mock((ctx, next) => {
      ctx.request.middleware1 = true;
      return next();
    });

    const middleware2: TMiddleware = mock((ctx, next) => {
      ctx.request.middleware2 = true;
      return next();
    });

    // Execute the middleware functions
    const result = await executeMiddlewareFunctions(context, [middleware1, middleware2]);

    // Verify all functions were executed
    expect(middleware1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(middleware2).toHaveBeenCalledWith(context, expect.any(Function));

    // Verify the context was modified
    expect(context.request.middleware1).toBe(true);
    expect(context.request.middleware2).toBe(true);

    // Verify the result is undefined (all functions passed)
    expect(result).toBeUndefined();
  });

  it('should stop execution and return the response if a middleware function returns a value', async () => {
    const context = createMockContext();

    // Create mock middleware functions
    const middleware1: TMiddleware = mock((ctx, next) => {
      ctx.request.middleware1 = true;
      return next();
    });

    const middleware2: TMiddleware = mock((ctx, next) => {
      ctx.request.middleware2 = true;
      // Return a response instead of calling next()
      return { success: false, message: 'stopped by middleware2' };
    });

    const middleware3: TMiddleware = mock((ctx, next) => {
      ctx.request.middleware3 = true;
      return next();
    });

    // Execute the middleware functions
    const result = await executeMiddlewareFunctions(context, [middleware1, middleware2, middleware3]);

    // Verify only the first two functions were executed
    expect(middleware1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(middleware2).toHaveBeenCalledWith(context, expect.any(Function));
    expect(middleware3).not.toHaveBeenCalled();

    // Verify the context was modified by the executed functions
    expect(context.request.middleware1).toBe(true);
    expect(context.request.middleware2).toBe(true);
    expect(context.request.middleware3).toBeUndefined();

    // Verify the result is the response from middleware2
    expect(result).toEqual({ success: false, message: 'stopped by middleware2' });
  });

  it('should handle async middleware functions correctly', async () => {
    const context = createMockContext();

    // Create mock middleware functions
    const middleware1: TMiddleware = mock(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.request.middleware1 = true;
      return next();
    });

    const middleware2: TMiddleware = mock(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.request.middleware2 = true;
      return next();
    });

    // Execute the middleware functions
    const result = await executeMiddlewareFunctions(context, [middleware1, middleware2]);

    // Verify all functions were executed
    expect(middleware1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(middleware2).toHaveBeenCalledWith(context, expect.any(Function));

    // Verify the context was modified
    expect(context.request.middleware1).toBe(true);
    expect(context.request.middleware2).toBe(true);

    // Verify the result is undefined (all functions passed)
    expect(result).toBeUndefined();
  });

  it('should handle errors in middleware functions correctly', async () => {
    const context = createMockContext();

    // Create a middleware function that throws an error
    const errorMiddleware: TMiddleware = mock((ctx, next) => {
      throw new Error('middleware error');
    });

    // Execute the middleware functions and expect it to throw
    await expect(executeMiddlewareFunctions(context, [errorMiddleware])).rejects.toThrow('middleware error');

    // Verify the function was executed
    expect(errorMiddleware).toHaveBeenCalledWith(context, expect.any(Function));
  });

  it('should handle empty middleware functions array', async () => {
    const context = createMockContext();

    // Execute with an empty array
    const result = await executeMiddlewareFunctions(context, []);

    // Verify the result is undefined
    expect(result).toBeUndefined();
  });

  it('should execute middleware in the correct order', async () => {
    const context = createMockContext();
    const executionOrder: Array<number> = [];

    // Create mock middleware functions that track execution order
    const middleware1: TMiddleware = mock((ctx, next) => {
      executionOrder.push(1);
      ctx.request.middleware1 = true;
      return next();
    });

    const middleware2: TMiddleware = mock((ctx, next) => {
      executionOrder.push(2);
      ctx.request.middleware2 = true;
      return next();
    });

    const middleware3: TMiddleware = mock((ctx, next) => {
      executionOrder.push(3);
      ctx.request.middleware3 = true;
      return next();
    });

    // Execute the middleware functions
    await executeMiddlewareFunctions(context, [middleware1, middleware2, middleware3]);

    // Verify the execution order
    expect(executionOrder).toEqual([1, 2, 3]);
  });

  it('should handle middleware that modifies the context', async () => {
    const context = createMockContext();

    // Create middleware that modifies the context
    const middleware: TMiddleware = mock((ctx, next) => {
      ctx.request.modified = true;
      ctx.response.setStatus(201);
      return next();
    });

    // Execute the middleware
    await executeMiddlewareFunctions(context, [middleware]);

    // Verify the context was modified
    expect(context.request.modified).toBe(true);
    expect(context.response.setStatus).toHaveBeenCalledWith(201);
  });
});
