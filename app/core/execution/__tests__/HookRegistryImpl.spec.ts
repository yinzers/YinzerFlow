import { beforeEach, describe, expect, it } from 'bun:test';
import { HookRegistryImpl } from '../HookRegistryImpl.ts';
import { ContextImpl } from '../ContextImpl.ts';
import { SetupImpl } from '@core/setup/SetupImpl.ts';
import { httpStatusCode } from '@constants/http.ts';
import type { Context, HandlerCallback } from '@typedefs/public/Context.js';
import type { InternalGlobalHookOptions } from '@typedefs/internal/InternalHookRegistryImpl.js';

// Test data builders
const createTestContext = (requestString = 'GET / HTTP/1.1\r\nHost: localhost\r\n\r\n'): Context => {
  return new ContextImpl(Buffer.from(requestString), new SetupImpl());
};

const createHandler = (returnValue?: unknown): HandlerCallback => {
  return (_) => returnValue;
};

const createAsyncHandler = (returnValue?: unknown): HandlerCallback => {
  return async (_) => await returnValue;
};

describe('HookRegistryImpl', () => {
  let hookRegistry: HookRegistryImpl;
  let context: Context;

  beforeEach(() => {
    hookRegistry = new HookRegistryImpl();
    context = createTestContext();
  });

  describe('constructor initialization', () => {
    it('should initialize with empty hook sets', () => {
      expect(hookRegistry._beforeAll).toBeInstanceOf(Set);
      expect(hookRegistry._afterAll).toBeInstanceOf(Set);
      expect(hookRegistry._beforeAll.size).toBe(0);
      expect(hookRegistry._afterAll.size).toBe(0);
    });

    it('should initialize with default error handler', () => {
      expect(typeof hookRegistry._onError).toBe('function');

      const result = hookRegistry._onError(context);
      expect(result).toEqual({
        success: false,
        message: 'Internal Server Error',
      });
    });

    it('should initialize with default not found handler', () => {
      expect(typeof hookRegistry._onNotFound).toBe('function');

      const result = hookRegistry._onNotFound(context);
      expect(result).toEqual({
        success: false,
        message: '404 Not Found',
      });
    });
  });

  describe('default handlers behavior', () => {
    it('should set 500 status code in default error handler', () => {
      hookRegistry._onError(context);

      // Check that the status code was set on the actual response
      expect((context as any)._response._statusCode).toBe(httpStatusCode.internalServerError);
    });

    it('should set 404 status code in default not found handler', () => {
      hookRegistry._onNotFound(context);

      // Check that the status code was set on the actual response
      expect((context as any)._response._statusCode).toBe(httpStatusCode.notFound);
    });
  });

  describe('_addBeforeHooks', () => {
    it('should add single hook without options', () => {
      const handler = createHandler();

      hookRegistry._addBeforeHooks([handler]);

      expect(hookRegistry._beforeAll.size).toBe(1);
      const [hookEntry] = Array.from(hookRegistry._beforeAll);
      if (!hookEntry) throw new Error('Hook entry is undefined');
      expect(hookEntry.handler).toBe(handler);
      expect(hookEntry.options).toEqual({
        routesToExclude: [],
        routesToInclude: [],
      });
    });

    it('should add multiple hooks at once', () => {
      const handler1 = createHandler();
      const handler2 = createHandler();
      const handler3 = createHandler();

      hookRegistry._addBeforeHooks([handler1, handler2, handler3]);

      expect(hookRegistry._beforeAll.size).toBe(3);
      const handlers = Array.from(hookRegistry._beforeAll).map((entry) => entry.handler);
      expect(handlers).toContain(handler1);
      expect(handlers).toContain(handler2);
      expect(handlers).toContain(handler3);
    });

    it('should add hooks with custom options', () => {
      const handler = createHandler();
      const options: InternalGlobalHookOptions = {
        routesToExclude: ['/api/health'],
        routesToInclude: ['/api/*'],
      };

      hookRegistry._addBeforeHooks([handler], options);

      const [hookEntry] = Array.from(hookRegistry._beforeAll);
      if (!hookEntry) throw new Error('Hook entry is undefined');
      expect(hookEntry.options).toEqual(options);
    });

    it('should handle empty array gracefully', () => {
      hookRegistry._addBeforeHooks([]);

      expect(hookRegistry._beforeAll.size).toBe(0);
    });

    it('should add different hook types (sync and async)', () => {
      const syncHandler = createHandler();
      const asyncHandler = createAsyncHandler();

      hookRegistry._addBeforeHooks([syncHandler, asyncHandler]);

      expect(hookRegistry._beforeAll.size).toBe(2);
    });
  });

  describe('_addAfterHooks', () => {
    it('should add single hook without options', () => {
      const handler = createHandler();

      hookRegistry._addAfterHooks([handler]);

      expect(hookRegistry._afterAll.size).toBe(1);
      const [hookEntry] = Array.from(hookRegistry._afterAll);
      if (!hookEntry) throw new Error('Hook entry is undefined');
      expect(hookEntry.handler).toBe(handler);
      expect(hookEntry.options).toEqual({
        routesToExclude: [],
        routesToInclude: [],
      });
    });

    it('should add multiple hooks with different options', () => {
      const handler1 = createHandler();
      const handler2 = createHandler();
      const options1: InternalGlobalHookOptions = {
        routesToExclude: [],
        routesToInclude: ['/api/*'],
      };
      const options2: InternalGlobalHookOptions = {
        routesToExclude: ['/admin/*'],
        routesToInclude: [],
      };

      hookRegistry._addAfterHooks([handler1], options1);
      hookRegistry._addAfterHooks([handler2], options2);

      expect(hookRegistry._afterAll.size).toBe(2);
      const hookEntries = Array.from(hookRegistry._afterAll);

      const entry1 = hookEntries.find((entry) => entry.handler === handler1);
      const entry2 = hookEntries.find((entry) => entry.handler === handler2);

      expect(entry1?.options).toEqual(options1);
      expect(entry2?.options).toEqual(options2);
    });

    it('should handle empty array gracefully', () => {
      hookRegistry._addAfterHooks([]);

      expect(hookRegistry._afterAll.size).toBe(0);
    });
  });

  describe('_addOnError', () => {
    it('should replace default error handler', () => {
      const customErrorHandler = createHandler({ error: 'Custom error' });

      hookRegistry._addOnError(customErrorHandler);

      expect(hookRegistry._onError).toBe(customErrorHandler);
      const result = hookRegistry._onError(context);
      expect(result).toEqual({ error: 'Custom error' });
    });

    it('should handle async error handler', async () => {
      const asyncErrorHandler = createAsyncHandler({ async: true, error: 'Async error' });

      hookRegistry._addOnError(asyncErrorHandler);

      const result = await hookRegistry._onError(context);
      expect(result).toEqual({ async: true, error: 'Async error' });
    });

    it('should overwrite previous error handler', () => {
      const firstHandler = createHandler({ first: true });
      const secondHandler = createHandler({ second: true });

      hookRegistry._addOnError(firstHandler);
      expect(hookRegistry._onError).toBe(firstHandler);

      hookRegistry._addOnError(secondHandler);
      expect(hookRegistry._onError).toBe(secondHandler);

      const result = hookRegistry._onError(context);
      expect(result).toEqual({ second: true });
    });
  });

  describe('_addOnNotFound', () => {
    it('should replace default not found handler', () => {
      const customNotFoundHandler = createHandler({
        status: 'not_found',
        message: 'Custom not found message',
      });

      hookRegistry._addOnNotFound(customNotFoundHandler);

      expect(hookRegistry._onNotFound).toBe(customNotFoundHandler);
      const result = hookRegistry._onNotFound(context);
      expect(result).toEqual({
        status: 'not_found',
        message: 'Custom not found message',
      });
    });

    it('should handle async not found handler', async () => {
      const asyncNotFoundHandler = createAsyncHandler({
        async: true,
        status: 404,
        message: 'Async not found',
      });

      hookRegistry._addOnNotFound(asyncNotFoundHandler);

      const result = await hookRegistry._onNotFound(context);
      expect(result).toEqual({
        async: true,
        status: 404,
        message: 'Async not found',
      });
    });

    it('should overwrite previous not found handler', () => {
      const firstHandler = createHandler({ version: 1 });
      const secondHandler = createHandler({ version: 2 });

      hookRegistry._addOnNotFound(firstHandler);
      hookRegistry._addOnNotFound(secondHandler);

      expect(hookRegistry._onNotFound).toBe(secondHandler);
      const result = hookRegistry._onNotFound(context);
      expect(result).toEqual({ version: 2 });
    });
  });

  describe('hook collection management', () => {
    it('should maintain separate before and after hook collections', () => {
      const beforeHandler = createHandler();
      const afterHandler = createHandler();

      hookRegistry._addBeforeHooks([beforeHandler]);
      hookRegistry._addAfterHooks([afterHandler]);

      expect(hookRegistry._beforeAll.size).toBe(1);
      expect(hookRegistry._afterAll.size).toBe(1);

      const beforeHandlers = Array.from(hookRegistry._beforeAll).map((entry) => entry.handler);
      const afterHandlers = Array.from(hookRegistry._afterAll).map((entry) => entry.handler);

      expect(beforeHandlers).toContain(beforeHandler);
      expect(afterHandlers).toContain(afterHandler);
      expect(beforeHandlers).not.toContain(afterHandler);
      expect(afterHandlers).not.toContain(beforeHandler);
    });

    it('should allow same handler in both before and after collections', () => {
      const sharedHandler = createHandler();

      hookRegistry._addBeforeHooks([sharedHandler]);
      hookRegistry._addAfterHooks([sharedHandler]);

      expect(hookRegistry._beforeAll.size).toBe(1);
      expect(hookRegistry._afterAll.size).toBe(1);

      const [beforeHandler] = Array.from(hookRegistry._beforeAll);
      if (!beforeHandler) throw new Error('Before handler is undefined');
      const [afterHandler] = Array.from(hookRegistry._afterAll);
      if (!afterHandler) throw new Error('After handler is undefined');

      expect(beforeHandler.handler).toBe(sharedHandler);
      expect(afterHandler.handler).toBe(sharedHandler);
    });

    it('should handle multiple calls to add hooks', () => {
      const handler1 = createHandler();
      const handler2 = createHandler();
      const handler3 = createHandler();

      hookRegistry._addBeforeHooks([handler1]);
      hookRegistry._addBeforeHooks([handler2, handler3]);

      expect(hookRegistry._beforeAll.size).toBe(3);

      const handlers = Array.from(hookRegistry._beforeAll).map((entry) => entry.handler);
      expect(handlers).toContain(handler1);
      expect(handlers).toContain(handler2);
      expect(handlers).toContain(handler3);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete hook registry setup', () => {
      // Setup multiple hooks with different configurations
      const authHook = createHandler();
      const loggingHook = createHandler();
      const cleanupHook = createHandler();
      const customErrorHandler = createHandler({ error: true });
      const customNotFoundHandler = createHandler({ notFound: true });

      const authOptions: InternalGlobalHookOptions = {
        routesToExclude: ['/public/*'],
        routesToInclude: [],
      };

      const loggingOptions: InternalGlobalHookOptions = {
        routesToExclude: [],
        routesToInclude: ['/api/*'],
      };

      // Add hooks
      hookRegistry._addBeforeHooks([authHook], authOptions);
      hookRegistry._addBeforeHooks([loggingHook], loggingOptions);
      hookRegistry._addAfterHooks([cleanupHook]);
      hookRegistry._addOnError(customErrorHandler);
      hookRegistry._addOnNotFound(customNotFoundHandler);

      // Verify all hooks are properly registered
      expect(hookRegistry._beforeAll.size).toBe(2);
      expect(hookRegistry._afterAll.size).toBe(1);
      expect(hookRegistry._onError).toBe(customErrorHandler);
      expect(hookRegistry._onNotFound).toBe(customNotFoundHandler);

      // Verify hook options are preserved
      const beforeHooks = Array.from(hookRegistry._beforeAll);
      const authEntry = beforeHooks.find((entry) => entry.handler === authHook);
      const loggingEntry = beforeHooks.find((entry) => entry.handler === loggingHook);

      expect(authEntry?.options).toEqual(authOptions);
      expect(loggingEntry?.options).toEqual(loggingOptions);
    });
  });
});
