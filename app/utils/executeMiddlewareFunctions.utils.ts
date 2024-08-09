import type { Context } from 'root/Context.utils.ts';
import type { TResponseBody } from 'root/HttpResponse.ts';
import type { IRoute, TMiddleware } from 'root/index.ts';

// TODO - Write tests for this function

export default async (route: IRoute, ctx: Context, middlewares: Array<TMiddleware>): Promise<TResponseBody<unknown> | void> => {
  let result = undefined;
  if (middlewares.length) {
    for (const middleware of middlewares) {
      if (middleware.paths === 'allButExcluded' && !middleware.excluded.includes(route.path)) {
        result = await Promise.resolve(middleware.fn(ctx));

        if (result) {
          if (typeof result === 'object') result = JSON.stringify(result);
          return result;
        }
      }

      if (middleware.paths.includes(route.path)) {
        result = await Promise.resolve(middleware.fn(ctx));
        if (result) {
          if (typeof result === 'object') result = JSON.stringify(result);

          return result;
        }
      }
    }
  }

  return void 0;
};
