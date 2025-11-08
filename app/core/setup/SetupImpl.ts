import { httpMethod } from '@constants/http.ts';
import { handleCustomConfiguration } from '@core/setup/utils/handleCustomConfiguration.ts';
import type { InternalSetupImpl } from '@typedefs/internal/InternalSetupImpl.ts';
import { HookRegistryImpl } from '@core/execution/HookRegistryImpl.ts';
import type { InternalGlobalHookOptions } from '@typedefs/internal/InternalHookRegistryImpl.js';
import type { InternalServerOptions } from '@typedefs/internal/InternalConfiguration.js';
import type { ServerOptions } from '@typedefs/public/Configuration.js';
import type { InternalRouteRegistryOptions } from '@typedefs/internal/InternalRouteRegistryImpl.js';
import { RouteRegistryImpl } from '@core/setup/RouteRegistryImpl.ts';
import type { HandlerCallback } from '@typedefs/public/Context.js';
import { GroupApp } from '@core/setup/GroupApp.ts';
import { ensureCompleteRouteOptions } from '@core/setup/utils/routeUtils.js';
import type { RouteGroup } from '@typedefs/public/Setup.js';

export class SetupImpl implements InternalSetupImpl {
  readonly _configuration: InternalServerOptions;
  readonly _routeRegistry = new RouteRegistryImpl();
  readonly _hooks = new HookRegistryImpl();

  constructor(customConfiguration?: ServerOptions) {
    this._configuration = handleCustomConfiguration(customConfiguration);
  }

  //   ===== Route Registration =====
  get(path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions): void {
    const routeOptions = ensureCompleteRouteOptions(options);
    // Register GET route
    this._routeRegistry._register({ method: httpMethod.get, handler, path, options: routeOptions, params: {} });
    // Automatically register corresponding HEAD route
    this._routeRegistry._register({ method: httpMethod.head, handler, path, options: routeOptions, params: {} });
  }

  head(path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions): void {
    this._routeRegistry._register({ method: httpMethod.head, handler, path, options: ensureCompleteRouteOptions(options), params: {} });
  }

  post(path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions): void {
    this._routeRegistry._register({ method: httpMethod.post, handler, path, options: ensureCompleteRouteOptions(options), params: {} });
  }

  put(path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions): void {
    this._routeRegistry._register({ method: httpMethod.put, handler, path, options: ensureCompleteRouteOptions(options), params: {} });
  }

  patch(path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions): void {
    this._routeRegistry._register({ method: httpMethod.patch, handler, path, options: ensureCompleteRouteOptions(options), params: {} });
  }

  delete(path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions): void {
    this._routeRegistry._register({ method: httpMethod.delete, handler, path, options: ensureCompleteRouteOptions(options), params: {} });
  }

  options(path: string, handler: HandlerCallback<any>, options?: InternalRouteRegistryOptions): void {
    this._routeRegistry._register({ method: httpMethod.options, handler, path, options: ensureCompleteRouteOptions(options), params: {} });
  }

  group(prefix: string, callback: (group: RouteGroup) => void, options?: InternalRouteRegistryOptions): RouteGroup {
    // Create a group app that can handle nested groups and route registration
    const groupApp = new GroupApp(this, prefix, options);

    // Execute callback to register routes
    callback(groupApp);

    return groupApp;
  }

  /**
   * Hook Registration
   *
   * Note these are going to be called dynamically at run time, for now
   * we are just storing them in the server object until runtime. Although
   * it is slower during lookup, it is more flexible and memory efficient
   * allowing for more flexibility to include hook modification, conditional
   * hook execution, and better debugging.
   */
  beforeAll(handlers: Array<HandlerCallback<any>>, options?: InternalGlobalHookOptions): void {
    this._hooks._addBeforeHooks(handlers, options);
  }

  afterAll(handlers: Array<HandlerCallback<any>>, options?: InternalGlobalHookOptions): void {
    this._hooks._addAfterHooks(handlers, options);
  }

  onError(handler: HandlerCallback<any>): void {
    this._hooks._addOnError(handler);
  }

  onNotFound(handler: HandlerCallback<any>): void {
    this._hooks._addOnNotFound(handler);
  }
}
