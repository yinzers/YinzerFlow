import type { Context } from 'root/Context.utils.ts';
import type { TResponseBody } from 'root/HttpResponse.ts';
import type { IRoute } from 'root/index.ts';

// TODO - Write tests for this function

export default async (route: IRoute, ctx: Context): Promise<TResponseBody<unknown> | void> => {
  if (route.beforeHandler) return Promise.resolve(route.beforeHandler(ctx));
  return void 0;
};
