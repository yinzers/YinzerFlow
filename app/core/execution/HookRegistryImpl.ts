import { colors } from '@constants/colors.ts';
import { httpStatusCode } from '@constants/http.ts';
import { log } from '@core/utils/log.ts';
import type { InternalGlobalHookOptions, InternalHookRegistryImpl } from '@typedefs/internal/InternalHookRegistryImpl.js';
import type { HandlerCallback } from '@typedefs/public/Context.js';

export class HookRegistryImpl implements InternalHookRegistryImpl {
  readonly _beforeRouting: Set<{
    handler: HandlerCallback;
    options?: InternalGlobalHookOptions;
  }>;
  readonly _beforeAll: Set<{
    handler: HandlerCallback;
    options?: InternalGlobalHookOptions;
  }>;
  readonly _afterAll: Set<{
    handler: HandlerCallback;
    options?: InternalGlobalHookOptions;
  }>;
  _onError: HandlerCallback;
  _onNotFound: HandlerCallback;

  constructor() {
    this._beforeRouting = new Set();
    this._beforeAll = new Set();
    this._afterAll = new Set();
    this._onError = (ctx, error: unknown): unknown => {
      log.error('Error while handling your request: ', error);
      ctx.response.setStatusCode(httpStatusCode.internalServerError);
      return { success: false, message: 'Internal Server Error' };
    };
    this._onNotFound = (ctx): unknown => {
      ctx.response.setStatusCode(httpStatusCode.notFound);
      return { success: false, message: '404 Not Found' };
    };
  }

  _addBeforeRoutingHooks(handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions): void {
    this._validateHandlersArray(handlers, 'beforeRouting');
    for (const handler of handlers) this._beforeRouting.add({ handler, options: options ?? { routesToExclude: [], routesToInclude: [] } });
  }

  _addBeforeHooks(handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions): void {
    this._validateHandlersArray(handlers, 'beforeAll');
    for (const handler of handlers) this._beforeAll.add({ handler, options: options ?? { routesToExclude: [], routesToInclude: [] } });
  }

  _addAfterHooks(handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions): void {
    this._validateHandlersArray(handlers, 'afterAll');
    for (const handler of handlers) this._afterAll.add({ handler, options: options ?? { routesToExclude: [], routesToInclude: [] } });
  }

  private _validateHandlersArray(handlers: unknown, methodName: string): asserts handlers is Array<HandlerCallback> {
    if (!Array.isArray(handlers)) {
      const receivedType = typeof handlers;
      const isFunction = receivedType === 'function';

      throw new Error(
        `YinzerFlow: ${methodName}() expects an array of handler functions, but received ${receivedType}.${
          isFunction ?
            `\n\n❌ Incorrect: app.${methodName}${colors.red}(${colors.reset}(ctx) => { ... }${colors.red})${colors.reset}\n✅ Correct: app.${methodName}${colors.green}([${colors.reset}(ctx) => { ... }${colors.green}])${colors.reset}\n\nNote: Wrap your handler function in ${colors.magenta}square brackets${colors.reset} to make it an array.\n\n`
          : `\n\n Expected: Array<HandlerCallback>\n Received: ${receivedType}`
        }`,
      );
    }

    if (handlers.length === 0) {
      log.warn(`${methodName}() called with empty array. No hooks will be registered.`);
      return;
    }

    for (let i = 0; i < handlers.length; i++) {
      const handler = handlers[i] as unknown;
      if (typeof handler !== 'function') {
        throw new Error(`YinzerFlow: ${methodName}() array contains non-function at index ${i}. Expected: function, received: ${typeof handler}`);
      }
    }
  }

  _addOnError(handler: HandlerCallback): void {
    this._onError = handler;
  }

  _addOnNotFound(handler: HandlerCallback): void {
    this._onNotFound = handler;
  }
}
