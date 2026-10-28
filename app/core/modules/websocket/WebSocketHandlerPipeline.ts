import type { InternalHookRegistryImpl } from '@typedefs/internal/InternalHookRegistryImpl.js';
import type { Logger } from '@typedefs/public/Logger.ts';
import type { WebSocket, WebSocketHandlers } from '@typedefs/public/WebSocket.js';

/**
 * Wrap a WebSocket route's handlers so that no user callback can throw into the connection's socket events.
 *
 * Every callback (`open`, `message`, `close`, `drain`, `error`) is invoked through one guard that catches a
 * synchronous throw and a rejected promise alike. A caught error goes to the route's `error` handler when it has one
 * (the way `onError` owns HTTP errors), otherwise it is logged once at error level. The connection stays open either way.
 *
 * `message` also runs the global `wsBeforeMessage` hooks before the handler and the `wsAfterMessage` hooks after it.
 */
export const _wrapWebSocketHandlers = (handlers: WebSocketHandlers, hooks: InternalHookRegistryImpl, logger: Pick<Logger, 'error'>): WebSocketHandlers => {
  const report = (ws: WebSocket, handlerName: string, error: unknown): void => _reportHandlerError({ handlers, logger, ws, handlerName, error });

  return {
    ...handlers,
    open: (ws): void =>
      _invokeGuarded(
        () => handlers.open?.(ws),
        (error) => report(ws, 'open', error),
      ),
    message: (ws, data, isBinary): void => {
      _runMessagePipeline({ handlers, hooks, ws, data, isBinary }).catch((error: unknown) => report(ws, 'message', error));
    },
    close: (ws, code, reason): void =>
      _invokeGuarded(
        () => handlers.close?.(ws, code, reason),
        (error) => report(ws, 'close', error),
      ),
    drain: (ws): void =>
      _invokeGuarded(
        () => handlers.drain?.(ws),
        (error) => report(ws, 'drain', error),
      ),
    error: (ws, socketError): void =>
      _invokeGuarded(
        () => handlers.error?.(ws, socketError),
        (error) => logger.error('Error in WebSocket error handler:', error),
      ),
  };
};

/** Call `call`, sending a synchronous throw or a rejected promise to `onError`. */
const _invokeGuarded = (call: () => unknown, onError: (error: unknown) => void): void => {
  try {
    const result = call();
    if (result instanceof Promise) result.catch(onError);
  } catch (error) {
    onError(error);
  }
};

/**
 * Before hooks, the route's message handler, then after hooks, in order. A hook or handler that returns a promise is
 * awaited; a synchronous one is not, so a route with no hooks and a synchronous handler delivers in the same tick.
 */
const _runMessagePipeline = async ({
  handlers,
  hooks,
  ws,
  data,
  isBinary,
}: {
  handlers: WebSocketHandlers;
  hooks: InternalHookRegistryImpl;
  ws: WebSocket;
  data: Buffer | string;
  isBinary: boolean;
}): Promise<void> => {
  for (const hook of hooks._wsBeforeMessage) {
    const result = hook.handler(ws, data, isBinary);
    if (result instanceof Promise) await result;
  }

  const handlerResult: unknown = handlers.message?.(ws, data, isBinary);
  if (handlerResult instanceof Promise) await handlerResult;

  for (const hook of hooks._wsAfterMessage) {
    const result = hook.handler(ws, data, isBinary);
    if (result instanceof Promise) await result;
  }
};

/** Hand a caught handler error to the route's `error` handler, or log it once when the route has none. */
const _reportHandlerError = ({
  handlers,
  logger,
  ws,
  handlerName,
  error,
}: {
  handlers: WebSocketHandlers;
  logger: Pick<Logger, 'error'>;
  ws: WebSocket;
  handlerName: string;
  error: unknown;
}): void => {
  if (!handlers.error) {
    logger.error(`Error in WebSocket ${handlerName} handler:`, error);
    return;
  }

  const asError = error instanceof Error ? error : new Error(String(error));
  _invokeGuarded(
    () => handlers.error?.(ws, asError),
    (errorHandlerError) => logger.error('Error in WebSocket error handler:', errorHandlerError),
  );
};
