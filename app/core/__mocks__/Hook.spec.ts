import { mock } from 'bun:test';
import type { TUndefinableResponseFunction } from '../../types/Route.ts';

type MockHook = TUndefinableResponseFunction & { mockClear: () => void };

/**
 * Creates a mock hook function that returns undefined (doesn't interrupt the request flow)
 *
 * @returns A mock hook function with mock methods
 */
export const createPassthroughHook = (): MockHook => {
  return mock(() => undefined) as MockHook;
};

/**
 * Creates a mock hook function that returns a response (interrupts the request flow)
 *
 * @param message - The message to return in the response
 * @returns A mock hook function with mock methods
 */
export const createInterruptingHook = (message = 'Interrupted'): MockHook => {
  return mock(() => ({ message })) as MockHook;
};

/**
 * Creates a mock hook function that throws an error
 *
 * @param errorMessage - The error message
 * @returns A mock hook function with mock methods
 */
export const createErrorHook = (errorMessage = 'Hook error'): MockHook => {
  return mock(() => {
    throw new Error(errorMessage);
  }) as MockHook;
};
