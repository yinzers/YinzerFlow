import {  mock } from 'bun:test';
import type {Mock} from 'bun:test';
import type { RouteFinder } from '../RouteFinder.ts';
import type { HttpRequest } from '../HttpRequest.ts';
import type { IRoute } from '../../types/Route.ts';

/**
 * Creates a mock RouteFinder instance with mocked methods
 */
export function createMockRouteFinder() {
  const mockFindRouteFromRequest = mock<(request: HttpRequest) => IRoute | undefined>((request: HttpRequest) => undefined);

  const mockRouteFinder = {
    findRouteFromRequest: mockFindRouteFromRequest,
  } as unknown as RouteFinder;

  return {
    mock: mockRouteFinder,
    findRouteFromRequest: mockFindRouteFromRequest,
    reset: () => {
      mockFindRouteFromRequest.mockReset();
    },
  };
}
