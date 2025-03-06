import type { Context } from 'core/Context.ts';
import type { TResponseBody } from 'types/http/Response.ts';

/**
 * Execute beforeHandler functions in sequence
 * @param ctx The request context
 * @param beforeHandlers Array of beforeHandler functions to execute
 * @returns Response body if a beforeHandler returns one, otherwise undefined
 */
export default async (ctx: Context, beforeHandlers: Array<(ctx: Context, next: () => Promise<unknown>) => unknown>): Promise<TResponseBody<unknown> | void> => {
  if (beforeHandlers.length === 0) {
    return undefined;
  }

  // Create a chain of beforeHandler functions
  let index = 0;

  const next = async (): Promise<TResponseBody<unknown> | void> => {
    // If we've executed all beforeHandler functions, return undefined
    if (index >= beforeHandlers.length) {
      return undefined;
    }

    // Get the current beforeHandler function
    const beforeHandler = beforeHandlers[index++];

    // Execute the beforeHandler function with the context and next function
    if (beforeHandler) {
      return Promise.resolve(beforeHandler(ctx, next));
    }
    return undefined;
  };

  // Start the beforeHandler chain
  return next();
};
