/**
 * MiddlewareExecutor Tests
 *
 * Tests for the MiddlewareExecutor class which executes middleware in the correct order.
 */

import { describe, expect, it, mock } from 'bun:test';
import { MiddlewareExecutor } from 'core/MiddlewareExecutor.ts';
import type { TMiddleware } from 'types/Middleware';
import type { Context } from 'types/Common';
import { HttpRequest } from 'core/HttpRequest.ts';
import { HttpResponse } from 'core/HttpResponse.ts';

describe('MiddlewareExecutor', () => {
  // Create a mock context for testing
  const createMockContext = (): Context => {
    const request = new HttpRequest('GET /test HTTP/1.1\r\nHost: example.com\r\n\r\n');
    const response = new HttpResponse(request);
    return { request, response };
  };

  it('should execute a single middleware correctly', async () => {
    const executor = new MiddlewareExecutor();
    const context = createMockContext();

    // Create a mock middleware
    const middleware: TMiddleware = mock((ctx, next) => {
      ctx.request.testValue = 'middleware executed';
      return next();
    });

    // Create a mock final handler
    const finalHandler = mock(() => ({ success: true, message: 'final handler executed' }));

    // Execute the middleware chain
    const result = await executor.execute(context, [middleware], finalHandler);

    // Verify the middleware was executed
    expect(middleware).toHaveBeenCalled();
    expect(context.request.testValue).toBe('middleware executed');

    // Verify the final handler was executed
    expect(finalHandler).toHaveBeenCalled();
    expect(result).toEqual({ success: true, message: 'final handler executed' });
  });

  it('should execute multiple middleware in the correct order', async () => {
    const executor = new MiddlewareExecutor();
    const context = createMockContext();
    const executionOrder: Array<number> = [];

    // Create mock middleware functions
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

    // Create a mock final handler
    const finalHandler = mock(() => {
      executionOrder.push(4);
      return { success: true };
    });

    // Execute the middleware chain
    await executor.execute(context, [middleware1, middleware2, middleware3], finalHandler);

    // Verify all middleware were executed in the correct order
    expect(middleware1).toHaveBeenCalled();
    expect(middleware2).toHaveBeenCalled();
    expect(middleware3).toHaveBeenCalled();
    expect(finalHandler).toHaveBeenCalled();

    expect(context.request.middleware1).toBe(true);
    expect(context.request.middleware2).toBe(true);
    expect(context.request.middleware3).toBe(true);

    expect(executionOrder).toEqual([1, 2, 3, 4]);
  });

  it('should stop execution if middleware returns a response', async () => {
    const executor = new MiddlewareExecutor();
    const context = createMockContext();
    const executionOrder: Array<number> = [];

    // Create mock middleware functions
    const middleware1: TMiddleware = mock((ctx, next) => {
      executionOrder.push(1);
      ctx.request.middleware1 = true;
      return next();
    });

    const middleware2: TMiddleware = mock((ctx, next) => {
      executionOrder.push(2);
      ctx.request.middleware2 = true;
      // Return a response instead of calling next()
      return { success: false, message: 'stopped by middleware2' };
    });

    const middleware3: TMiddleware = mock((ctx, next) => {
      executionOrder.push(3);
      ctx.request.middleware3 = true;
      return next();
    });

    // Create a mock final handler
    const finalHandler = mock(() => {
      executionOrder.push(4);
      return { success: true };
    });

    // Execute the middleware chain
    const result = await executor.execute(context, [middleware1, middleware2, middleware3], finalHandler);

    // Verify only the first two middleware were executed
    expect(middleware1).toHaveBeenCalled();
    expect(middleware2).toHaveBeenCalled();
    expect(middleware3).not.toHaveBeenCalled();
    expect(finalHandler).not.toHaveBeenCalled();

    expect(context.request.middleware1).toBe(true);
    expect(context.request.middleware2).toBe(true);
    expect(context.request.middleware3).toBeUndefined();

    expect(executionOrder).toEqual([1, 2]);
    expect(result).toEqual({ success: false, message: 'stopped by middleware2' });
  });

  it('should handle async middleware correctly', async () => {
    const executor = new MiddlewareExecutor();
    const context = createMockContext();

    // Create an async middleware
    const asyncMiddleware: TMiddleware = mock(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      ctx.request.asyncMiddleware = true;
      return next();
    });

    // Create a mock final handler
    const finalHandler = mock(() => ({ success: true }));

    // Execute the middleware chain
    await executor.execute(context, [asyncMiddleware], finalHandler);

    // Verify the middleware was executed
    expect(asyncMiddleware).toHaveBeenCalled();
    expect(context.request.asyncMiddleware).toBe(true);
    expect(finalHandler).toHaveBeenCalled();
  });

  it('should handle errors in middleware correctly', async () => {
    const executor = new MiddlewareExecutor();
    const context = createMockContext();

    // Create a middleware that throws an error
    const errorMiddleware: TMiddleware = mock((ctx, next) => {
      throw new Error('middleware error');
    });

    // Create a mock final handler
    const finalHandler = mock(() => ({ success: true }));

    // Execute the middleware chain and expect it to throw
    await expect(executor.execute(context, [errorMiddleware], finalHandler)).rejects.toThrow('middleware error');

    // Verify the middleware was executed but not the final handler
    expect(errorMiddleware).toHaveBeenCalled();
    expect(finalHandler).not.toHaveBeenCalled();
  });

  it('should handle errors in async middleware correctly', async () => {
    const executor = new MiddlewareExecutor();
    const context = createMockContext();

    // Create an async middleware that throws an error
    const asyncErrorMiddleware: TMiddleware = mock(async (ctx, next) => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new Error('async middleware error');
    });

    // Create a mock final handler
    const finalHandler = mock(() => ({ success: true }));

    // Execute the middleware chain and expect it to throw
    await expect(executor.execute(context, [asyncErrorMiddleware], finalHandler)).rejects.toThrow('async middleware error');

    // Verify the middleware was executed but not the final handler
    expect(asyncErrorMiddleware).toHaveBeenCalled();
    expect(finalHandler).not.toHaveBeenCalled();
  });
});
