import { mock } from 'bun:test';
import type { RouteFinder } from '../RouteFinder.ts';
import type { Request } from '../Request.ts';
import type { IRoute } from '../../types/Route.ts';

/**
 * Creates a mock RouteFinder instance with mocked methods
 */
export const createMockRouteFinder = (): {
  mock: RouteFinder;
  findRouteFromRequest: ReturnType<typeof mock<(request: Request) => IRoute | undefined>>;
  findRoute: ReturnType<typeof mock<(method: string, path: string) => IRoute | undefined>>;
  extractParamsFromPath: ReturnType<typeof mock<(path: string, pattern: string) => Record<string, string>>>;
  reset: () => void;
} => {
  const mockFindRouteFromRequest = mock<(request: Request) => IRoute | undefined>((_request: Request) => undefined);

  const mockFindRoute = mock<(method: string, path: string) => IRoute | undefined>((_method: string, _path: string) => undefined);

  const mockExtractParamsFromPath = mock<(path: string, pattern: string) => Record<string, string>>((_path: string, _pattern: string) => ({}));

  const mockRouteFinder = <RouteFinder>(<unknown>{
    findRouteFromRequest: mockFindRouteFromRequest,
    findRoute: mockFindRoute,
    extractParamsFromPath: mockExtractParamsFromPath,
  });

  return {
    mock: mockRouteFinder,
    findRouteFromRequest: mockFindRouteFromRequest,
    findRoute: mockFindRoute,
    extractParamsFromPath: mockExtractParamsFromPath,
    reset: (): void => {
      mockFindRouteFromRequest.mockReset();
      mockFindRoute.mockReset();
      mockExtractParamsFromPath.mockReset();
    },
  };
};
