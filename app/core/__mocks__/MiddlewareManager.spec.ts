import { mock } from 'bun:test';
import type { MiddlewareManager } from '../MiddlewareManager.ts';
import type { IRoute, TUndefinableResponseFunction } from '../../types/Route.ts';
import type { Context } from '../Context.ts';
import type { TResponseBody } from '../../types/http/Response.ts';

/**
 * Creates a mock MiddlewareManager instance with mocked methods
 */
export const createMockMiddlewareManager = (): {
  mock: MiddlewareManager;
  processBeforeAll: ReturnType<typeof mock<(route: IRoute, ctx: Context) => Promise<TResponseBody<unknown> | void>>>;
  processBeforeGroup: ReturnType<typeof mock<(route: IRoute, ctx: Context) => Promise<TResponseBody<unknown> | void>>>;
  processBeforeHandler: ReturnType<typeof mock<(route: IRoute, ctx: Context) => Promise<TResponseBody<unknown> | void>>>;
  processAfterHandler: ReturnType<typeof mock<(route: IRoute, ctx: Context) => Promise<TResponseBody<unknown> | void>>>;
  add: ReturnType<typeof mock<(fn: TUndefinableResponseFunction, options?: { paths?: Array<string> | 'allButExcluded'; excluded?: Array<string> }) => void>>;
  reset: () => void;
} => {
  const mockProcessBeforeAll = mock<(route: IRoute, ctx: Context) => Promise<TResponseBody<unknown> | void>>(async () => Promise.resolve(undefined));

  const mockProcessBeforeGroup = mock<(route: IRoute, ctx: Context) => Promise<TResponseBody<unknown> | void>>(async () => Promise.resolve(undefined));

  const mockProcessBeforeHandler = mock<(route: IRoute, ctx: Context) => Promise<TResponseBody<unknown> | void>>(async () => Promise.resolve(undefined));

  const mockProcessAfterHandler = mock<(route: IRoute, ctx: Context) => Promise<TResponseBody<unknown> | void>>(async () => Promise.resolve(undefined));

  const mockAdd = mock<
    (
      fn: TUndefinableResponseFunction,
      options?: {
        paths?: Array<string> | 'allButExcluded';
        excluded?: Array<string>;
      },
    ) => void
  >(() => undefined);

  const mockMiddlewareManager = <MiddlewareManager>(<unknown>{
    processBeforeAll: mockProcessBeforeAll,
    processBeforeGroup: mockProcessBeforeGroup,
    processBeforeHandler: mockProcessBeforeHandler,
    processAfterHandler: mockProcessAfterHandler,
    add: mockAdd,
  });

  return {
    mock: mockMiddlewareManager,
    processBeforeAll: mockProcessBeforeAll,
    processBeforeGroup: mockProcessBeforeGroup,
    processBeforeHandler: mockProcessBeforeHandler,
    processAfterHandler: mockProcessAfterHandler,
    add: mockAdd,
    reset: (): void => {
      mockProcessBeforeAll.mockReset();
      mockProcessBeforeGroup.mockReset();
      mockProcessBeforeHandler.mockReset();
      mockProcessAfterHandler.mockReset();
      mockAdd.mockReset();
    },
  };
};
