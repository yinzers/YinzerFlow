/**
 * executeHandlerFunction Tests
 *
 * Tests for the executeHandlerFunction utility which executes route handler functions.
 */

import { describe, expect, it, mock } from 'bun:test';
import executeHandlerFunction from 'utils/executeHandlerFunction.utils.ts';
import type { Context } from 'types/Common';
import type { IRoute } from 'types/Route';
import { HttpMethod } from 'constants/http.ts';

describe('executeHandlerFunction', () => {
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

  it('should execute a handler function and return its result', async () => {
    const context = createMockContext();

    // Create a mock route with a handler
    const route: IRoute = {
      method: HttpMethod.GET,
      path: '/test',
      handler: mock(() => ({ success: true, message: 'handler executed' })),
    };

    // Execute the handler function
    const result = await executeHandlerFunction(context, route);

    // Verify the handler was executed
    expect(route.handler).toHaveBeenCalledWith(context);

    // Verify the result is the response from the handler
    expect(result).toEqual({ success: true, message: 'handler executed' });
  });

  it('should handle async handler functions correctly', async () => {
    const context = createMockContext();

    // Create a mock route with an async handler
    const route: IRoute = {
      method: HttpMethod.GET,
      path: '/test',
      handler: mock(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { success: true, message: 'async handler executed' };
      }),
    };

    // Execute the handler function
    const result = await executeHandlerFunction(context, route);

    // Verify the handler was executed
    expect(route.handler).toHaveBeenCalledWith(context);

    // Verify the result is the response from the handler
    expect(result).toEqual({ success: true, message: 'async handler executed' });
  });

  it('should handle handler functions that modify the context', async () => {
    const context = createMockContext();

    // Create a mock route with a handler that modifies the context
    const route: IRoute = {
      method: HttpMethod.GET,
      path: '/test',
      handler: mock((ctx) => {
        ctx.request.handlerModified = true;
        ctx.response.setStatus(201);
        return { success: true, created: true };
      }),
    };

    // Execute the handler function
    const result = await executeHandlerFunction(context, route);

    // Verify the handler was executed
    expect(route.handler).toHaveBeenCalledWith(context);

    // Verify the context was modified
    expect(context.request.handlerModified).toBe(true);
    expect(context.response.setStatus).toHaveBeenCalledWith(201);

    // Verify the result is the response from the handler
    expect(result).toEqual({ success: true, created: true });
  });

  it('should handle errors in handler functions correctly', async () => {
    const context = createMockContext();

    // Create a mock route with a handler that throws an error
    const route: IRoute = {
      method: HttpMethod.GET,
      path: '/test',
      handler: mock(() => {
        throw new Error('handler error');
      }),
    };

    // Execute the handler function and expect it to throw
    await expect(executeHandlerFunction(context, route)).rejects.toThrow('handler error');

    // Verify the handler was executed
    expect(route.handler).toHaveBeenCalledWith(context);
  });

  it('should handle handler functions that return undefined', async () => {
    const context = createMockContext();

    // Create a mock route with a handler that returns undefined
    const route: IRoute = {
      method: HttpMethod.GET,
      path: '/test',
      handler: mock(() => undefined),
    };

    // Execute the handler function
    const result = await executeHandlerFunction(context, route);

    // Verify the handler was executed
    expect(route.handler).toHaveBeenCalledWith(context);

    // Verify the result is undefined
    expect(result).toBeUndefined();
  });

  it('should handle handler functions that return null', async () => {
    const context = createMockContext();

    // Create a mock route with a handler that returns null
    const route: IRoute = {
      method: HttpMethod.GET,
      path: '/test',
      handler: mock(() => null),
    };

    // Execute the handler function
    const result = await executeHandlerFunction(context, route);

    // Verify the handler was executed
    expect(route.handler).toHaveBeenCalledWith(context);

    // Verify the result is null
    expect(result).toBeNull();
  });

  it('should handle handler functions that return primitive values', async () => {
    const context = createMockContext();

    // Create a mock route with a handler that returns a string
    const route: IRoute = {
      method: HttpMethod.GET,
      path: '/test',
      handler: mock(() => 'string response'),
    };

    // Execute the handler function
    const result = await executeHandlerFunction(context, route);

    // Verify the handler was executed
    expect(route.handler).toHaveBeenCalledWith(context);

    // Verify the result is the string
    expect(result).toBe('string response');
  });
});
