import type { TResponseFunction } from '../../types/Route.ts';

/**
 * Creates a mock route handler that returns a simple message
 *
 * @param message - The message to return
 * @returns A mock route handler function
 */
export const createMockHandler = (message = 'Hello'): TResponseFunction => {
  return () => ({ message });
};
