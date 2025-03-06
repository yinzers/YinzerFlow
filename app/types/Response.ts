import type { TResponseBody } from './http/Response.ts';
import type { Context } from 'types/Common.ts';

export type TErrorFunction =
  | ((ctx: Context, error: unknown) => Promise<TResponseBody<unknown>> | TResponseBody<unknown>)
  | ((ctx: Context, error: unknown) => Promise<void> | void);
