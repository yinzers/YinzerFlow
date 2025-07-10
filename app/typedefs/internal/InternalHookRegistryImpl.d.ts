import type { HandlerCallback } from '@typedefs/public/Context.js';

export type InternalGlobalHookOptions = {
  routesToExclude: Array<string>;
} & {
  routesToInclude: Array<string>;
};

export interface InternalHookRegistryImpl {
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
  _addBeforeHooks: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  _addAfterHooks: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  _addOnError: (handler: HandlerCallback) => void;
  _addOnNotFound: (handler: HandlerCallback) => void;
}
