import { createServer } from 'net';
import ip from 'ip';
import type { THttpMethod } from 'root/HttpRequest.ts';
import HttpRequest, { HttpMethod } from 'root/HttpRequest.ts';
import type { TResponseBody } from 'root/HttpResponse.ts';
import HttpResponse, { HttpStatusCode } from 'root/HttpResponse.ts';
import { Context } from 'root/Context.utils.ts';

// TODO - Write tests for this file

// TODO - Write automation to ensure the version is updated in the package.json file before publishing
// TODO - Write automation to publish to npm and also create a release in GitHub

export type Enum<T> = T[keyof T];

type TResponseFunction = (ctx: Context) => TResponseBody<unknown>;
type TUndefinableResponseFunction = TResponseFunction | ((ctx: Context) => void);

type TErrorFunction = ((ctx: Context, error: unknown) => TResponseBody<unknown>) | ((ctx: Context, error: unknown) => void);

export interface IRoute {
  path: string;
  method: THttpMethod;
  handler: TResponseFunction;
  beforeHandler?: TResponseFunction | TUndefinableResponseFunction | undefined;
  afterHandler?: TUndefinableResponseFunction | undefined;
  beforeGroup?: TResponseFunction | TUndefinableResponseFunction | undefined;
}

interface IMiddleware {
  fn: TResponseFunction | ((ctx: Context) => void);
}

interface IExcludeMiddleware extends IMiddleware {
  paths: 'allButExcluded';
  excluded: Array<string>;
}

interface IIncludeMiddleware extends IMiddleware {
  paths: Array<string>;
  excluded: [];
}

type TMiddleware = IExcludeMiddleware | IIncludeMiddleware;

/**
 *
 * incoming request -> route validation -> global middleware -> before route middleware -> route handler -> after route middleware -> response
 */
class YinzerFlow {
  private readonly backlog: number = 511;
  private readonly ip: string = ip.address();
  private readonly port: number = 5000;

  private readonly _routes: Array<IRoute> = [];

  private readonly middleware: Array<TMiddleware> = [];

  private readonly errorHandler: TErrorFunction = ({ response }, error): TResponseBody<unknown> => {
    console.error('Server error: \n', error);
    response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR);
    return { success: false, message: 'Internal server error' };
  };

  constructor(options?: { port?: number; errorHandler?: TErrorFunction }) {
    if (options) {
      if (options.port) this.port = options.port;
      if (options.errorHandler) {
        this.errorHandler = options.errorHandler;
      }
    }
  }

  /* eslint-disable-next-line @typescript-eslint/no-invalid-void-type */
  protected _handleMiddleware(route: IRoute, ctx: Context): TResponseBody<unknown> | void {
    let result = undefined;
    if (this.middleware.length) {
      for (const middleware of this.middleware) {
        if (middleware.paths === 'allButExcluded' && !middleware.excluded.includes(route.path)) {
          result = middleware.fn(ctx);
          if (result) {
            if (typeof result === 'object') result = JSON.stringify(result);
            return result;
          }
        }

        if (middleware.paths.includes(route.path)) {
          result = middleware.fn(ctx);
          if (result) {
            if (typeof result === 'object') result = JSON.stringify(result);

            return result;
          }
        }
      }
    }

    return void 0;
  }

  protected _handleRoute(route: IRoute, ctx: Context): TResponseBody<unknown> {
    let result = undefined;

    if (route.beforeGroup) {
      result = route.beforeGroup(ctx);
      if (result) {
        /**
         * If the beforeGroup returns a result we are going to return it and not continue with the route handler.
         * This is useful for things like authentication or throttling an entire group of routes.
         */
        return result;
      }
    }

    if (route.beforeHandler) {
      result = route.beforeHandler(ctx);
      if (result) {
        /**
         * If the beforeHandler returns a result we are going to return it and not continue with the route handler.
         * This is useful for things like authentication or validation.
         */
        return result;
      }
    }

    /**
     * We aren't going to return the result of the route handler here because we want to allow for afterHandler to run,
     * just in case we need to modify the response in some way or something in the afterHandler function.
     */
    result = route.handler(ctx);

    if (route.afterHandler) route.afterHandler(ctx);

    return result;
  }

  protected _handleRequest(request: HttpRequest, route: IRoute): HttpResponse {
    const ctx = new Context(request, new HttpResponse(request));

    let result = undefined;

    result = this._handleMiddleware(route, ctx);

    if (result) {
      ctx.response.setBody(result);
      return ctx.response;
    }

    result = this._handleRoute(route, ctx);

    ctx.response.setBody(result ?? 'Server Error');
    return ctx.response;
  }

  protected _route(
    path: IRoute['path'],
    handler: IRoute['handler'],
    options: {
      method: IRoute['method'];
      beforeHandler?: IRoute['beforeHandler'];
      afterHandler?: IRoute['afterHandler'];
    } = {
      method: HttpMethod.GET,
    },
  ): IRoute {
    const { beforeHandler, afterHandler } = options;
    const route = {
      path,
      method: options.method,
      handler,
      beforeHandler: beforeHandler ?? undefined,
      afterHandler: afterHandler ?? undefined,
    };
    this._routes.push(route);
    return route;
  }

  get(path: IRoute['path'], handler: IRoute['handler'], options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] }): IRoute {
    return this._route(path, handler, { method: HttpMethod.GET, ...options });
  }

  post(path: IRoute['path'], handler: IRoute['handler'], options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] }): IRoute {
    return this._route(path, handler, { method: HttpMethod.POST, ...options });
  }

  put(path: IRoute['path'], handler: IRoute['handler'], options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] }): IRoute {
    return this._route(path, handler, { method: HttpMethod.PUT, ...options });
  }

  delete(
    path: IRoute['path'],
    handler: IRoute['handler'],
    options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] },
  ): IRoute {
    return this._route(path, handler, { method: HttpMethod.DELETE, ...options });
  }

  patch(
    path: IRoute['path'],
    handler: IRoute['handler'],
    options?: { beforeHandler?: IRoute['beforeHandler']; afterHandler?: IRoute['afterHandler'] },
  ): IRoute {
    return this._route(path, handler, { method: HttpMethod.PATCH, ...options });
  }

  group(prefix: IRoute['path'], routes: Array<IRoute>, options?: { beforeGroup: IRoute['beforeGroup'] }): void {
    for (const route of routes) this._routes.push({ ...route, path: `${prefix}${route.path}`, beforeGroup: options?.beforeGroup });
  }

  routes(routes: Array<IRoute>): void {
    for (const route of routes) this._routes.push(route);
  }

  beforeAll(
    fn: TMiddleware['fn'],
    options?:
      | { paths: IExcludeMiddleware['paths']; excluded: IExcludeMiddleware['excluded'] }
      | { paths: IIncludeMiddleware['paths']; excluded: IIncludeMiddleware['excluded'] },
  ): void {
    if (!options) {
      this.middleware.push({ paths: [], excluded: [], fn });
      return void 0;
    }

    if ('excluded' in options && Array.isArray(options.excluded)) {
      this.middleware.push({ paths: 'allButExcluded', excluded: options.excluded, fn });
      return void 0;
    }

    if ('paths' in options && Array.isArray(options.paths)) {
      this.middleware.push({ paths: options.paths, excluded: [], fn });
      return void 0;
    }
  }

  /**
   * This should be the last method called in the application. It will start the server and listen for incoming requests,
   * if you call this method before defining any routes or middleware those routes and middleware will not be defined.
   */
  listen(): void {
    const server = createServer().listen(this.port, this.ip, this.backlog);

    server.on('listening', () => {
      console.log(`Server listening on ${this.ip}:${this.port}`);
    });

    server.on('connection', (socket) => {
      socket.on('data', (buffer) => {
        const request = new HttpRequest(buffer.toString());
        try {
          const route = findRoute(request, this._routes);

          if (!route) {
            // TODO - Allow for a custom 404 handler to be defined
            const ctx = new Context(request, new HttpResponse(request));
            ctx.response.setStatus(HttpStatusCode.NOT_FOUND);
            ctx.response.setBody({ success: false, message: 'Not found' });
            socket.write(ctx.response.formatHttpResponse());
            socket.end();
            return;
          }

          request.parseParams(route);

          const response = this._handleRequest(request, route);

          socket.write(response.formatHttpResponse());
          socket.end();
        } catch (error) {
          const ctx = new Context(request, new HttpResponse(request));
          ctx.response.setBody(this.errorHandler(ctx, error));
          socket.write(ctx.response.formatHttpResponse());
          socket.end();
        }
      });

      socket.on('error', (error) => {
        console.error('An error occurred with yinzerflow. Please open an issue on GitHub.', error);
      });
    });

    server.on('error', (error) => {
      console.error('An error occurred with yinzerflow. Please open an issue on GitHub.', error);
    });
  }
}

export { YinzerFlow, HttpStatusCode, HttpMethod };

const findRoute = (request: HttpRequest, routes: Array<IRoute>): IRoute | undefined => {
  /**
   * To speed up the response time we are going to ensure the route exists before worrying about any other logic.
   */
  const route = routes.find((r) => r.path === request.path && r.method === request.method);
  if (route) return route;

  /**
   * To save time we will only check for params if we don't find a route that matches exactly.
   *
   * It is possible for the route not to match exactly if the route has params in it.
   * So we are going to check for that here and if we don't find a route we will return undefined
   * and handle a 404 response in the listen method.
   */
  return routes.find((r) => {
    const pathParts = r.path.split('/');
    const requestPathParts = request.path.split('/');
    if (pathParts.length !== requestPathParts.length) return false;
    for (let i = 0; i < pathParts.length; i++) {
      if (pathParts[i]?.startsWith(':')) continue;
      if (pathParts[i] !== requestPathParts[i]) return false;
    }
    return true;
  });
};
