import { mock, type Mock } from 'bun:test';
import { MiddlewareManager } from '../MiddlewareManager.ts';
import type { IRoute } from '../../types/Route.ts';
import type { Context } from '../Context.ts';

/**
 * Creates a mock MiddlewareManager instance with mocked methods
 */
export function createMockMiddlewareManager() {
  const mockProcessBeforeAll = mock<(route: IRoute, ctx: Context) => Promise<unknown>>((route: IRoute, ctx: Context) => Promise.resolve(undefined));

  const mockProcessBeforeGroup = mock<(route: IRoute, ctx: Context) => Promise<unknown>>((route: IRoute, ctx: Context) => Promise.resolve(undefined));

  const mockProcessBeforeHandler = mock<(route: IRoute, ctx: Context) => Promise<unknown>>((route: IRoute, ctx: Context) => Promise.resolve(undefined));

  const mockProcessAfterHandler = mock<(route: IRoute, ctx: Context) => Promise<unknown>>((route: IRoute, ctx: Context) => Promise.resolve(undefined));

  const mockMiddlewareManager = {
    processBeforeAll: mockProcessBeforeAll,
    processBeforeGroup: mockProcessBeforeGroup,
    processBeforeHandler: mockProcessBeforeHandler,
    processAfterHandler: mockProcessAfterHandler,
  } as unknown as MiddlewareManager;

  return {
    mock: mockMiddlewareManager,
    processBeforeAll: mockProcessBeforeAll,
    processBeforeGroup: mockProcessBeforeGroup,
    processBeforeHandler: mockProcessBeforeHandler,
    processAfterHandler: mockProcessAfterHandler,
    reset: () => {
      mockProcessBeforeAll.mockReset();
      mockProcessBeforeGroup.mockReset();
      mockProcessBeforeHandler.mockReset();
      mockProcessAfterHandler.mockReset();
    },
  };
}
