import { createServer } from 'net';
import type { Socket } from 'net';
import ip from 'ip';
import type { THttpMethod } from 'root/HttpRequest.ts';
import HttpRequest, { HttpMethod } from 'root/HttpRequest.ts';
import type { TResponseBody } from 'root/HttpResponse.ts';
import HttpResponse, { HttpStatusCode } from 'root/HttpResponse.ts';
import { Context } from 'root/Context.utils.ts';
import executeBeforeGroupFunctionsUtils from 'utils/executeBeforeGroupFunctions.utils.ts';
import executeBeforeHandlerFunctionsUtils from 'utils/executeBeforeHandlerFunctions.utils.ts';
import executeMiddlewareFunctionsUtils from 'utils/executeMiddlewareFunctions.utils.ts';
import findRouteUtils from 'utils/findRoute.utils.ts';

// TODO - Write tests for this file

// TODO - Write automation to ensure the version is updated in the package.json file before publishing
// TODO - Write automation to publish to npm and also create a release in GitHub

export type Enum<T> = T[keyof T];

type TResponseFunction = (ctx: Context) => Promise<TResponseBody<unknown>> | TResponseBody<unknown>;
type TUndefinableResponseFunction = TResponseFunction | ((ctx: Context) => Promise<void> | void);

type TErrorFunction =
  | ((ctx: Context, error: unknown) => Promise<TResponseBody<unknown>> | TResponseBody<unknown>)
  | ((ctx: Context, error: unknown) => Promise<void> | void);

export interface IRoute {
  path: string;
  method: THttpMethod;
  handler: TResponseFunction;
  beforeHandler?: TResponseFunction | TUndefinableResponseFunction | undefined;
  afterHandler?: TUndefinableResponseFunction | undefined;
  beforeGroup?: TResponseFunction | TUndefinableResponseFunction | undefined;
}

interface IMiddleware {
  fn: TUndefinableResponseFunction;
}

interface IExcludeMiddleware extends IMiddleware {
  paths: 'allButExcluded';
  excluded: Array<string>;
}

interface IIncludeMiddleware extends IMiddleware {
  paths: Array<string>;
  excluded: [];
}

export type TMiddleware = IExcludeMiddleware | IIncludeMiddleware;

/**
 *
 * incoming request -> route validation -> global middleware -> before route middleware -> route handler -> after route middleware -> response
 */
class YinzerFlow {
  private readonly _backlog: number = 511;
  private readonly _ip: string = ip.address();
  private readonly _port: number = 5000;
  private _isListening = false;
  private readonly _routes: Array<IRoute> = [];
  private readonly middleware: Array<TMiddleware> = [];

  constructor(options?: { port?: number; errorHandler?: TErrorFunction }) {
    if (options) {
      if (options.port) this._port = options.port;
      if (options.errorHandler) {
        this._errorHandler = options.errorHandler;
      }
    }
  }

  private readonly _errorHandler: TErrorFunction = ({ response }, error): TResponseBody<unknown> => {
    /* eslint-disable-next-line no-console */
    console.error('Server error: \n', error);
    response.setStatus(HttpStatusCode.INTERNAL_SERVER_ERROR);
    return { success: false, message: 'Internal server error' };
  };

  protected async _handleRequest(request: HttpRequest, route: IRoute): Promise<HttpResponse> {
    const createContext = new Context(request, new HttpResponse(request));

    let result = undefined;

    result = await Promise.resolve(executeMiddlewareFunctionsUtils(route, createContext, this.middleware));

    if (result) {
      createContext.response.setBody(result);
      return createContext.response;
    }

    /**
     * If the beforeGroup returns a result we are going to return it and not continue with the route handler.
     * This is useful for things like authentication or throttling an entire group of routes.
     */
    result = await Promise.resolve(executeBeforeGroupFunctionsUtils(route, createContext));

    if (result) {
      createContext.response.setBody(result);
      return createContext.response;
    }

    /**
     * If the beforeHandler returns a result we are going to return it and not continue with the route handler.
     * This is useful for things like authentication or validation.
     */
    result = await Promise.resolve(executeBeforeHandlerFunctionsUtils(route, createContext));

    if (result) {
      createContext.response.setBody(result);
      return createContext.response;
    }

    /**
     * We are not returning the results of the route handler until after the afterHandler has been called.
     * This is just in case the afterHandler needs to modify the response in some way.
     */
    result = await Promise.resolve(route.handler(createContext));

    if (route.afterHandler) await Promise.resolve(route.afterHandler(createContext));

    createContext.response.setBody(result);
    return createContext.response;
  }

  protected async _mainHandler(socket: Socket, buffer: Buffer): Promise<void> {
    const createRequest = new HttpRequest(buffer.toString());
    try {
      const findRouteBasedOnRequest = findRouteUtils(createRequest, this._routes);

      if (!findRouteBasedOnRequest) {
        // TODO - Allow for a custom 404 handler to be defined
        const ctx = new Context(createRequest, new HttpResponse(createRequest));
        ctx.response.setStatus(HttpStatusCode.NOT_FOUND);
        ctx.response.setBody({ success: false, message: 'Not found' });
        socket.write(ctx.response.formatHttpResponse());
        socket.end();
        return;
      }

      createRequest.parseParams(findRouteBasedOnRequest);

      const createResponse = await this._handleRequest(createRequest, findRouteBasedOnRequest);

      socket.write(createResponse.formatHttpResponse());
      socket.end();
    } catch (error) {
      const createContext = new Context(createRequest, new HttpResponse(createRequest));
      createContext.response.setBody(this._errorHandler(createContext, error));
      socket.write(createContext.response.formatHttpResponse());
      socket.end();
    }
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
    const server = createServer().listen(this._port, this._ip, this._backlog);

    server.on('listening', () => {
      this._isListening = true;
    });

    server.on('connection', (socket) => {
      /* eslint-disable-next-line @typescript-eslint/no-misused-promises */
      socket.on('data', async (buffer) => {
        await this._mainHandler(socket, buffer);
      });

      socket.on('error', (error) => {
        /* eslint-disable-next-line no-console */
        console.error('An error occurred with yinzerflow. Please open an issue on GitHub.', error);
      });
    });

    server.on('error', (error) => {
      /* eslint-disable-next-line no-console */
      console.error('An error occurred with yinzerflow. Please open an issue on GitHub.', error);
    });
  }

  close(): void {
    if (this._isListening) {
      createServer().close();
      this._isListening = false;
    }
  }

  getStatus(): { isListening: boolean; port: number; ip: string } {
    return {
      isListening: this._isListening,
      port: this._port,
      ip: this._ip,
    };
  }
}

export { YinzerFlow, HttpStatusCode, HttpMethod };
