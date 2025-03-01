/**
 * executeBeforeGroupFunctions Tests
 *
 * Tests for the executeBeforeGroupFunctions utility which executes beforeGroup middleware functions.
 */

import { describe, expect, it, mock } from 'bun:test';
import type { TMiddleware } from 'lib/index.js';
import type { Context } from 'types/Common.ts';
import executeBeforeGroupFunctions from 'utils/executeBeforeGroupFunctions.utils.ts';

describe('executeBeforeGroupFunctions', () => {
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
      setStatus: mock((status: number) => {}),
      getStatus: mock(() => 200),
      setBody: mock((body: any) => {}),
      getBody: mock(() => ({})),
      setContentType: mock((contentType: string) => {}),
      getContentType: mock(() => 'application/json'),
      addHeaders: mock((headers: Array<Record<string, string>>) => {}),
      getHeaders: mock(() => ({})),
      removeHeaders: mock((headers: Array<string>) => {}),
      setCookie: mock((name: string, value: string, options?: any) => {}),
      getCookies: mock(() => ({})),
      removeCookie: mock((name: string) => {}),
      formatHttpResponse: mock(() => ''),
    },
  });

  it('should execute all beforeGroup functions and return undefined if all pass', async () => {
    const context = createMockContext();

    // Create mock beforeGroup functions
    const beforeGroup1: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeGroup1 = true;
      return next();
    });

    const beforeGroup2: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeGroup2 = true;
      return next();
    });

    // Execute the beforeGroup functions
    const result = await executeBeforeGroupFunctions(context, [beforeGroup1, beforeGroup2]);

    // Verify all functions were executed
    expect(beforeGroup1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(beforeGroup2).toHaveBeenCalledWith(context, expect.any(Function));

    // Verify the context was modified
    expect(context.request.beforeGroup1).toBe(true);
    expect(context.request.beforeGroup2).toBe(true);

    // Verify the result is undefined (all functions passed)
    expect(result).toBeUndefined();
  });

  it('should stop execution and return the response if a beforeGroup function returns a value', async () => {
    const context = createMockContext();

    // Create mock beforeGroup functions
    const beforeGroup1: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeGroup1 = true;
      return next();
    });

    const beforeGroup2: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeGroup2 = true;
      // Return a response instead of calling next()
      return { success: false, message: 'stopped by beforeGroup2' };
    });

    const beforeGroup3: TMiddleware = mock((ctx, next) => {
      ctx.request.beforeGroup3 = true;
      return next();
    });

    // Execute the beforeGroup functions
    const result = await executeBeforeGroupFunctions(context, [beforeGroup1, beforeGroup2, beforeGroup3]);

    // Verify only the first two functions were executed
    expect(beforeGroup1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(beforeGroup2).toHaveBeenCalledWith(context, expect.any(Function));
    expect(beforeGroup3).not.toHaveBeenCalled();

    // Verify the context was modified by the executed functions
    expect(context.request.beforeGroup1).toBe(true);
    expect(context.request.beforeGroup2).toBe(true);
    expect(context.request.beforeGroup3).toBeUndefined();

    // Verify the result is the response from beforeGroup2
    expect(result).toEqual({ success: false, message: 'stopped by beforeGroup2' });
  });

  it('should handle async beforeGroup functions correctly', async () => {
    const context = createMockContext();

    // Create mock beforeGroup functions
    const beforeGroup1: TMiddleware = mock(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.request.beforeGroup1 = true;
      return next();
    });

    const beforeGroup2: TMiddleware = mock(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.request.beforeGroup2 = true;
      return next();
    });

    // Execute the beforeGroup functions
    const result = await executeBeforeGroupFunctions(context, [beforeGroup1, beforeGroup2]);

    // Verify all functions were executed
    expect(beforeGroup1).toHaveBeenCalledWith(context, expect.any(Function));
    expect(beforeGroup2).toHaveBeenCalledWith(context, expect.any(Function));

    // Verify the context was modified
    expect(context.request.beforeGroup1).toBe(true);
    expect(context.request.beforeGroup2).toBe(true);

    // Verify the result is undefined (all functions passed)
    expect(result).toBeUndefined();
  });

  it('should handle errors in beforeGroup functions correctly', async () => {
    const context = createMockContext();

    // Create a beforeGroup function that throws an error
    const errorBeforeGroup: TMiddleware = mock((ctx, next) => {
      throw new Error('beforeGroup error');
    });

    // Execute the beforeGroup functions and expect it to throw
    await expect(executeBeforeGroupFunctions(context, [errorBeforeGroup])).rejects.toThrow('beforeGroup error');

    // Verify the function was executed
    expect(errorBeforeGroup).toHaveBeenCalledWith(context, expect.any(Function));
  });

  it('should handle empty beforeGroup functions array', async () => {
    const context = createMockContext();

    // Execute with an empty array
    const result = await executeBeforeGroupFunctions(context, []);

    // Verify the result is undefined
    expect(result).toBeUndefined();
  });
});
