/**
 * executeBeforeHandlerFunctions Tests
 *
 * Tests for the executeBeforeHandlerFunctions utility which executes beforeHandler middleware functions.
 */

import { describe, expect, it, mock } from 'bun:test';
import executeBeforeHandlerFunctions from 'utils/executeBeforeHandlerFunctions.utils.ts';
import type { Context } from 'types/Common';
import type { TMiddleware } from 'types/Middleware';

describe('executeBeforeHandlerFunctions', () => {
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

  it('should execute all beforeHandler functions and return undefined if all pass', async () => {
    const context = createMockContext();

    // Create mock beforeHandler functions
    const beforeHandler1: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeHandler1 = true;
      return next();
    });

    const beforeHandler2: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeHandler2 = true;
      return next();
    });

    // Execute the beforeHandler functions
    const result = await executeBeforeHandlerFunctions(context, [beforeHandler1, beforeHandler2]);

    // Verify all functions were executed
    expect(beforeHandler1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(beforeHandler2).toHaveBeenCalledWith(context, expect.any(Function));

    // Verify the context was modified
    expect(context.request.beforeHandler1).toBe(true);
    expect(context.request.beforeHandler2).toBe(true);

    // Verify the result is undefined (all functions passed)
    expect(result).toBeUndefined();
  });

  it('should stop execution and return the response if a beforeHandler function returns a value', async () => {
    const context = createMockContext();

    // Create mock beforeHandler functions
    const beforeHandler1: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeHandler1 = true;
      return next();
    });

    const beforeHandler2: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeHandler2 = true;
      // Return a response instead of calling next()
      return { success: false, message: 'stopped by beforeHandler2' };
    });

    const beforeHandler3: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeHandler3 = true;
      return next();
    });

    // Execute the beforeHandler functions
    const result = await executeBeforeHandlerFunctions(context, [beforeHandler1, beforeHandler2, beforeHandler3]);

    // Verify only the first two functions were executed
    expect(beforeHandler1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(beforeHandler2).toHaveBeenCalledWith(context, expect.any(Function));
    expect(beforeHandler3).not.toHaveBeenCalled();

    // Verify the context was modified by the executed functions
    expect(context.request.beforeHandler1).toBe(true);
    expect(context.request.beforeHandler2).toBe(true);
    expect(context.request.beforeHandler3).toBeUndefined();

    // Verify the result is the response from beforeHandler2
    expect(result).toEqual({ success: false, message: 'stopped by beforeHandler2' });
  });

  it('should handle async beforeHandler functions correctly', async () => {
    const context = createMockContext();

    // Create mock beforeHandler functions
    const beforeHandler1: TMiddleware = mock(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.request.beforeHandler1 = true;
      return next();
    });

    const beforeHandler2: TMiddleware = mock(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.request.beforeHandler2 = true;
      return next();
    });

    // Execute the beforeHandler functions
    const result = await executeBeforeHandlerFunctions(context, [beforeHandler1, beforeHandler2]);

    // Verify all functions were executed
    expect(beforeHandler1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(beforeHandler2).toHaveBeenCalledWith(context, expect.any(Function));

    // Verify the context was modified
    expect(context.request.beforeHandler1).toBe(true);
    expect(context.request.beforeHandler2).toBe(true);

    // Verify the result is undefined (all functions passed)
    expect(result).toBeUndefined();
  });

  it('should handle errors in beforeHandler functions correctly', async () => {
    const context = createMockContext();

    // Create a beforeHandler function that throws an error
    const errorBeforeHandler: TMiddleware = mock((ctx, next) => {
      throw new Error('beforeHandler error');
    });

    // Execute the beforeHandler functions and expect it to throw
    await expect(executeBeforeHandlerFunctions(context, [errorBeforeHandler])).rejects.toThrow('beforeHandler error');

    // Verify the function was executed
    expect(errorBeforeHandler).toHaveBeenCalledWith(context, expect.any(Function));
  });

  it('should handle empty beforeHandler functions array', async () => {
    const context = createMockContext();

    // Execute with an empty array
    const result = await executeBeforeHandlerFunctions(context, []);

    // Verify the result is undefined
    expect(result).toBeUndefined();
  });
});
