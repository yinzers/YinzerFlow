import { mock, type Mock } from 'bun:test';
import type { Context } from '../Context.ts';
import type { TErrorFunction } from '../../types/Response.ts';

/**
 * Creates a mock error handler function
 */
export function createMockErrorHandler() {
  const mockErrorHandler = mock<TErrorFunction>((ctx: Context, error: unknown) => {
    return {
      success: false,
      message: error instanceof Error ? error.message : String(error),
    };
  });

  return {
    mock: mockErrorHandler,
    reset: () => {
      mockErrorHandler.mockReset();
    },
  };
}
