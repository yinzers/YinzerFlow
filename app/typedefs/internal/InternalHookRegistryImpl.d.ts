import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { WebSocketMessageHook } from '@typedefs/public/WebSocket.js';

export type InternalGlobalHookOptions = {
  routesToExclude: Array<string>;
} & {
  routesToInclude: Array<string>;
};

export interface InternalHookRegistryImpl {
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
  readonly _wsBeforeMessage: Set<{ handler: WebSocketMessageHook }>;
  readonly _wsAfterMessage: Set<{ handler: WebSocketMessageHook }>;
  _onError: HandlerCallback;
  _onNotFound: HandlerCallback;
  _addBeforeRoutingHooks: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  _addBeforeHooks: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  _addAfterHooks: (handlers: Array<HandlerCallback>, options?: InternalGlobalHookOptions) => void;
  _addWsBeforeMessageHooks: (handlers: Array<WebSocketMessageHook>) => void;
  _addWsAfterMessageHooks: (handlers: Array<WebSocketMessageHook>) => void;
  _addOnError: (handler: HandlerCallback) => void;
  _addOnNotFound: (handler: HandlerCallback) => void;
  setLogger: (logger: { info: (...args: Array<unknown>) => void; warn: (...args: Array<unknown>) => void; error: (...args: Array<unknown>) => void }) => void;
}
