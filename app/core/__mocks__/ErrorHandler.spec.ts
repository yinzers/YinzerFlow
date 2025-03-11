import {  mock } from 'bun:test';
import type {Mock} from 'bun:test';
import type { Context } from '../Context.ts';
import type { TErrorFunction } from '../../types/Response.ts';

/**
 * Creates a mock error handler function
 */
export const createMockErrorHandler = (): {
  mock: Mock<TErrorFunction>;
  reset: () => void;
} => {
  const mockErrorHandler = mock<TErrorFunction>((_ctx: Context, error: unknown) => ({
    success: false,
    message: error instanceof Error ? error.message : String(error),
  }));

  return {
    mock: mockErrorHandler,
    reset: (): void => {
      mockErrorHandler.mockReset();
    },
  };
};
