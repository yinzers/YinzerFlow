import type { Context } from 'core/Context.ts';
import type { THttpMethod } from 'types/http/Request.ts';
import type { TResponseBody } from 'types/http/Response.ts';

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
