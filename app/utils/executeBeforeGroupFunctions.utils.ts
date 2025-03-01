import type { Context } from '../types/Common.ts';
import type { TResponseBody } from '../types/http/Response.ts';

/**
 * Execute beforeGroup functions in sequence
 * @param ctx The request context
 * @param beforeGroups Array of beforeGroup functions to execute
 * @returns Response body if a beforeGroup returns one, otherwise undefined
 */
export default async (ctx: Context, beforeGroups: Array<(ctx: Context, next: () => Promise<unknown>) => unknown>): Promise<TResponseBody<unknown> | void> => {
  if (beforeGroups.length === 0) {
    return undefined;
  }

  // Create a chain of beforeGroup functions
  let index = 0;

  const next = async (): Promise<TResponseBody<unknown> | void> => {
    // If we've executed all beforeGroup functions, return undefined
    if (index >= beforeGroups.length) {
      return undefined;
    }

    // Get the current beforeGroup function
    const beforeGroup = beforeGroups[index++];

    // Execute the beforeGroup function with the context and next function
    if (beforeGroup) {
      return Promise.resolve(beforeGroup(ctx, next));
    }
    return undefined;
  };

  // Start the beforeGroup chain
  return next();
};
