import { httpMethod } from '@constants/http.ts';
import type { InternalHttpMethod } from '@typedefs/constants/http.ts';
import type { InternalRouteRegistryOptions } from '@typedefs/internal/InternalRouteRegistryImpl.js';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.js';
import type { HttpMethodHandlers, RouteGroupMethod } from '@core/setup/utils/routeUtils.js';
import { buildRoutePath, ensureCompleteRouteOptions, mergeRouteOptions } from '@core/setup/utils/routeUtils.js';

export interface InternalGroupApp extends HttpMethodHandlers {
  readonly group: RouteGroupMethod;
}

export class GroupApp implements InternalGroupApp {
  private readonly _setup: InternalSetupImpl;
  private readonly _prefix: string;
  private readonly _options: InternalRouteRegistryOptions;

  constructor(setup: InternalSetupImpl, prefix: string, options?: InternalRouteRegistryOptions) {
    this._setup = setup;
    this._prefix = prefix;
    this._options = ensureCompleteRouteOptions(options);
  }

  private _createRouteHandler(method: InternalHttpMethod) {
    return (path: string, handler: HandlerCallback<any>, routeOptions?: InternalRouteRegistryOptions): void => {
      const fullPath = buildRoutePath(this._prefix, path);
      const mergedOptions = mergeRouteOptions(this._options, routeOptions);

      this._setup._routeRegistry._register({
        method,
        handler,
        path: fullPath,
        options: mergedOptions,
        params: {},
      });

      // If this is a GET route, automatically register the corresponding HEAD route
      if (method === httpMethod.get) {
        this._setup._routeRegistry._register({
          method: httpMethod.head,
          handler,
          path: fullPath,
          options: mergedOptions,
          params: {},
        });
      }
    };
  }

  // HTTP method handlers - using the utility type to ensure consistency
  get = this._createRouteHandler(httpMethod.get);
  head = this._createRouteHandler(httpMethod.head);
  post = this._createRouteHandler(httpMethod.post);
  put = this._createRouteHandler(httpMethod.put);
  delete = this._createRouteHandler(httpMethod.delete);
  patch = this._createRouteHandler(httpMethod.patch);
  options = this._createRouteHandler(httpMethod.options);

  // Nested group support
  group(prefix: string, callback: (group: InternalGroupApp) => void, options?: InternalRouteRegistryOptions): InternalGroupApp {
    const nestedPrefix = buildRoutePath(this._prefix, prefix);
    const nestedOptions = mergeRouteOptions(this._options, options);

    const nestedGroup = new GroupApp(this._setup, nestedPrefix, nestedOptions);
    callback(nestedGroup);

    return nestedGroup;
  }
}
