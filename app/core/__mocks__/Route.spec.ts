import type { IRoute } from '../../types/Route.ts';

/**
 * Creates a mock Route object for testing
 *
 * @param path - The route path
 * @returns A mock IRoute object
 */
export const createMockRoute = (path: string): IRoute => ({
  method: 'GET',
  path,
  handler: () => ({}),
});
