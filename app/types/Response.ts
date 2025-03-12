import type { TResponseBody } from 'types/http/Response.ts';
import type { Context } from 'core/Context.ts';

export type TErrorFunction =
  | ((ctx: Context, error: unknown) => Promise<TResponseBody<unknown>> | TResponseBody<unknown>)
  | ((ctx: Context, error: unknown) => Promise<void> | void);
