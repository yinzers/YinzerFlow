import type { Context } from 'utils/Context.utils.ts';
import type { THttpMethod } from './http/Request.ts';
import type { TResponseBody } from 'lib/index.js';

export type TResponseFunction = (ctx: Context) => Promise<TResponseBody<unknown>> | TResponseBody<unknown>;
export type TUndefinableResponseFunction = TResponseFunction | ((ctx: Context) => Promise<void> | void);

export interface IRoute {
  path: string;
  method: THttpMethod;
  handler: TResponseFunction;
  beforeHandler?: TResponseFunction | TUndefinableResponseFunction | undefined;
  afterHandler?: TUndefinableResponseFunction | undefined;
  beforeGroup?: TResponseFunction | TUndefinableResponseFunction | undefined;
}
