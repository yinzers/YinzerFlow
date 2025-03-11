import { mock } from 'bun:test';
import type { Context } from '../Context.ts';

/**
 * Creates a mock Context object for testing
 *
 * @returns A mock Context object
 */
export const createMockContext = (): Context =>
  ({
    request: {
      method: 'GET',
      path: '/test',
      params: {},
      query: {},
      headers: {},
      body: null,
    },
    response: {
      setStatus: mock(() => {}),
    },
  }) as unknown as Context;
