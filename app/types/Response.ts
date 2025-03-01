import type { Context } from '../Context.utils.ts';
import type { TResponseBody } from '../HttpResponse.ts';

export type TErrorFunction =
  | ((ctx: Context, error: unknown) => Promise<TResponseBody<unknown>> | TResponseBody<unknown>)
  | ((ctx: Context, error: unknown) => Promise<void> | void);
