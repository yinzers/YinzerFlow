import { httpMethod } from '@constants/http.ts';
import type { InternalHttpMethod } from '@typedefs/constants/http.ts';
import type { InternalRouteRegistryOptions } from '@typedefs/internal/InternalRouteRegistryImpl.js';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.js';

export interface InternalGroupApp {
  readonly get: (path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions) => void;
  readonly head: (path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions) => void;
  readonly post: (path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions) => void;
  readonly put: (path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions) => void;
  readonly delete: (path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions) => void;
  readonly patch: (path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions) => void;
  readonly options: (path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions) => void;
  readonly group: (prefix: string, callback: (group: InternalGroupApp) => void, options?: InternalRouteRegistryOptions) => InternalGroupApp;
}

export class GroupApp implements InternalGroupApp {
  private readonly _setup: InternalSetupImpl;
  private readonly _prefix: string;
  private readonly _options: InternalRouteRegistryOptions;

  constructor(setup: InternalSetupImpl, prefix: string, options?: InternalRouteRegistryOptions) {
    this._setup = setup;
    this._prefix = prefix;
    this._options = {
      beforeHooks: options?.beforeHooks ?? [],
      afterHooks: options?.afterHooks ?? [],
    };
  }

  private _createRouteHandler(method: InternalHttpMethod) {
    return (path: string, handler: HandlerCallback<any>, routeOptions?: InternalRouteRegistryOptions): void => {
      const fullPath = this._buildPath(path);
      const mergedOptions = this._mergeOptions(routeOptions);

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

  private _buildPath(path: string): string {
    // Handle path joining more elegantly
    const cleanPrefix = this._prefix.endsWith('/') ? this._prefix.slice(0, -1) : this._prefix;
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${cleanPrefix}${cleanPath}`;
  }

  private _mergeOptions(routeOptions?: InternalRouteRegistryOptions): InternalRouteRegistryOptions {
    return {
      beforeHooks: [...this._options.beforeHooks, ...(routeOptions?.beforeHooks ?? [])],
      afterHooks: [...(routeOptions?.afterHooks ?? []), ...this._options.afterHooks],
    };
  }

  // HTTP method handlers
  get = this._createRouteHandler(httpMethod.get);
  head = this._createRouteHandler(httpMethod.head);
  post = this._createRouteHandler(httpMethod.post);
  put = this._createRouteHandler(httpMethod.put);
  delete = this._createRouteHandler(httpMethod.delete);
  patch = this._createRouteHandler(httpMethod.patch);
  options = this._createRouteHandler(httpMethod.options);

  // Nested group support
  group(prefix: string, callback: (group: InternalGroupApp) => void, options?: InternalRouteRegistryOptions): InternalGroupApp {
    const nestedPrefix = this._buildPath(prefix);
    const nestedOptions = this._mergeOptions(options);

    const nestedGroup = new GroupApp(this._setup, nestedPrefix, nestedOptions);
    callback(nestedGroup);

    return nestedGroup;
  }
}
